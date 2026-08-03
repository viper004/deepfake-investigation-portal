from fastapi import APIRouter, Depends, HTTPException, status, Header, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional, List
from jose import jwt, JWTError
import uuid
from datetime import datetime, timedelta, timezone

from app.database.database import SessionLocal
from app.models.user import User, InvestigatorInvitation, AccountRole, InvitationLog
from app.models.models import Role
from app.schemas.user import UserResponse
from app.utils.auth import SECRET_KEY, ALGORITHM
from app.services.email_service import send_investigator_invitation_email
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/admin", tags=["admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("email")
        role = payload.get("role")
        roles = payload.get("roles", [])
        
        is_admin = (1 in roles) or (role == 1)
        
        # Allow superuser or anyone with Admin role
        if email != "superuser@example.com" and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Administrators only."
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )

class UserUpdate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    organization: Optional[str] = None
    role_id: Optional[int] = None
    status: Optional[str] = None
    government_id: Optional[str] = None

class RejectRequest(BaseModel):
    reason: str

class InvitationRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None

class BulkInvitationRequest(BaseModel):
    invitations: List[InvitationRequest]

@router.post("/invitations")
def create_invitations(req: BulkInvitationRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    admin_sub = admin.get("sub")
    created_by_id = int(admin_sub) if admin_sub and str(admin_sub).isdigit() else None
    
    sent_count = 0
    skipped_existing = 0
    skipped_duplicate = 0
    skipped_pending = 0
    
    seen_emails = set()
    
    for inv in req.invitations:
        email_lower = inv.email.lower()
        if email_lower in seen_emails:
            skipped_duplicate += 1
            continue
        seen_emails.add(email_lower)
        
        existing_user = db.query(User).filter(User.email == inv.email).first()
        if existing_user:
            skipped_existing += 1
            continue
            
        pending_invite = db.query(InvestigatorInvitation).filter(InvestigatorInvitation.email == inv.email, InvestigatorInvitation.status == "PENDING").first()
        if pending_invite:
            skipped_pending += 1
            continue
            
        token = uuid.uuid4().hex
        invite = InvestigatorInvitation(
            full_name=inv.full_name,
            email=inv.email,
            phone=inv.phone,
            token=token,
            status="Pending",
            invitation_type="New Investigator",
            delivery_status="Pending",
            send_attempts=0,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            created_by=created_by_id
        )
        db.add(invite)
        db.flush() # To get invite.id
        
        log = InvitationLog(
            invitation_id=invite.id,
            event_type="Invitation Created",
            status="SUCCESS",
            performed_by=created_by_id,
            recipient_email=inv.email,
            message="Initial invitation record created."
        )
        db.add(log)
        
        sent_count += 1
        background_tasks.add_task(send_investigator_invitation_email, inv.email, inv.full_name, token, invite.id)
        
    db.commit()
    
    return {
        "message": "Bulk invitation processing complete",
        "sent": sent_count,
        "skipped_existing": skipped_existing,
        "skipped_duplicate": skipped_duplicate,
        "skipped_pending": skipped_pending
    }

@router.get("/invitations")
def list_invitations(db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    invites = db.query(InvestigatorInvitation).order_by(desc(InvestigatorInvitation.created_at)).all()
    return [{
        "id": i.id,
        "email": i.email,
        "full_name": i.full_name,
        "status": i.status,
        "created_at": i.created_at,
        "expires_at": i.expires_at
    } for i in invites]

@router.get("/invitation-logs")
def list_invitation_logs(db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    logs = db.query(InvitationLog).order_by(desc(InvitationLog.created_at)).all()
    return [{
        "id": l.id,
        "invitation_id": l.invitation_id,
        "event_type": l.event_type,
        "status": l.status,
        "performed_by": l.performed_by,
        "recipient_email": l.recipient_email,
        "message": l.message,
        "ip_address": l.ip_address,
        "user_agent": l.user_agent,
        "created_at": l.created_at
    } for l in logs]

@router.post("/invitations/{invite_id}/resend")
def resend_invitation(invite_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    admin_sub = admin.get("sub")
    created_by_id = int(admin_sub) if admin_sub and str(admin_sub).isdigit() else None
    
    invite = db.query(InvestigatorInvitation).filter_by(id=invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    if invite.status not in ["Pending", "Expired", "Delivered", "Failed"]:
        raise HTTPException(status_code=400, detail="Cannot resend an invitation in this status")
        
    invite.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite.status = "Pending"
    invite.delivery_status = "Pending"
    
    log = InvitationLog(
        invitation_id=invite.id,
        event_type="Invitation Resent",
        status="SUCCESS",
        performed_by=created_by_id,
        recipient_email=invite.email,
        message="Invitation expiration extended and email resent."
    )
    db.add(log)
    db.commit()
    
    background_tasks.add_task(send_investigator_invitation_email, invite.email, invite.full_name, invite.token, invite.id)
    return {"message": "Invitation resent"}

@router.post("/invitations/{invite_id}/cancel")
def cancel_invitation(invite_id: int, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    admin_sub = admin.get("sub")
    created_by_id = int(admin_sub) if admin_sub and str(admin_sub).isdigit() else None
    
    invite = db.query(InvestigatorInvitation).filter_by(id=invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    if invite.status != "Pending" and invite.status != "Delivered" and invite.status != "Failed":
        raise HTTPException(status_code=400, detail="Cannot cancel an invitation that is already accepted or expired")
        
    invite.status = "Cancelled"
    
    log = InvitationLog(
        invitation_id=invite.id,
        event_type="Invitation Cancelled",
        status="SUCCESS",
        performed_by=created_by_id,
        recipient_email=invite.email,
        message="Invitation was cancelled by administrator."
    )
    db.add(log)
    db.commit()
    return {"message": "Invitation cancelled"}

@router.post("/users/{account_id}/upgrade-investigator")
def upgrade_user(account_id: int, db: Session = Depends(get_db), admin: dict = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == account_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    token = uuid.uuid4().hex
    admin_sub = admin.get("sub")
    created_by_id = int(admin_sub) if str(admin_sub).isdigit() else None
    
    invite = InvestigatorInvitation(
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        token=token,
        status="PENDING",
        account_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        created_by=created_by_id
    )
    db.add(invite)
    db.commit()
    print(f"[Email Simulation] Sending upgrade link to {user.email} with token {token}")
    return {"message": "Upgrade invitation sent successfully"}

@router.get("/users")
def get_users(
    search: Optional[str] = None,
    role_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    # Only return users whose status is Approved or Active
    query = db.query(User).filter(User.status.in_(["APPROVED", "ACTIVE"]))

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                User.full_name.like(search_filter),
                User.email.like(search_filter),
                User.organization.like(search_filter)
            )
        )
    
    if role_id:
        query = query.filter(User.role_id == role_id)
        
    if status_filter:
        query = query.filter(User.status == status_filter.upper())

    if sort_by == "newest":
        query = query.order_by(desc(User.created_at))
    else:
        query = query.order_by(User.id)

    total = query.count()
    offset = (page - 1) * limit
    users = query.offset(offset).limit(limit).all()

    users_list = []
    for u in users:
        role_name = u.role.role_name if u.role else "N/A"
        users_list.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "organization": u.organization,
            "role_id": u.role_id,
            "role_name": role_name,
            "status": u.status,
            "profile_picture": u.profile_picture,
            "government_id": getattr(u, "government_id", None),
            "date_of_birth": getattr(u, "date_of_birth", None),
            "gender": getattr(u, "gender", None),
            "address": getattr(u, "address", None),
            "digital_id_path": getattr(u, "digital_id_path", None),
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })

    return {
        "users": users_list,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/pending-users")
def get_pending_users(
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    users = db.query(User).filter(User.status == "PENDING").order_by(desc(User.created_at)).all()
    
    pending_list = []
    for u in users:
        role_name = u.role.role_name if u.role else "N/A"
        pending_list.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "organization": u.organization,
            "role_id": u.role_id,
            "role_name": role_name,
            "status": u.status,
            "profile_picture": u.profile_picture,
            "government_id": getattr(u, "government_id", None),
            "date_of_birth": getattr(u, "date_of_birth", None),
            "gender": getattr(u, "gender", None),
            "address": getattr(u, "address", None),
            "digital_id_path": getattr(u, "digital_id_path", None),
            "created_at": u.created_at.isoformat() if u.created_at else None
        })
    return pending_list

@router.post("/users/{user_id}/approve")
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.status = "APPROVED"
    db.commit()
    return {"message": "User approved successfully"}

@router.post("/users/{user_id}/reject")
def reject_user(
    user_id: int,
    request: RejectRequest,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.status = "REJECTED"
    db.commit()
    # Log rejection reason to stdout or audit if needed
    print(f"User {user.email} rejected by admin. Reason: {request.reason}")
    return {"message": "User rejected successfully"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.full_name = payload.full_name
    user.email = payload.email
    user.phone = payload.phone
    user.organization = payload.organization
    
    if payload.role_id is not None:
        user.role_id = payload.role_id
        
    if payload.status is not None:
        user.status = payload.status
        
    if payload.government_id is not None:
        setattr(user, "government_id", payload.government_id)

    db.commit()
    db.refresh(user)
    
    role_name = user.role.role_name if user.role else "N/A"
    return {
        "message": "User updated successfully",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "organization": user.organization,
            "role_id": user.role_id,
            "role_name": role_name,
            "status": user.status,
            "government_id": getattr(user, "government_id", None)
        }
    }


class RejectionPayload(BaseModel):
    reason: str


def notify_user(db: Session, user_id: int, title: str, message: str):
    try:
        from app.models.models import Notification
        n = Notification(user_id=user_id, title=title, message=message)
        db.add(n)
        db.commit()
    except Exception as e:
        print("Failed to send notification:", e)


