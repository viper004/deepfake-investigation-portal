from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional
from jose import jwt, JWTError

from app.database.database import SessionLocal
from app.models.user import User
from app.models.models import Role
from app.schemas.user import UserResponse
from app.utils.auth import SECRET_KEY, ALGORITHM
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
        # Allow superuser or anyone with role_id == 1 (Admin)
        if email != "superuser@example.com" and role != 1:
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


@router.get("/investigator-applications")
def list_investigator_applications(
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    from app.models.user import InvestigatorProfile
    applications = db.query(User).join(InvestigatorProfile).filter(
        User.role_id == 2,
        User.status == "PENDING"
    ).order_by(desc(User.created_at)).all()

    result = []
    for u in applications:
        prof = u.investigator_profile
        result.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "profile_picture": u.profile_picture,
            "status": u.status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "organization": prof.organization if prof else None,
            "department": prof.department if prof else None,
            "designation": prof.designation if prof else None,
            "employee_id": prof.employee_id if prof else None,
            "government_id_path": prof.government_id_path if prof else None,
            "applied_date": prof.applied_date.isoformat() if prof and prof.applied_date else None
        })
    return result


@router.post("/investigator-applications/{user_id}/approve")
def approve_investigator_application(
    user_id: int,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id, User.role_id == 2).first()
    if not user:
        raise HTTPException(status_code=404, detail="Investigator application not found")
    
    user.status = "ACTIVE"
    db.commit()

    notify_user(
        db, user_id, "Application Approved",
        "Your investigator application has been approved by the administrator. You can now log in."
    )
    return {"message": "Application approved successfully"}


@router.post("/investigator-applications/{user_id}/reject")
def reject_investigator_application(
    user_id: int,
    payload: RejectionPayload,
    db: Session = Depends(get_db),
    admin: dict = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id, User.role_id == 2).first()
    if not user:
        raise HTTPException(status_code=404, detail="Investigator application not found")
    
    user.status = "REJECTED"
    if user.investigator_profile:
        user.investigator_profile.rejection_reason = payload.reason
    db.commit()

    notify_user(
        db, user_id, "Application Rejected",
        f"Your investigator application was rejected. Reason: {payload.reason}"
    )
    return {"message": "Application rejected successfully"}

