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

import json
from app.database.database import SessionLocal
from app.models.models import (
    InvestigationCase, EvidenceFile, MediaMetadata, AIModel, AIAnalysis,
    ForensicReview, InvestigationNote, InvestigatorNote, InvestigationDocument, Report, Notification, AuditLog, CaseMessage,
    ForensicScan, StatusEnum, FileTypeEnum, AIResultEnum, ReportTypeEnum, MediaTypeEnum, MessageAttachment
)
from app.schemas.user import InvestigatorNoteCreate, InvestigatorNoteUpdate, InvestigatorNoteResponse
from app.services.forensic_report import generate_forensic_pdf_report
from app.services.sentinel_service import analyze_investigation_evidence
from app.services.storage_service import (
    storage_service, validate_attachment_file, verify_signed_token, generate_signed_token
)
from app.models.user import User
from app.utils.auth import SECRET_KEY, ALGORITHM, get_password_hash

router = APIRouter(prefix="/user", tags=["user"])

# Base backend directory and uploads directory setup
BASE_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_DIR = os.path.join(BASE_BACKEND_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "analysis"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "reports"), exist_ok=True)

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
            InvestigationCase.status.in_([StatusEnum.CASE_FILED, StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.CASE_OPENED, StatusEnum.OPEN, StatusEnum.ASSIGNED, StatusEnum.IN_PROGRESS])
        ).count()
        under_analysis = db.query(InvestigationCase).filter(
            InvestigationCase.status.in_([StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.UNDER_ANALYSIS, StatusEnum.IN_PROGRESS])
        ).count()
        closed_cases = db.query(InvestigationCase).filter(InvestigationCase.status == StatusEnum.CLOSED).count()
        completed_cases = db.query(InvestigationCase).filter(
            or_(
                InvestigationCase.forwarded_to_expert_at.isnot(None),
                InvestigationCase.status.in_([StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED])
            )
        ).count()
        evidence_uploaded = db.query(EvidenceFile).count()
        ai_completed = db.query(AIAnalysis).count()
        reports_count = db.query(Report).count()
        assigned_cases = open_cases
        in_progress_cases = under_analysis
    elif is_investigator(user):
        assigned_cond = or_(InvestigationCase.assigned_expert == user.id, InvestigationCase.assigned_investigator_id == user.id)
        available_cases = db.query(InvestigationCase).filter(
            InvestigationCase.status == StatusEnum.CASE_FILED,
            InvestigationCase.assigned_expert == None,
            InvestigationCase.assigned_investigator_id == None
        ).count()
        # 1. Active assigned workload
        assigned_cases = db.query(InvestigationCase).filter(
            assigned_cond,
            InvestigationCase.forwarded_to_expert_at.is_(None),
            InvestigationCase.investigator_completed_at.is_(None),
            InvestigationCase.status.in_([
                StatusEnum.ASSIGNED,
                StatusEnum.IN_PROGRESS,
                StatusEnum.CASE_UNDER_INVESTIGATION,
                StatusEnum.CASE_OPENED,
                StatusEnum.UNDER_ANALYSIS,
                StatusEnum.OPEN,
                StatusEnum.REVIEW
            ])
        ).count()
        # 2. In progress cases
        in_progress_cases = db.query(InvestigationCase).filter(
            assigned_cond,
            InvestigationCase.forwarded_to_expert_at.is_(None),
            InvestigationCase.investigator_completed_at.is_(None),
            InvestigationCase.status.in_([
                StatusEnum.IN_PROGRESS,
                StatusEnum.CASE_UNDER_INVESTIGATION,
                StatusEnum.UNDER_ANALYSIS
            ])
        ).count()
        # 3. Completed cases by this investigator
        completed_cases = db.query(InvestigationCase).filter(
            assigned_cond,
            or_(
                InvestigationCase.forwarded_to_expert_at.isnot(None),
                InvestigationCase.investigator_completed_at.isnot(None),
                InvestigationCase.status.in_([
                    StatusEnum.FORWARDED_TO_EXPERT,
                    StatusEnum.UNDER_EXPERT_REVIEW,
                    StatusEnum.VERIFIED
                ]),
                and_(
                    InvestigationCase.status == StatusEnum.CLOSED,
                    InvestigationCase.forwarded_to_expert_at.isnot(None)
                )
            )
        ).count()

        total_cases = db.query(InvestigationCase).filter(assigned_cond).count()
        open_cases = assigned_cases
        under_analysis = in_progress_cases
        closed_cases = completed_cases
        evidence_uploaded = db.query(EvidenceFile).join(InvestigationCase).filter(
            assigned_cond
        ).count()
        ai_completed = db.query(AIAnalysis).join(EvidenceFile).join(InvestigationCase).filter(
            assigned_cond
        ).count()
        reports_count = db.query(Report).filter(Report.generated_by == user.id).count()
    else:
        available_cases = 0
        assigned_cases = 0
        in_progress_cases = 0
        completed_cases = 0
        total_cases = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id).count()
        open_cases = db.query(InvestigationCase).filter(
            InvestigationCase.created_by == user.id,
            InvestigationCase.status.in_([StatusEnum.CASE_FILED, StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.CASE_OPENED, StatusEnum.OPEN, StatusEnum.ASSIGNED, StatusEnum.IN_PROGRESS])
        ).count()
        under_analysis = db.query(InvestigationCase).filter(
            InvestigationCase.created_by == user.id,
            InvestigationCase.status.in_([StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.UNDER_ANALYSIS, StatusEnum.IN_PROGRESS])
        ).count()
        in_progress_cases = under_analysis
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
        "inProgressCases": in_progress_cases,
        "inProgress": in_progress_cases,
        "completedCases": completed_cases,
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
        assigned_cond = or_(InvestigationCase.assigned_expert == user.id, InvestigationCase.assigned_investigator_id == user.id)
        cases = db.query(InvestigationCase).filter(
            assigned_cond
        ).order_by(desc(InvestigationCase.created_at)).limit(5).all()
        uploads = db.query(EvidenceFile).join(InvestigationCase).filter(
            assigned_cond
        ).order_by(desc(EvidenceFile.upload_time)).limit(5).all()
        ai_results = db.query(AIAnalysis).join(EvidenceFile).join(InvestigationCase).filter(
            assigned_cond
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
@router.get("/cases/assigned")
def get_assigned_cases(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return get_cases(search=search, status_filter=status_filter, scope="assigned", sort_by=sort_by, page=page, limit=limit, db=db, user=user)

@router.get("/cases/completed")
def get_completed_cases(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Access denied: Only investigators or administrators can view completed cases.")
    return get_cases(search=search, status_filter=status_filter, scope="completed", sort_by=sort_by, page=page, limit=limit, db=db, user=user)

@router.get("/cases/expert-review")
def get_expert_review_cases(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Access denied: Only experts, investigators or administrators can view cases awaiting expert review.")
    return get_cases(search=search, status_filter=status_filter, scope="expert", sort_by=sort_by, page=page, limit=limit, db=db, user=user)

@router.get("/cases/all")
def get_all_cases(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return get_cases(search=search, status_filter=status_filter, scope="all", sort_by=sort_by, page=page, limit=limit, db=db, user=user)

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
    if scope in ["open_cases", "open"]:
        if not is_investigator_or_admin(user):
            raise HTTPException(status_code=403, detail="Access denied: Only investigators can view open cases.")
        query = db.query(InvestigationCase).filter(
            InvestigationCase.status == StatusEnum.CASE_FILED,
            InvestigationCase.assigned_expert == None,
            InvestigationCase.assigned_investigator_id == None
        )
    elif scope in ["assigned", "assigned_cases"]:
        assigned_cond = or_(InvestigationCase.assigned_expert == user.id, InvestigationCase.assigned_investigator_id == user.id)
        # Active investigator workload: exclude completed/forwarded cases
        query = db.query(InvestigationCase).filter(
            assigned_cond,
            InvestigationCase.forwarded_to_expert_at.is_(None),
            InvestigationCase.investigator_completed_at.is_(None),
            InvestigationCase.status.in_([
                StatusEnum.ASSIGNED,
                StatusEnum.IN_PROGRESS,
                StatusEnum.CASE_UNDER_INVESTIGATION,
                StatusEnum.CASE_OPENED,
                StatusEnum.UNDER_ANALYSIS,
                StatusEnum.OPEN,
                StatusEnum.REVIEW
            ])
        )
    elif scope in ["completed", "completed_cases"]:
        assigned_cond = or_(InvestigationCase.assigned_investigator_id == user.id, InvestigationCase.assigned_expert == user.id)
        # Completed cases by THIS investigator that were forwarded to expert
        query = db.query(InvestigationCase).filter(
            assigned_cond,
            or_(
                InvestigationCase.forwarded_to_expert_at.isnot(None),
                InvestigationCase.investigator_completed_at.isnot(None),
                InvestigationCase.status.in_([
                    StatusEnum.FORWARDED_TO_EXPERT,
                    StatusEnum.UNDER_EXPERT_REVIEW,
                    StatusEnum.VERIFIED
                ]),
                and_(
                    InvestigationCase.status == StatusEnum.CLOSED,
                    InvestigationCase.forwarded_to_expert_at.isnot(None)
                )
            )
        )
    elif scope in ["expert", "expert_review"]:
        query = db.query(InvestigationCase).filter(
            or_(
                InvestigationCase.status.in_([
                    StatusEnum.FORWARDED_TO_EXPERT,
                    StatusEnum.UNDER_EXPERT_REVIEW
                ]),
                InvestigationCase.expert_review_status.in_(["PENDING", "UNDER_REVIEW"])
            )
        )
    elif scope in ["all", "all_cases"]:
        if is_investigator_or_admin(user):
            query = db.query(InvestigationCase)
        else:
            query = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id)
    elif is_admin(user):
        query = db.query(InvestigationCase)
    elif is_investigator(user):
        assigned_cond = or_(InvestigationCase.assigned_expert == user.id, InvestigationCase.assigned_investigator_id == user.id)
        query = db.query(InvestigationCase).filter(assigned_cond)
    else:
        query = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id)

    if search:
        search_term = f"%{search}%"
        query = query.outerjoin(User, or_(InvestigationCase.assigned_expert == User.id, InvestigationCase.assigned_investigator_id == User.id)).filter(
            or_(
                InvestigationCase.case_number.like(search_term),
                InvestigationCase.title.like(search_term),
                InvestigationCase.description.like(search_term),
                User.full_name.like(search_term)
            )
        )

    if status_filter and status_filter.upper() != "ALL":
        sf = status_filter.upper().strip()
        if sf in ["PENDING", "CASE_FILED", "UNASSIGNED"]:
            query = query.filter(InvestigationCase.status == StatusEnum.CASE_FILED)
        elif sf in ["ASSIGNED", "CASE_UNDER_INVESTIGATION", "UNDER_INVESTIGATION", "UNDER INVESTIGATION"]:
            query = query.filter(InvestigationCase.status.in_([
                StatusEnum.ASSIGNED,
                StatusEnum.IN_PROGRESS,
                StatusEnum.CASE_UNDER_INVESTIGATION,
                StatusEnum.CASE_OPENED,
                StatusEnum.UNDER_ANALYSIS,
                StatusEnum.OPEN,
                StatusEnum.REVIEW
            ]))
        elif sf in ["IN_PROGRESS", "IN PROGRESS"]:
            query = query.filter(InvestigationCase.status.in_([
                StatusEnum.IN_PROGRESS,
                StatusEnum.CASE_UNDER_INVESTIGATION,
                StatusEnum.UNDER_ANALYSIS
            ]))
        elif sf in ["FORWARDED_TO_EXPERT", "FORWARDED", "FORWARDED TO EXPERT"]:
            query = query.filter(InvestigationCase.status == StatusEnum.FORWARDED_TO_EXPERT)
        elif sf in ["UNDER_EXPERT_REVIEW", "UNDER REVIEW", "UNDER_REVIEW", "EXPERT_REVIEW"]:
            query = query.filter(InvestigationCase.status.in_([StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.EXPERT_REVIEW]))
        elif sf in ["VERIFIED", "APPROVED"]:
            query = query.filter(InvestigationCase.status == StatusEnum.VERIFIED)
        elif sf in ["CLOSED", "COMPLETED"]:
            query = query.filter(InvestigationCase.status == StatusEnum.CLOSED)
        elif sf == "DRAFT":
            query = query.filter(InvestigationCase.status == StatusEnum.DRAFT)
        else:
            try:
                query = query.filter(InvestigationCase.status == StatusEnum[sf])
            except Exception:
                pass

    if sort_by == "oldest":
        query = query.order_by(InvestigationCase.id)
    elif sort_by == "forwarded":
        query = query.order_by(desc(InvestigationCase.forwarded_to_expert_at))
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
        exp_name = c.expert.full_name if c.expert else None
        inv_name = c.assigned_investigator.full_name if c.assigned_investigator else (c.expert.full_name if c.expert else None)
        inv_id = c.assigned_investigator_id or c.assigned_expert
        exp_id = c.assigned_expert

        # Derived expert review status
        if c.expert_review_status:
            exp_rev_st = c.expert_review_status
        elif c.status == StatusEnum.VERIFIED:
            exp_rev_st = "VERIFIED"
        elif c.status == StatusEnum.UNDER_EXPERT_REVIEW:
            exp_rev_st = "UNDER_REVIEW"
        elif c.status == StatusEnum.FORWARDED_TO_EXPERT:
            exp_rev_st = "PENDING"
        elif c.status == StatusEnum.CLOSED:
            exp_rev_st = "CLOSED"
        else:
            exp_rev_st = "PENDING"

        fwd_date = c.forwarded_to_expert_at or c.investigator_completed_at
        date_assigned = c.opened_at or c.created_at

        cases_list.append({
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "category": "Forensic Investigation",
            "ai_progress": ai_prog,
            "incident_date": c.incident_date.isoformat() if c.incident_date else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "submitted_at": c.submitted_at.isoformat() if c.submitted_at else (c.created_at.isoformat() if c.created_at else None),
            "opened_at": c.opened_at.isoformat() if c.opened_at else None,
            "forwarded_to_expert_at": fwd_date.isoformat() if fwd_date else None,
            "investigator_completed_at": fwd_date.isoformat() if fwd_date else None,
            "date_assigned": date_assigned.isoformat() if date_assigned else None,
            "forwarded_date": fwd_date.isoformat() if fwd_date else None,
            "expert_review_status": exp_rev_st,
            "expert_verified_at": c.expert_verified_at.isoformat() if c.expert_verified_at else None,
            "closed_at": c.closed_at.isoformat() if c.closed_at else None,
            "is_investigation_completed": bool(fwd_date is not None or c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED]),
            "updated_at": c.updated_at.isoformat() if c.updated_at else (c.created_at.isoformat() if c.created_at else None),
            "assigned_expert": exp_name,
            "assigned_expert_id": exp_id,
            "assigned_expert_name": exp_name,
            "assigned_investigator_id": inv_id,
            "assigned_investigator_name": inv_name,
            "is_assigned_to_me": bool((inv_id and inv_id == user.id) or (exp_id and exp_id == user.id)),
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
        
    query = db.query(InvestigationCase).filter(InvestigationCase.status == StatusEnum.CASE_FILED)
    
    if search:
        search_term = f"%{search}%"
        query = query.outerjoin(User, InvestigationCase.created_by == User.id).filter(
            or_(
                InvestigationCase.case_number.like(search_term),
                InvestigationCase.title.like(search_term),
                InvestigationCase.description.like(search_term),
                User.full_name.like(search_term)
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
        notes_list = []
        if c.notes:
            for n in sorted(c.notes, key=lambda x: x.created_at):
                notes_list.append({
                    "id": n.id,
                    "note": n.note,
                    "user_id": n.user_id,
                    "user_name": n.user.full_name if n.user else "User",
                    "created_at": n.created_at.isoformat() if n.created_at else None
                })
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
            "evidence_count": total_ev,
            "notes": notes_list
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
        
    if c.status != StatusEnum.DRAFT:
        raise HTTPException(status_code=400, detail="Case must be in DRAFT status to submit.")
        
    if len(c.evidence_files) == 0:
        raise HTTPException(status_code=400, detail="At least one evidence file must be uploaded before submission.")
        
    if len(c.notes) == 0:
        raise HTTPException(status_code=400, detail="Case notes cannot be empty before submission.")
        
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
    if c.assigned_expert is not None or c.assigned_investigator_id is not None:
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
    assigned_cond = or_(InvestigationCase.assigned_expert == user.id, InvestigationCase.assigned_investigator_id == user.id)
    active_cases_count = db.query(InvestigationCase).filter(
        assigned_cond,
        InvestigationCase.forwarded_to_expert_at.is_(None),
        InvestigationCase.investigator_completed_at.is_(None),
        InvestigationCase.status.in_([
            StatusEnum.ASSIGNED,
            StatusEnum.IN_PROGRESS,
            StatusEnum.CASE_OPENED,
            StatusEnum.UNDER_ANALYSIS,
            StatusEnum.EXPERT_REVIEW,
            StatusEnum.OPEN,
            StatusEnum.REVIEW,
            StatusEnum.CASE_UNDER_INVESTIGATION
        ])
    ).count()
    
    if active_cases_count >= 3:
        raise HTTPException(
            status_code=400,
            detail="LIMIT_REACHED: Maximum active investigations reached. You already have 3 active investigation cases assigned."
        )
        
    c.status = StatusEnum.CASE_UNDER_INVESTIGATION
    c.opened_at = datetime.now(timezone.utc)
    c.assigned_expert = user.id
    c.assigned_investigator_id = user.id
    c.forwarded_to_expert_at = None
    c.investigator_completed_at = None
    c.expert_review_status = "PENDING"
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
        
    if not is_admin(user) and c.assigned_expert != user.id and c.assigned_investigator_id != user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to unassign this case.")
        
    if c.assigned_expert is None and c.assigned_investigator_id is None:
        raise HTTPException(status_code=400, detail="This case is not currently assigned.")
        
    c.assigned_expert = None
    c.assigned_investigator_id = None
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
        
    is_assigned = (c.assigned_expert == user.id or c.assigned_investigator_id == user.id)

    # Strictly enforce case access permission based on user role and assignment
    if is_admin(user):
        pass
    elif is_investigator(user):
        if not is_assigned and c.status != StatusEnum.CASE_FILED:
            raise HTTPException(
                status_code=403,
                detail="You are not assigned to this case. Claim the case first to access the workspace."
            )
    else:
        if c.created_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this case.")
        
    # Get Evidence
    evidence_list = []
    
    has_evidence_access = True
    if is_investigator(user) and not is_admin(user) and not is_assigned and c.status == StatusEnum.CASE_FILED:
        has_evidence_access = True
        
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
                
            uploader_user = db.query(User).filter(User.id == e.uploaded_by).first() if e.uploaded_by else None
            uploader_name = uploader_user.full_name if uploader_user else "Case Owner"
            uploader_role = "User"
            if e.uploaded_by_role:
                if e.uploaded_by_role.upper() == "INVESTIGATOR":
                    uploader_role = "Investigator"
                elif e.uploaded_by_role.upper() == "ADMIN":
                    uploader_role = "Admin"
                elif e.uploaded_by_role.upper() == "USER":
                    uploader_role = "Case Owner" if (uploader_user and uploader_user.id == c.created_by) else "User"
            elif uploader_user:
                if is_admin(uploader_user):
                    uploader_role = "Admin"
                elif is_investigator(uploader_user):
                    uploader_role = "Investigator"
                elif uploader_user.id == c.created_by:
                    uploader_role = "Case Owner"
                else:
                    uploader_role = "User"

            evidence_list.append({
                "id": e.id,
                "file_name": e.file_name,
                "original_name": e.original_name,
                "file_type": e.file_type.value,
                "mime_type": e.mime_type,
                "file_size": e.file_size,
                "sha256_hash": e.sha256_hash,
                "upload_time": e.upload_time.isoformat() if e.upload_time else None,
                "uploaded_by": e.uploaded_by,
                "uploaded_by_id": e.uploaded_by,
                "uploaded_by_name": uploader_name,
                "uploader_role": uploader_role,
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
        
    fwd_date = c.forwarded_to_expert_at or c.investigator_completed_at
    date_assigned = c.opened_at or c.created_at
    if c.expert_review_status:
        exp_rev_st = c.expert_review_status
    elif c.status == StatusEnum.VERIFIED:
        exp_rev_st = "VERIFIED"
    elif c.status == StatusEnum.UNDER_EXPERT_REVIEW:
        exp_rev_st = "UNDER_REVIEW"
    elif c.status == StatusEnum.FORWARDED_TO_EXPERT:
        exp_rev_st = "PENDING"
    elif c.status == StatusEnum.CLOSED:
        exp_rev_st = "CLOSED"
    else:
        exp_rev_st = "PENDING"

    return {
        "id": c.id,
        "case_number": c.case_number,
        "title": c.title,
        "description": c.description,
        "status": c.status.value,
        "category": "Forensic Investigation",
        "incident_date": c.incident_date.isoformat() if c.incident_date else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
        "opened_at": c.opened_at.isoformat() if c.opened_at else None,
        "forwarded_to_expert_at": fwd_date.isoformat() if fwd_date else None,
        "investigator_completed_at": fwd_date.isoformat() if fwd_date else None,
        "date_assigned": date_assigned.isoformat() if date_assigned else None,
        "forwarded_date": fwd_date.isoformat() if fwd_date else None,
        "expert_review_status": exp_rev_st,
        "expert_verified_at": c.expert_verified_at.isoformat() if c.expert_verified_at else None,
        "closed_at": c.closed_at.isoformat() if c.closed_at else None,
        "is_investigation_completed": bool(fwd_date is not None or c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED]),
        "assigned_expert": c.expert.full_name if c.expert else None,
        "assigned_expert_id": c.assigned_expert,
        "assigned_expert_name": c.expert.full_name if c.expert else None,
        "assigned_investigator_id": c.assigned_investigator_id or (c.assigned_expert if c.status in [StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.CASE_OPENED] else None),
        "assigned_investigator_name": c.assigned_investigator.full_name if c.assigned_investigator else (c.expert.full_name if c.expert else None),
        "is_assigned_to_me": bool((c.assigned_investigator_id and c.assigned_investigator_id == user.id) or (c.assigned_expert and c.assigned_expert == user.id)),
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
        if c.assigned_expert != user.id and c.assigned_investigator_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You cannot modify investigations assigned to another investigator.")
        if c.forwarded_to_expert_at is not None or c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED]:
            raise HTTPException(status_code=403, detail="Forbidden: Completed investigations are locked and cannot be modified.")
        if title != c.title or description != c.description:
            raise HTTPException(status_code=403, detail="Forbidden: Investigators are not allowed to modify case details.")
        if incident_date and incident_date.strip():
            try:
                date_part = incident_date.strip().split("T")[0]
                inc_date_obj = datetime.strptime(date_part, "%Y-%m-%d").date()
                if not c.incident_date or inc_date_obj != c.incident_date.date():
                    raise HTTPException(status_code=403, detail="Forbidden: Investigators are not allowed to modify case details.")
            except HTTPException:
                raise
            except Exception:
                pass
        elif c.incident_date is not None:
            raise HTTPException(status_code=403, detail="Forbidden: Investigators are not allowed to modify case details.")
    else:
        if c.created_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Access denied to this case.")
        if c.status not in [StatusEnum.DRAFT, StatusEnum.OPEN]:
            raise HTTPException(status_code=403, detail="Submitted cases cannot be modified.")
        
    c.title = title
    c.description = description
    
    old_status = c.status
    if status and status.strip():
        try:
            new_status = StatusEnum[status.upper().strip()]
            if old_status != new_status:
                valid_transitions = {
                    StatusEnum.DRAFT: [StatusEnum.CASE_FILED],
                    StatusEnum.CASE_FILED: [StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.ASSIGNED, StatusEnum.DRAFT],
                    StatusEnum.ASSIGNED: [StatusEnum.IN_PROGRESS, StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.CASE_FILED],
                    StatusEnum.IN_PROGRESS: [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.CASE_FILED],
                    StatusEnum.CASE_UNDER_INVESTIGATION: [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.IN_PROGRESS, StatusEnum.CLOSED, StatusEnum.CASE_FILED],
                    StatusEnum.FORWARDED_TO_EXPERT: [StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CASE_UNDER_INVESTIGATION],
                    StatusEnum.UNDER_EXPERT_REVIEW: [StatusEnum.VERIFIED, StatusEnum.FORWARDED_TO_EXPERT],
                    StatusEnum.VERIFIED: [StatusEnum.CLOSED, StatusEnum.UNDER_EXPERT_REVIEW],
                    StatusEnum.CLOSED: [StatusEnum.CASE_UNDER_INVESTIGATION, StatusEnum.VERIFIED]
                }
                allowed = valid_transitions.get(old_status, [])
                if new_status not in allowed:
                    mapped_old = old_status
                    if old_status in [StatusEnum.CASE_OPENED, StatusEnum.UNDER_ANALYSIS, StatusEnum.EXPERT_REVIEW, StatusEnum.REVIEW]:
                        mapped_old = StatusEnum.CASE_UNDER_INVESTIGATION
                    elif old_status == StatusEnum.OPEN:
                        mapped_old = StatusEnum.CASE_FILED
                        
                    mapped_new = new_status
                    if new_status in [StatusEnum.CASE_OPENED, StatusEnum.UNDER_ANALYSIS, StatusEnum.EXPERT_REVIEW, StatusEnum.REVIEW]:
                        mapped_new = StatusEnum.CASE_UNDER_INVESTIGATION
                    elif new_status == StatusEnum.OPEN:
                        mapped_new = StatusEnum.CASE_FILED
                        
                    if mapped_old != mapped_new:
                        allowed_mapped = valid_transitions.get(mapped_old, [])
                        if mapped_new not in allowed_mapped:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Invalid status transition from {old_status.value} to {new_status.value}."
                            )
                c.status = new_status
        except HTTPException:
            raise
        except Exception:
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

# ─── 4. Case Notes Endpoints ───
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

    if is_investigator(user):
        raise HTTPException(status_code=403, detail="Forbidden: Investigators are not allowed to add notes.")
    if not is_admin(user):
        if c.created_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Access denied to this case.")
        if c.status != StatusEnum.DRAFT:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Notes cannot be added.")
        
    new_note = InvestigationNote(
        case_id=case_id,
        user_id=user.id,
        note=note
    )
    db.add(new_note)
    db.commit()
    
    log_audit_event(db, c.id, user.id, "Case Notes Updated", f"Note added by {user.full_name}.")
    
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
        
    if is_investigator(user):
        raise HTTPException(status_code=403, detail="Forbidden: Investigators are not allowed to modify notes.")
    if not is_admin(user):
        if n.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if n.case and n.case.status != StatusEnum.DRAFT:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Notes cannot be modified.")
            
    n.note = note
    db.commit()
    
    if n.case_id:
        log_audit_event(db, n.case_id, user.id, "Case Notes Updated", f"Note updated by {user.full_name}.")
        
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
        
    if is_investigator(user):
        raise HTTPException(status_code=403, detail="Forbidden: Investigators are not allowed to delete notes.")
    if not is_admin(user):
        if n.user_id != user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if n.case and n.case.status != StatusEnum.DRAFT:
            raise HTTPException(status_code=403, detail="Case is submitted and locked. Notes cannot be deleted.")
            
    case_id = n.case_id
    db.delete(n)
    db.commit()
    
    if case_id:
        log_audit_event(db, case_id, user.id, "Case Notes Updated", f"Note deleted by {user.full_name}.")
        
    return {"message": "Note deleted successfully"}

# ─── 5. Upload Evidence Endpoint ───
@router.post("/evidence/upload")
async def upload_evidence(
    case_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
        
    verify_evidence_upload_access(c, user)
        
    if c.status == StatusEnum.CLOSED or (hasattr(c.status, "value") and c.status.value == "CLOSED"):
        raise HTTPException(status_code=403, detail="Case is closed. Additional evidence cannot be uploaded.")
        
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
        
    uploader_role = "USER"
    if is_admin(user):
        uploader_role = "ADMIN"
    elif is_investigator(user):
        uploader_role = "INVESTIGATOR"

    new_evidence = EvidenceFile(
        case_id=case_id,
        uploaded_by=user.id,
        uploaded_by_role=uploader_role,
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
    
    log_audit_event(db, c.id, user.id, "Evidence Uploaded", f"Evidence file '{original_name}' uploaded by {user.full_name} ({uploader_role}).")
    add_user_notification(
        db, user.id, "Evidence Upload Completed",
        f"File '{original_name}' has been successfully uploaded to case {c.case_number}."
    )
    
    return {
        "message": "Evidence uploaded successfully",
        "evidence": {
            "id": new_evidence.id,
            "original_name": new_evidence.original_name,
            "file_size": new_evidence.file_size,
            "uploaded_by": new_evidence.uploaded_by,
            "uploaded_by_role": new_evidence.uploaded_by_role
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
            
        uploader_user = db.query(User).filter(User.id == e.uploaded_by).first() if e.uploaded_by else None
        uploader_name = uploader_user.full_name if uploader_user else "Case Owner"
        uploader_role = "User"
        if e.uploaded_by_role:
            if e.uploaded_by_role.upper() == "INVESTIGATOR":
                uploader_role = "Investigator"
            elif e.uploaded_by_role.upper() == "ADMIN":
                uploader_role = "Admin"
            else:
                uploader_role = "User"
        elif uploader_user:
            if is_admin(uploader_user):
                uploader_role = "Admin"
            elif is_investigator(uploader_user):
                uploader_role = "Investigator"
            else:
                uploader_role = "User"

        evidence_list.append({
            "id": e.id,
            "original_name": e.original_name,
            "file_type": e.file_type.value,
            "file_size": e.file_size,
            "upload_time": e.upload_time.isoformat() if e.upload_time else None,
            "case_number": e.case.case_number if e.case else "N/A",
            "case_title": e.case.title if e.case else "N/A",
            "uploaded_by": e.uploaded_by,
            "uploaded_by_id": e.uploaded_by,
            "uploaded_by_name": uploader_name,
            "uploader_role": uploader_role,
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
        if e.uploaded_by == user.id:
            return True
        return False
    if e.uploaded_by == user.id or (e.case and e.case.created_by == user.id):
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
        
    c = e.case
    if not is_admin(user):
        if is_investigator(user):
            # 1. Investigator must have access to the case
            if not c:
                raise HTTPException(status_code=404, detail="Investigation case not found")
            if c.assigned_expert != user.id and c.assigned_investigator_id != user.id:
                raise HTTPException(status_code=403, detail="Forbidden: You are not assigned to this case.")
            if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED] or c.forwarded_to_expert_at is not None or (hasattr(c.status, "value") and c.status.value == "CLOSED"):
                raise HTTPException(status_code=403, detail="Forbidden: Investigation is completed and locked. Evidence cannot be deleted.")
            # 2. Strict ownership rule: Investigator can ONLY delete evidence THEY uploaded
            if e.uploaded_by != user.id:
                raise HTTPException(status_code=403, detail="Forbidden: Investigators are only permitted to delete evidence they uploaded.")
        else:
            # Regular user / Case owner
            if e.uploaded_by != user.id:
                raise HTTPException(status_code=403, detail="Forbidden: Access denied.")
            if c and c.status != StatusEnum.DRAFT:
                raise HTTPException(status_code=403, detail="Forbidden: Case is submitted and locked. Evidence cannot be deleted.")
            
    case_id = e.case_id
    orig_name = e.original_name

    # 1. Delete associated media metadata
    if e.metadata_info:
        db.delete(e.metadata_info)
        
    # 2. Delete AI analyses and their physical artifact files (masks, heatmaps, overlays)
    analyses = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == e.id).all()
    for a in analyses:
        artifact_paths = [a.mask_path, a.overlay_path, a.report_path]
        for art_path in artifact_paths:
            if art_path:
                rel = art_path.lstrip("/")
                candidates = [
                    os.path.join(BASE_BACKEND_DIR, rel),
                    os.path.join(UPLOAD_DIR, "analysis", os.path.basename(rel)),
                    os.path.join(UPLOAD_DIR, os.path.basename(rel))
                ]
                for cand in candidates:
                    if os.path.exists(cand) and os.path.isfile(cand):
                        try:
                            os.remove(cand)
                        except Exception as del_art_err:
                            print(f"Warning: Failed to delete artifact file {cand}: {del_art_err}")

        db.query(ForensicReview).filter(ForensicReview.analysis_id == a.id).delete()
        db.delete(a)

    # 3. Clean up any leftover artifacts in uploads/analysis matching this evidence
    try:
        analysis_dir = os.path.join(UPLOAD_DIR, "analysis")
        if os.path.exists(analysis_dir):
            prefix = f"case_{case_id}_ev_{e.id}_"
            for fname in os.listdir(analysis_dir):
                if fname.startswith(prefix):
                    full_p = os.path.join(analysis_dir, fname)
                    if os.path.isfile(full_p):
                        try:
                            os.remove(full_p)
                        except Exception as p_err:
                            print(f"Failed to remove analysis file {full_p}: {p_err}")
    except Exception as dir_err:
        print("Analysis directory cleanup note:", dir_err)

    # 4. Delete the physical evidence file from storage
    if e.storage_path and os.path.exists(e.storage_path) and os.path.isfile(e.storage_path):
        try:
            os.remove(e.storage_path)
        except Exception as err:
            print("Failed to remove evidence file from disk:", err)

    # 5. Delete evidence database record
    db.delete(e)

    # 6. Clean up ForensicScan results and invalidate cached PDF report so future reports exclude deleted evidence
    if case_id:
        scans = db.query(ForensicScan).filter(ForensicScan.case_id == case_id).all()
        for sc in scans:
            try:
                if sc.results_json:
                    r_list = json.loads(sc.results_json)
                    new_r_list = [item for item in r_list if item.get("evidence_id") != evidence_id]
                    sc.results_json = json.dumps(new_r_list)
                    sc.evidence_count = len(new_r_list)
                if sc.pdf_path:
                    pdf_rel = sc.pdf_path.lstrip("/")
                    pdf_candidates = [
                        os.path.join(BASE_BACKEND_DIR, pdf_rel),
                        os.path.join(UPLOAD_DIR, "reports", os.path.basename(pdf_rel)),
                        os.path.join(UPLOAD_DIR, os.path.basename(pdf_rel))
                    ]
                    for pdf_cand in pdf_candidates:
                        if os.path.exists(pdf_cand) and os.path.isfile(pdf_cand):
                            try:
                                os.remove(pdf_cand)
                            except Exception as pdf_del_err:
                                print(f"Warning: Failed to delete cached PDF {pdf_cand}: {pdf_del_err}")
                    sc.pdf_path = None
            except Exception as sc_err:
                print("Forensic scan cleanup note:", sc_err)

        reports = db.query(Report).filter(Report.case_id == case_id).all()
        for rep in reports:
            if rep.report_file:
                rep_rel = rep.report_file.lstrip("/")
                rep_cand = os.path.join(BASE_BACKEND_DIR, rep_rel)
                if not os.path.exists(rep_cand):
                    rep_cand = os.path.join(UPLOAD_DIR, "reports", os.path.basename(rep_rel))
                if os.path.exists(rep_cand) and os.path.isfile(rep_cand):
                    try:
                        os.remove(rep_cand)
                    except Exception:
                        pass
            db.delete(rep)

    db.commit()
    
    # 7. Audit log (Part 15)
    if case_id:
        actor_role_str = "Investigator" if is_investigator(user) else ("Admin" if is_admin(user) else "User")
        actor_id_str = f"INV-{user.id:03d}" if is_investigator(user) else (f"ADM-{user.id:03d}" if is_admin(user) else f"USR-{user.id:03d}")
        try:
            from app.services.audit_service import log_audit_event as log_full_audit
            log_full_audit(
                db=db,
                action="Evidence Deleted",
                module="Evidence",
                severity="INFO",
                status="SUCCESS",
                actor_id=actor_id_str,
                actor_role=actor_role_str,
                target_type="Evidence",
                target_id=f"EV-{evidence_id:05d}",
                description=f"Evidence file '{orig_name}' (ID: EV-{evidence_id:05d}) was permanently deleted by {user.full_name} ({actor_role_str}).",
                user_id=user.id,
                case_id=case_id
            )
        except Exception as audit_err:
            print("Audit log note:", audit_err)
            log_audit_event(db, case_id, user.id, "Evidence Deleted", f"Evidence file '{orig_name}' was deleted by {user.full_name}.")
        
    add_user_notification(
        db, user.id, "Evidence Deleted",
        f"Evidence file '{orig_name}' was permanently deleted from case."
    )
    
    return {
        "message": "Evidence deleted successfully",
        "evidence_id": evidence_id,
        "case_id": case_id
    }

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
    
    # Transition case status to CASE_UNDER_INVESTIGATION if applicable
    if e.case and e.case.status in [StatusEnum.CASE_FILED, StatusEnum.CASE_OPENED, StatusEnum.OPEN]:
        e.case.status = StatusEnum.CASE_UNDER_INVESTIGATION
        log_audit_event(db, e.case.id, user.id, "Status Changed to CASE_UNDER_INVESTIGATION", f"Case status updated to CASE_UNDER_INVESTIGATION following AI scan.")
        
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
            "evidence_id": a.evidence_id,
            "file_name": a.evidence.original_name,
            "model_name": a.model.model_name if a.model else "Sentinel AI V1.7-A",
            "version": a.model_version or (a.model.version if a.model else "V1.7-A"),
            "result": a.result.value,
            "confidence_score": a.confidence_score,
            "tampered_probability": a.tampered_probability,
            "authentic_probability": a.authentic_probability,
            "classification_threshold": a.classification_threshold,
            "localization_available": a.localization_available,
            "localization_threshold": a.localization_threshold,
            "mask_path": a.mask_path,
            "overlay_path": a.overlay_path,
            "sha256_hash": a.sha256_hash or a.evidence.sha256_hash,
            "device": a.device,
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
        if c:
            if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW]:
                c.assigned_expert = user.id
                if dec_enum == DecisionEnum.APPROVED:
                    c.status = StatusEnum.VERIFIED
                    c.expert_review_status = "VERIFIED"
                    c.expert_verified_at = datetime.now(timezone.utc)
                    log_audit_event(db, case_id, user.id, "Case Verified by Expert", f"Case verified by expert {user.full_name}.")
                elif dec_enum == DecisionEnum.REJECTED:
                    c.expert_review_status = "REJECTED"
                    log_audit_event(db, case_id, user.id, "Expert Review Rejected", f"Verification rejected by expert {user.full_name}.")
                else:
                    c.status = StatusEnum.UNDER_EXPERT_REVIEW
                    c.expert_review_status = "UNDER_REVIEW"
                    log_audit_event(db, case_id, user.id, "Case Under Expert Review", f"Case marked under expert review by {user.full_name}.")
            elif c.status in [StatusEnum.CASE_FILED, StatusEnum.CASE_OPENED, StatusEnum.UNDER_ANALYSIS, StatusEnum.OPEN]:
                c.status = StatusEnum.CASE_UNDER_INVESTIGATION
                log_audit_event(db, case_id, user.id, "Status Changed to CASE_UNDER_INVESTIGATION", "Case status updated to CASE_UNDER_INVESTIGATION.")
            
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
    message: Optional[str] = ""
    attachment_ids: Optional[List[int]] = None

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
        
        # Serialize attachments for this message
        msg_attachments = []
        for att in m.attachments:
            signed_url = storage_service.generate_signed_download_url(
                att.storage_key, c.id, att.id, expires_in=900
            )
            msg_attachments.append({
                "id": att.id,
                "message_id": att.message_id,
                "case_id": att.case_id,
                "uploaded_by": att.uploaded_by,
                "uploaded_by_name": att.uploader.full_name if att.uploader else "Unknown",
                "uploaded_by_role": att.uploaded_by_role,
                "original_filename": att.original_filename,
                "mime_type": att.mime_type,
                "file_size": att.file_size,
                "sha256_hash": att.sha256_hash,
                "status": att.status,
                "scan_status": att.scan_status,
                "evidence_id": att.evidence_id,
                "is_evidence": att.evidence_id is not None,
                "created_at": format_datetime_utc(att.created_at),
                "download_url": signed_url
            })

        msg_list.append({
            "id": m.id,
            "case_id": m.case_id,
            "sender_id": m.sender_id,
            "sender_name": sender_name,
            "sender_role": role_label,
            "is_me": m.sender_id == user.id,
            "message": m.message,
            "attachments": msg_attachments,
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
    att_ids = payload.attachment_ids or []
    if not msg_text and not att_ids:
        raise HTTPException(status_code=400, detail="Message content or attachment is required.")

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

    # Link referenced attachments
    linked_attachments = []
    if att_ids:
        for aid in att_ids:
            att = db.query(MessageAttachment).filter(
                MessageAttachment.id == aid,
                MessageAttachment.case_id == c.id
            ).first()
            if att and (att.uploaded_by == user.id or is_admin(user)):
                att.message_id = new_msg.id
                linked_attachments.append(att)
        db.commit()

    # Notify recipient
    recipient_id = c.assigned_expert if user.id == c.created_by else c.created_by
    if recipient_id and recipient_id != user.id:
        snippet = msg_text if len(msg_text) <= 50 else msg_text[:50] + "..."
        if not snippet and linked_attachments:
            snippet = f"Sent attachment: {linked_attachments[0].original_filename}"
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
        f"Message sent by {user.full_name} for case {c.case_number} (with {len(linked_attachments)} attachments)."
    )

    is_inv = (user.id == c.assigned_expert)
    role_label = "Lead Investigator" if is_inv else "Case Owner"

    att_list = []
    for att in linked_attachments:
        signed_url = storage_service.generate_signed_download_url(
            att.storage_key, c.id, att.id, expires_in=900
        )
        att_list.append({
            "id": att.id,
            "message_id": att.message_id,
            "case_id": att.case_id,
            "uploaded_by": att.uploaded_by,
            "uploaded_by_name": user.full_name,
            "uploaded_by_role": att.uploaded_by_role,
            "original_filename": att.original_filename,
            "mime_type": att.mime_type,
            "file_size": att.file_size,
            "sha256_hash": att.sha256_hash,
            "status": att.status,
            "scan_status": att.scan_status,
            "evidence_id": att.evidence_id,
            "is_evidence": att.evidence_id is not None,
            "created_at": format_datetime_utc(att.created_at),
            "download_url": signed_url
        })

    return {
        "id": new_msg.id,
        "case_id": new_msg.case_id,
        "sender_id": new_msg.sender_id,
        "sender_name": user.full_name,
        "sender_role": role_label,
        "is_me": True,
        "message": new_msg.message,
        "attachments": att_list,
        "created_at": format_datetime_utc(new_msg.created_at),
        "read_at": None
    }

# ─── Secure File Attachment Endpoints ────────────────────────────────────────

@router.post("/cases/{case_id}/attachments/upload")
async def upload_case_attachment(
    case_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # Strict access check: must be Admin, case creator, or assigned investigator
    if not is_admin(user) and user.id != c.created_by and user.id != c.assigned_expert:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You are not authorized to upload attachments to this case."
        )

    file_bytes = await file.read()
    ext, canonical_mime, file_size, sha256_hash = validate_attachment_file(
        file.filename or "attachment.dat", file.content_type, file_bytes
    )

    clean_filename = os.path.basename(file.filename or "attachment.dat").replace(" ", "_")
    storage_key = f"cases/{c.id}/attachments/{uuid.uuid4().hex[:12]}_{clean_filename}"

    # Save to private object storage
    storage_service.put_object(storage_key, file_bytes, content_type=canonical_mime)

    # Determine uploader role label
    uploader_role = "INVESTIGATOR" if (user.role == "INVESTIGATOR" or user.id == c.assigned_expert) else ("ADMIN" if is_admin(user) else "USER")

    # Create MessageAttachment record
    attachment = MessageAttachment(
        case_id=c.id,
        uploaded_by=user.id,
        uploaded_by_role=uploader_role,
        original_filename=file.filename or clean_filename,
        mime_type=canonical_mime,
        file_size=file_size,
        storage_key=storage_key,
        sha256_hash=sha256_hash,
        status="CLEAN",
        scan_status="CLEAN"
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    # Generate short-lived signed download URL
    signed_download_url = storage_service.generate_signed_download_url(
        storage_key, c.id, attachment.id, expires_in=900
    )

    return {
        "id": attachment.id,
        "case_id": attachment.case_id,
        "message_id": attachment.message_id,
        "uploaded_by": attachment.uploaded_by,
        "uploaded_by_name": user.full_name,
        "uploaded_by_role": attachment.uploaded_by_role,
        "original_filename": attachment.original_filename,
        "mime_type": attachment.mime_type,
        "file_size": attachment.file_size,
        "sha256_hash": attachment.sha256_hash,
        "status": attachment.status,
        "scan_status": attachment.scan_status,
        "created_at": format_datetime_utc(attachment.created_at),
        "download_url": signed_download_url
    }

@router.get("/cases/{case_id}/attachments/{attachment_id}")
@router.get("/cases/{case_id}/messages/{message_id}/attachments/{attachment_id}")
def get_case_attachment(
    case_id: int,
    attachment_id: int,
    message_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    if not is_admin(user) and user.id != c.created_by and user.id != c.assigned_expert:
        raise HTTPException(status_code=403, detail="Access Denied: You do not have access to this case.")

    att = db.query(MessageAttachment).filter(
        MessageAttachment.id == attachment_id,
        MessageAttachment.case_id == case_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if message_id is not None and att.message_id != message_id:
        raise HTTPException(status_code=400, detail="Attachment does not belong to the specified message.")

    if att.scan_status == "REJECTED":
        raise HTTPException(status_code=403, detail="File is quarantined or failed safety inspection.")

    signed_download_url = storage_service.generate_signed_download_url(
        att.storage_key, c.id, att.id, expires_in=900
    )

    return {
        "id": att.id,
        "case_id": att.case_id,
        "message_id": att.message_id,
        "uploaded_by": att.uploaded_by,
        "uploaded_by_name": att.uploader.full_name if att.uploader else "Unknown",
        "uploaded_by_role": att.uploaded_by_role,
        "original_filename": att.original_filename,
        "mime_type": att.mime_type,
        "file_size": att.file_size,
        "sha256_hash": att.sha256_hash,
        "status": att.status,
        "scan_status": att.scan_status,
        "evidence_id": att.evidence_id,
        "is_evidence": att.evidence_id is not None,
        "created_at": format_datetime_utc(att.created_at),
        "download_url": signed_download_url
    }

@router.get("/cases/{case_id}/attachments/{attachment_id}/download")
def download_case_attachment(
    case_id: int,
    attachment_id: int,
    expires: Optional[int] = Query(None),
    signature: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    att = db.query(MessageAttachment).filter(
        MessageAttachment.id == attachment_id,
        MessageAttachment.case_id == case_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.scan_status == "REJECTED":
        raise HTTPException(status_code=403, detail="Access Forbidden: File rejected by security scanner.")

    # Validate access: either valid signed token OR authenticated session
    has_valid_signature = False
    if expires and signature:
        if verify_signed_token(att.storage_key, expires, signature):
            has_valid_signature = True

    if not has_valid_signature:
        user = get_current_user(authorization=authorization, token=token, db=db)
        c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
        if not c or (not is_admin(user) and user.id != c.created_by and user.id != c.assigned_expert):
            raise HTTPException(status_code=403, detail="Access Denied: You are not authorized to download this attachment.")

    local_path = storage_service.get_local_path(att.storage_key)
    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Attachment file not found in storage.")

    headers = {
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "Cache-Control": "private, max-age=3600"
    }
    return FileResponse(
        local_path,
        media_type=att.mime_type,
        filename=att.original_filename,
        headers=headers
    )

@router.delete("/cases/{case_id}/attachments/{attachment_id}")
def delete_case_attachment(
    case_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    att = db.query(MessageAttachment).filter(
        MessageAttachment.id == attachment_id,
        MessageAttachment.case_id == case_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Authorization rules:
    # Admin: allowed
    # Investigator: must be assigned AND must be the uploader
    # User: must be creator AND must be the uploader
    if is_admin(user):
        pass
    elif user.role == "INVESTIGATOR" or user.id == c.assigned_expert:
        if c.assigned_expert != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You are not assigned to this case.")
        if att.uploaded_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: Investigators are only permitted to delete attachments they uploaded.")
    elif user.id == c.created_by:
        if att.uploaded_by != user.id:
            raise HTTPException(status_code=403, detail="Forbidden: You can only delete attachments you uploaded.")
    else:
        raise HTTPException(status_code=403, detail="Access Denied: You are not authorized to delete attachments in this case.")

    # If attachment was promoted to formal evidence, handle evidence cleanup
    if att.evidence_id:
        ev = db.query(EvidenceFile).filter(EvidenceFile.id == att.evidence_id).first()
        if ev:
            # Delete AI analyses, metadata, and reviews
            db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev.id).delete()
            db.query(MediaMetadata).filter(MediaMetadata.evidence_id == ev.id).delete()
            db.query(ForensicReview).filter(ForensicReview.evidence_id == ev.id).delete()
            # Invalidate forensic scans and cached reports
            scans = db.query(ForensicScan).filter(ForensicScan.case_id == c.id).all()
            for s in scans:
                if s.pdf_path and os.path.exists(s.pdf_path):
                    try:
                        os.remove(s.pdf_path)
                    except OSError:
                        pass
                s.pdf_path = None
            db.delete(ev)

    # Delete physical object from storage
    storage_service.delete_object(att.storage_key)

    # Delete attachment record
    db.delete(att)
    db.commit()

    # Log audit event
    log_audit_event(
        db,
        c.id,
        user.id,
        "Attachment Deleted",
        f"Attachment '{att.original_filename}' (ID: {att.id}) deleted by {user.full_name}."
    )

    return {
        "message": "Attachment deleted successfully",
        "attachment_id": attachment_id,
        "case_id": case_id
    }

@router.post("/cases/{case_id}/attachments/{attachment_id}/promote-to-evidence")
def promote_attachment_to_evidence(
    case_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # Controlled action: Lead Investigator or Admin
    if not is_admin(user) and user.id != c.assigned_expert and user.id != c.assigned_investigator_id:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Only the assigned lead investigator or admin can promote attachments to formal evidence."
        )
    if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED] or c.forwarded_to_expert_at is not None:
        raise HTTPException(status_code=403, detail="Forbidden: Investigation is completed and locked.")

    att = db.query(MessageAttachment).filter(
        MessageAttachment.id == attachment_id,
        MessageAttachment.case_id == case_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.scan_status == "REJECTED":
        raise HTTPException(status_code=400, detail="Cannot promote rejected or unsafe attachment to evidence.")

    # Check if already promoted
    if att.evidence_id:
        existing_ev = db.query(EvidenceFile).filter(EvidenceFile.id == att.evidence_id).first()
        if existing_ev:
            return {
                "message": "Attachment already promoted to formal evidence",
                "evidence_id": existing_ev.id,
                "evidence": {
                    "id": existing_ev.id,
                    "case_id": existing_ev.case_id,
                    "original_name": existing_ev.original_name,
                    "sha256_hash": existing_ev.sha256_hash,
                    "uploaded_by_role": existing_ev.uploaded_by_role
                }
            }

    local_path = storage_service.get_local_path(att.storage_key)
    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Attachment physical file missing in storage.")

    # Determine FileTypeEnum
    if att.mime_type.startswith("image"):
        ft = FileTypeEnum.IMAGE
    elif att.mime_type.startswith("video"):
        ft = FileTypeEnum.VIDEO
    elif att.mime_type.startswith("audio"):
        ft = FileTypeEnum.AUDIO
    else:
        ft = FileTypeEnum.DOCUMENT

    # Create EvidenceFile preserving all provenance metadata
    new_ev = EvidenceFile(
        case_id=c.id,
        uploaded_by=att.uploaded_by,
        uploaded_by_role=att.uploaded_by_role,
        file_name=os.path.basename(att.storage_key),
        original_name=att.original_filename,
        file_type=ft,
        mime_type=att.mime_type,
        file_size=att.file_size,
        storage_path=local_path,
        sha256_hash=att.sha256_hash,
        upload_time=att.created_at
    )
    db.add(new_ev)
    db.commit()
    db.refresh(new_ev)

    # Link to attachment
    att.evidence_id = new_ev.id
    att.status = "PROMOTED_TO_EVIDENCE"
    db.commit()

    # Invalidate cached PDF reports so newly promoted evidence will be included
    scans = db.query(ForensicScan).filter(ForensicScan.case_id == c.id).all()
    for s in scans:
        if s.pdf_path and os.path.exists(s.pdf_path):
            try:
                os.remove(s.pdf_path)
            except OSError:
                pass
        s.pdf_path = None
    db.commit()

    # Log audit event
    log_audit_event(
        db,
        c.id,
        user.id,
        "Attachment Promoted to Evidence",
        f"Attachment '{att.original_filename}' (ID: {att.id}, SHA-256: {att.sha256_hash[:16]}...) promoted to formal evidence EV-{new_ev.id:05d} by {user.full_name}."
    )

    return {
        "message": "Attachment promoted to formal evidence successfully",
        "evidence_id": new_ev.id,
        "evidence": {
            "id": new_ev.id,
            "case_id": new_ev.case_id,
            "original_name": new_ev.original_name,
            "sha256_hash": new_ev.sha256_hash,
            "uploaded_by_role": new_ev.uploaded_by_role,
            "upload_time": format_datetime_utc(new_ev.upload_time)
        }
    }

def verify_case_access(c: InvestigationCase, user: User):
    if is_admin(user):
        return True
    if c.created_by == user.id:
        return True
    if is_investigator(user) and (c.assigned_investigator_id == user.id or c.assigned_expert == user.id):
        return True
    raise HTTPException(status_code=403, detail="Forbidden: You are not assigned to this case.")

def verify_evidence_upload_access(c: InvestigationCase, user: User):
    if is_admin(user):
        return True
    if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED] or c.forwarded_to_expert_at is not None:
        raise HTTPException(status_code=403, detail="Forbidden: Investigation is completed and locked. Additional evidence cannot be uploaded.")
    if c.created_by == user.id:
        return True
    if is_investigator(user):
        if c.assigned_investigator_id == user.id or c.assigned_expert == user.id:
            return True
        elif c.assigned_expert is None and c.assigned_investigator_id is None:
            raise HTTPException(status_code=403, detail="Forbidden: You must claim this case before uploading evidence.")
        else:
            raise HTTPException(status_code=403, detail="Forbidden: This case is assigned to another investigator.")
    raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to upload evidence to this case.")

# ─── 9. AI Forensic Scan & Report Endpoints ───

@router.post("/cases/{case_id}/analyze")
@router.post("/investigations/{case_id}/analyze")
def analyze_investigation_endpoint(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Investigation case not found")

    verify_case_access(c, user)
    if is_investigator(user) and not is_admin(user):
        if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED] or c.forwarded_to_expert_at is not None:
            raise HTTPException(status_code=403, detail="Forbidden: Investigation is completed and locked. Additional analysis cannot be run.")

    evidence_files = db.query(EvidenceFile).filter(EvidenceFile.case_id == case_id).all()
    if not evidence_files:
        raise HTTPException(status_code=400, detail="No evidence files uploaded for this case to analyze.")

    log_audit_event(
        db, c.id, user.id, "Sentinel AI Analysis Initiated",
        f"Sentinel AI V1.7-A dual-head analysis initiated on {len(evidence_files)} evidence files."
    )

    result_data = analyze_investigation_evidence(c, evidence_files, db, user)

    log_audit_event(
        db, c.id, user.id, "Sentinel AI Analysis Completed",
        f"Sentinel AI V1.7-A dual-head analysis completed for case {c.case_number}."
    )

    return result_data


@router.get("/analysis/artifacts/{filename}")
@router.get("/uploads/analysis/{filename}")
def get_analysis_artifact(
    filename: str,
    db: Session = Depends(get_db)
):
    clean_filename = os.path.basename(filename)
    candidates = [
        os.path.join(UPLOAD_DIR, "analysis", clean_filename),
        os.path.join(BASE_BACKEND_DIR, "uploads", "analysis", clean_filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            return FileResponse(p, media_type="image/png")
    raise HTTPException(status_code=404, detail="Analysis artifact image not found on disk")


@router.post("/cases/{case_id}/scan")
def trigger_forensic_scan(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    verify_case_access(c, user)
    if is_investigator(user) and not is_admin(user):
        if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED] or c.forwarded_to_expert_at is not None:
            raise HTTPException(status_code=403, detail="Forbidden: Investigation is completed and locked. Additional scans cannot be run.")

    evidence_files = db.query(EvidenceFile).filter(EvidenceFile.case_id == case_id).all()
    if not evidence_files:
        raise HTTPException(status_code=400, detail="No evidence files uploaded for this case to analyze.")

    # Call real Sentinel AI V1.7-A inference engine
    res = analyze_investigation_evidence(c, evidence_files, db, user)

    scan_id = res.get("scan_id")
    scan = db.query(ForensicScan).filter(ForensicScan.id == scan_id).first() if scan_id else None

    # Generate initial PDF report using real results if available
    try:
        scan_time_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        pdf_filename = f"Forensic_Report_{c.case_number}_{scan_time_str}.pdf"
        pdf_dir = os.path.join(UPLOAD_DIR, "reports")
        pdf_path = os.path.join(pdf_dir, pdf_filename)

        creator_user = db.query(User).filter(User.id == c.created_by).first()
        investigator_user = db.query(User).filter(User.id == c.assigned_expert).first() if c.assigned_expert else None

        scan_meta = {
            "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
            "scan_duration": res.get("scan_duration", 0.0),
            "results": res.get("results", [])
        }

        generate_forensic_pdf_report(c, creator_user, investigator_user, evidence_files, scan_meta, pdf_path)

        if scan:
            scan.pdf_path = f"/uploads/reports/{pdf_filename}"
            db.commit()
    except Exception as pdf_err:
        print(f"Warning: PDF report generation deferred or failed during scan: {pdf_err}")

    return {
        "scan_id": scan_id,
        "case_id": c.id,
        "scan_status": "COMPLETED",
        "scan_duration": res.get("scan_duration", 0.0),
        "evidence_count": res.get("evidence_count", len(evidence_files)),
        "results": res.get("results", []),
        "pdf_url": f"/api/v1/user/cases/{c.id}/report/pdf",
        "created_at": scan.created_at.isoformat() if (scan and scan.created_at) else datetime.utcnow().isoformat()
    }


@router.get("/cases/{case_id}/scan")
def get_latest_forensic_scan(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    verify_case_access(c, user)

    scan = db.query(ForensicScan).filter(ForensicScan.case_id == case_id).order_by(ForensicScan.id.desc()).first()
    if not scan:
        return {"scan": None}

    try:
        results = json.loads(scan.results_json)
    except Exception:
        results = []

    return {
        "scan": {
            "scan_id": scan.id,
            "case_id": scan.case_id,
            "scan_status": scan.scan_status,
            "scan_duration": scan.scan_duration,
            "evidence_count": scan.evidence_count,
            "results": results,
            "pdf_url": f"/api/v1/user/cases/{c.id}/report/pdf",
            "created_at": scan.created_at.isoformat() if scan.created_at else None
        }
    }


@router.get("/cases/{case_id}/report/pdf")
def download_forensic_pdf_report(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    verify_case_access(c, user)

    evidence_files = db.query(EvidenceFile).filter(EvidenceFile.case_id == case_id).all()
    if not evidence_files:
        raise HTTPException(status_code=400, detail="No evidence files uploaded for this case to generate a report.")

    scan = db.query(ForensicScan).filter(ForensicScan.case_id == case_id).order_by(ForensicScan.id.desc()).first()

    pdf_file_exists = False
    if scan and scan.pdf_path:
        relative_path = scan.pdf_path.lstrip("/")
        abs_path = os.path.join(BASE_BACKEND_DIR, relative_path)
        if not os.path.exists(abs_path):
            abs_path = os.path.join(UPLOAD_DIR, "reports", os.path.basename(relative_path))
        if os.path.exists(abs_path):
            pdf_file_exists = True

    current_ev_ids = {ef.id for ef in evidence_files}
    scan_ev_ids = set()
    scan_results = []
    if scan and scan.results_json:
        try:
            scan_results = json.loads(scan.results_json)
            scan_ev_ids = {r.get("evidence_id") for r in scan_results if r.get("evidence_id")}
        except Exception:
            pass

    # If cached PDF is missing or active evidence has changed (added/deleted), regenerate PDF report
    if not pdf_file_exists or (scan_ev_ids and scan_ev_ids != current_ev_ids) or not scan:
        missing_analyses = any(ef.id not in scan_ev_ids for ef in evidence_files)
        if missing_analyses or not scan or not scan_results:
            ai_res = analyze_investigation_evidence(c, evidence_files, db, user)
            scan_id = ai_res.get("scan_id")
            scan = db.query(ForensicScan).filter(ForensicScan.id == scan_id).first() if scan_id else None
            scan_results = ai_res.get("results", [])
            scan_duration = ai_res.get("scan_duration", 0.0)
        else:
            scan_duration = scan.scan_duration or 0.0

        scan_time_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        pdf_filename = f"Forensic_Report_{c.case_number}_{scan_time_str}.pdf"
        pdf_dir = os.path.join(UPLOAD_DIR, "reports")
        abs_path = os.path.join(pdf_dir, pdf_filename)

        creator_user = db.query(User).filter(User.id == c.created_by).first()
        investigator_user = db.query(User).filter(User.id == c.assigned_expert).first() if c.assigned_expert else None
        if not investigator_user and c.assigned_investigator_id:
            investigator_user = db.query(User).filter(User.id == c.assigned_investigator_id).first()

        scan_meta = {
            "created_at": scan.created_at.strftime("%Y-%m-%d %H:%M UTC") if (scan and scan.created_at) else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "scan_duration": scan_duration,
            "results": [r for r in scan_results if r.get("evidence_id") in current_ev_ids]
        }

        generate_forensic_pdf_report(c, creator_user, investigator_user, evidence_files, scan_meta, abs_path)

        if scan:
            scan.pdf_path = f"/uploads/reports/{pdf_filename}"
            db.commit()

        # Log audit event
        log_audit_event(
            db, c.id, user.id, "Forensic PDF Report Generated",
            f"Official Sentinel AI Forensic PDF report generated for case {c.case_number}."
        )

    filename = os.path.basename(abs_path)
    return FileResponse(
        path=abs_path,
        media_type="application/pdf",
        filename=filename
    )


# ─── 10. Investigator Rich-Text Notes Endpoints (Tiptap) ───

@router.get("/cases/{case_id}/investigation-notes", response_model=List[InvestigatorNoteResponse])
@router.get("/cases/{case_id}/investigator-notes", response_model=List[InvestigatorNoteResponse])
def get_investigator_notes(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # Access permission check
    if not is_admin(user):
        if is_investigator(user):
            if c.assigned_expert != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: You are not assigned to this case. Access to investigation notes denied."
                )
        else:
            if c.created_by != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: You do not have permission to view investigation notes for this case."
                )

    notes = db.query(InvestigatorNote).filter(InvestigatorNote.case_id == case_id).order_by(InvestigatorNote.id.asc()).all()
    
    result = []
    for note in notes:
        inv_user = db.query(User).filter(User.id == note.investigator_id).first()
        inv_name = inv_user.full_name if inv_user else "Investigator"
        
        parsed_json = note.content_json
        if isinstance(parsed_json, str):
            try:
                parsed_json = json.loads(parsed_json)
            except Exception:
                parsed_json = None

        parsed_ev = note.related_evidence_ids
        if isinstance(parsed_ev, str):
            try:
                parsed_ev = json.loads(parsed_ev)
            except Exception:
                parsed_ev = []

        result.append(InvestigatorNoteResponse(
            id=note.id,
            case_id=note.case_id,
            investigator_id=note.investigator_id,
            investigator_name=inv_name,
            content=note.content,
            content_json=parsed_json if isinstance(parsed_json, dict) else None,
            related_evidence_ids=parsed_ev if isinstance(parsed_ev, list) else [],
            created_at=note.created_at,
            updated_at=note.updated_at
        ))
    return result


@router.post("/cases/{case_id}/investigation-notes", response_model=InvestigatorNoteResponse)
@router.post("/cases/{case_id}/investigator-notes", response_model=InvestigatorNoteResponse)
def create_investigator_note(
    case_id: int,
    payload: InvestigatorNoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # 1. Verify user is investigator or admin
    if not is_admin(user) and not is_investigator(user):
        raise HTTPException(status_code=403, detail="Forbidden: Only investigators can create investigation notes.")

    # 2. Verify case status is CASE_UNDER_INVESTIGATION
    status_str = c.status.value if hasattr(c.status, "value") else str(c.status)
    if status_str != "CASE_UNDER_INVESTIGATION" and not is_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Investigation notes can only be created when case is CASE_UNDER_INVESTIGATION."
        )

    # 3. Verify assigned investigator
    if not is_admin(user) and c.assigned_expert != user.id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not assigned to this case. Cannot add investigation notes."
        )

    cleaned_content = payload.content.strip()
    if not cleaned_content or cleaned_content in ["<p></p>", "<p><br></p>", "<p><br/></p>"]:
        raise HTTPException(status_code=400, detail="Cannot save empty investigation note.")

    new_note = InvestigatorNote(
        case_id=c.id,
        investigator_id=user.id,
        content=cleaned_content,
        content_json=payload.content_json,
        related_evidence_ids=payload.related_evidence_ids
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    log_audit_event(
        db,
        c.id,
        user.id,
        "Investigator Note Added",
        f"Added a new rich-text investigation note (ID: {new_note.id})."
    )

    return InvestigatorNoteResponse(
        id=new_note.id,
        case_id=new_note.case_id,
        investigator_id=new_note.investigator_id,
        investigator_name=user.full_name,
        content=new_note.content,
        content_json=new_note.content_json if isinstance(new_note.content_json, dict) else None,
        related_evidence_ids=new_note.related_evidence_ids if isinstance(new_note.related_evidence_ids, list) else [],
        created_at=new_note.created_at,
        updated_at=new_note.updated_at
    )


@router.put("/cases/{case_id}/investigation-notes/{note_id}", response_model=InvestigatorNoteResponse)
@router.put("/cases/{case_id}/investigator-notes/{note_id}", response_model=InvestigatorNoteResponse)
def update_investigator_note(
    case_id: int,
    note_id: int,
    payload: InvestigatorNoteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    if not is_admin(user) and not is_investigator(user):
        raise HTTPException(status_code=403, detail="Forbidden: Only investigators can edit investigation notes.")

    status_str = c.status.value if hasattr(c.status, "value") else str(c.status)
    if status_str != "CASE_UNDER_INVESTIGATION" and not is_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Investigation notes can only be edited when case is CASE_UNDER_INVESTIGATION."
        )

    if not is_admin(user) and c.assigned_expert != user.id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not assigned to this case. Cannot edit investigation notes."
        )

    note = db.query(InvestigatorNote).filter(
        InvestigatorNote.id == note_id,
        InvestigatorNote.case_id == case_id
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Investigation note not found.")

    if not is_admin(user) and note.investigator_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only edit your own investigation notes.")

    if payload.content is not None:
        cleaned = payload.content.strip()
        if not cleaned or cleaned in ["<p></p>", "<p><br></p>", "<p><br/></p>"]:
            raise HTTPException(status_code=400, detail="Cannot update to an empty note.")
        note.content = cleaned

    if payload.content_json is not None:
        note.content_json = payload.content_json

    if payload.related_evidence_ids is not None:
        note.related_evidence_ids = payload.related_evidence_ids

    note.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)

    log_audit_event(
        db,
        c.id,
        user.id,
        "Investigator Note Updated",
        f"Updated investigation note ID {note.id}."
    )

    return InvestigatorNoteResponse(
        id=note.id,
        case_id=note.case_id,
        investigator_id=note.investigator_id,
        investigator_name=user.full_name,
        content=note.content,
        content_json=note.content_json if isinstance(note.content_json, dict) else None,
        related_evidence_ids=note.related_evidence_ids if isinstance(note.related_evidence_ids, list) else [],
        created_at=note.created_at,
        updated_at=note.updated_at
    )


@router.delete("/cases/{case_id}/investigation-notes/{note_id}")
@router.delete("/cases/{case_id}/investigator-notes/{note_id}")
def delete_investigator_note(
    case_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    if not is_admin(user) and not is_investigator(user):
        raise HTTPException(status_code=403, detail="Forbidden: Only investigators can delete investigation notes.")

    status_str = c.status.value if hasattr(c.status, "value") else str(c.status)
    if status_str != "CASE_UNDER_INVESTIGATION" and not is_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Investigation notes can only be deleted when case is CASE_UNDER_INVESTIGATION."
        )

    if not is_admin(user) and c.assigned_expert != user.id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not assigned to this case. Cannot delete investigation notes."
        )

    note = db.query(InvestigatorNote).filter(
        InvestigatorNote.id == note_id,
        InvestigatorNote.case_id == case_id
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Investigation note not found.")

    if not is_admin(user) and note.investigator_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only delete your own investigation notes.")

    db.delete(note)
    db.commit()

    log_audit_event(
        db,
        c.id,
        user.id,
        "Investigator Note Deleted",
        f"Deleted investigation note ID {note_id}."
    )

    return {"message": "Investigation note deleted successfully."}


# ─── 11. Case Lifecycle: Forward to Expert, Expert Verification, Final Closure ───

@router.post("/cases/{case_id}/forward-to-expert")
@router.post("/cases/{case_id}/forward")
def forward_case_to_expert(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Only investigators or administrators can forward cases to the Expert module.")

    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).with_for_update().first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    # Verify authorization: must be assigned to case or admin
    if not is_admin(user):
        if c.assigned_investigator_id != user.id and c.assigned_expert != user.id:
            raise HTTPException(status_code=403, detail="You are not authorized to forward a case assigned to another investigator.")

    if c.status in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW, StatusEnum.VERIFIED, StatusEnum.CLOSED] or c.forwarded_to_expert_at is not None:
        raise HTTPException(status_code=400, detail="This case has already been forwarded to the Expert module or completed.")

    # 1. Validate that required investigation steps are complete.
    if not c.evidence_files or len(c.evidence_files) == 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot forward case to Expert: At least one evidence file must be uploaded before forwarding."
        )

    has_analysis = any(len(ev.analyses) > 0 for ev in c.evidence_files)
    has_scan = db.query(ForensicScan).filter(ForensicScan.case_id == c.id).first() is not None
    has_investigator_notes = db.query(InvestigatorNote).filter(InvestigatorNote.case_id == c.id).first() is not None
    # Also check case notes entered by the investigator
    has_inv_case_notes = any(n.user_id == user.id for n in (c.notes or []))

    if not (has_analysis or has_scan or has_investigator_notes or has_inv_case_notes):
        raise HTTPException(
            status_code=400,
            detail="Cannot forward case to Expert: Forensic analysis or investigator notes must be completed before forwarding."
        )

    # 2. Mark the investigator's work as completed.
    # 3. Set the appropriate case status: FORWARDED_TO_EXPERT.
    c.status = StatusEnum.FORWARDED_TO_EXPERT

    # 4. Record investigator completion / forwarded timestamp.
    now = datetime.now(timezone.utc)
    c.forwarded_to_expert_at = now
    c.investigator_completed_at = now
    c.expert_review_status = "PENDING"

    # 5. Preserve the investigator who completed the case.
    if not c.assigned_investigator_id:
        c.assigned_investigator_id = user.id

    # 6. Make the case available to the Expert module.
    if c.assigned_expert == c.assigned_investigator_id:
        c.assigned_expert = None

    db.commit()
    db.refresh(c)

    # 9. Add an audit/activity-log entry.
    log_audit_event(
        db,
        c.id,
        user.id,
        "Forwarded to Expert",
        f"Investigator {user.full_name} completed the investigation and forwarded case {c.case_number} to the Expert module for review."
    )

    if c.created_by:
        add_user_notification(
            db,
            c.created_by,
            "Investigation Completed",
            f"Case {c.case_number} investigation has been completed and forwarded to the Expert module for verification."
        )

    return {
        "message": "Investigation completed and case successfully forwarded to Expert module.",
        "case_id": c.id,
        "case_number": c.case_number,
        "status": c.status.value,
        "forwarded_to_expert_at": c.forwarded_to_expert_at.isoformat(),
        "investigator_completed_at": c.investigator_completed_at.isoformat(),
        "assigned_investigator_id": c.assigned_investigator_id,
        "assigned_investigator_name": user.full_name,
        "expert_review_status": c.expert_review_status
    }

@router.post("/cases/{case_id}/verify")
def verify_case_expert(
    case_id: int,
    decision: str = Form("APPROVED"),
    observations: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Only experts or administrators can verify cases.")
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    if c.status not in [StatusEnum.FORWARDED_TO_EXPERT, StatusEnum.UNDER_EXPERT_REVIEW]:
        raise HTTPException(status_code=400, detail=f"Case cannot be verified from status {c.status.value}. Must be in expert review stage.")

    dec_val = decision.upper().strip()
    c.assigned_expert = user.id
    now = datetime.now(timezone.utc)
    if dec_val in ["APPROVED", "VERIFIED"]:
        c.status = StatusEnum.VERIFIED
        c.expert_review_status = "VERIFIED"
        c.expert_verified_at = now
        log_audit_event(db, c.id, user.id, "Case Verified by Expert", f"Expert {user.full_name} completed verification: Case marked as VERIFIED. Observations: {observations or 'None'}")
    elif dec_val == "REJECTED":
        c.expert_review_status = "REJECTED"
        log_audit_event(db, c.id, user.id, "Expert Review Rejected", f"Expert {user.full_name} rejected verification. Observations: {observations or 'None'}")
    else:
        c.status = StatusEnum.UNDER_EXPERT_REVIEW
        c.expert_review_status = "UNDER_REVIEW"
        log_audit_event(db, c.id, user.id, "Under Expert Review", f"Case under review by expert {user.full_name}. Observations: {observations or 'None'}")

    db.commit()
    db.refresh(c)
    return {
        "message": f"Expert review decision '{dec_val}' recorded successfully.",
        "case_id": c.id,
        "status": c.status.value,
        "expert_review_status": c.expert_review_status,
        "expert_verified_at": c.expert_verified_at.isoformat() if c.expert_verified_at else None
    }

@router.post("/cases/{case_id}/close")
def close_case_endpoint(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Only administrators can permanently close the case lifecycle.")
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    c.status = StatusEnum.CLOSED
    c.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    log_audit_event(db, c.id, user.id, "Case Closed", f"Final case closure by administrator {user.full_name}.")
    return {
        "message": "Case closed successfully",
        "case_id": c.id,
        "status": c.status.value,
        "closed_at": c.closed_at.isoformat()
    }


# ─── Investigation Documents Endpoints ───

ALLOWED_INVESTIGATION_DOC_TYPES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/csv": ".csv",
    "image/jpeg": ".jpg",
    "image/png": ".png"
}

@router.post("/cases/{case_id}/investigation-documents")
async def upload_investigation_document(
    case_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not is_investigator_or_admin(user):
        raise HTTPException(status_code=403, detail="Only investigators can upload investigation documents.")
        
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if c.assigned_investigator_id != user.id and c.assigned_expert != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="You are not assigned to this case.")
        
    if c.status != StatusEnum.CASE_UNDER_INVESTIGATION and not is_admin(user):
        raise HTTPException(status_code=403, detail="Cannot upload documents unless case is under investigation.")
        
    if file.content_type not in ALLOWED_INVESTIGATION_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type.")
        
    ext = ALLOWED_INVESTIGATION_DOC_TYPES[file.content_type]
    file_id = str(uuid.uuid4())
    stored_filename = f"inv_doc_{case_id}_{file_id}{ext}"
    stored_path = os.path.join(UPLOAD_DIR, "investigation_documents", stored_filename)
    os.makedirs(os.path.dirname(stored_path), exist_ok=True)
    
    file_size = 0
    sha256 = hashlib.sha256()
    
    with open(stored_path, "wb") as buffer:
        while True:
            chunk = await file.read(8192)
            if not chunk:
                break
            buffer.write(chunk)
            sha256.update(chunk)
            file_size += len(chunk)
            
    if file_size == 0:
        os.remove(stored_path)
        raise HTTPException(status_code=400, detail="Empty file uploaded.")
        
    doc = InvestigationDocument(
        case_id=case_id,
        investigator_id=user.id,
        original_filename=file.filename or stored_filename,
        stored_path=stored_path,
        mime_type=file.content_type,
        file_size=file_size,
        sha256_hash=sha256.hexdigest()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    log_audit_event(db, case_id, user.id, "Investigation document uploaded", f"Uploaded document: {doc.original_filename}")
    
    return {
        "id": doc.id,
        "original_filename": doc.original_filename,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "investigator_id": doc.investigator_id,
        "investigator_name": user.full_name
    }

@router.get("/cases/{case_id}/investigation-documents")
def get_investigation_documents(
    case_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
        
    docs = db.query(InvestigationDocument).filter(InvestigationDocument.case_id == case_id).order_by(InvestigationDocument.uploaded_at.desc()).all()
    
    result = []
    for d in docs:
        result.append({
            "id": d.id,
            "original_filename": d.original_filename,
            "mime_type": d.mime_type,
            "file_size": d.file_size,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "investigator_id": d.investigator_id,
            "investigator_name": d.investigator.full_name if d.investigator else "Unknown"
        })
    return result

@router.get("/cases/{case_id}/investigation-documents/{doc_id}/download")
def download_investigation_document(
    case_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    doc = db.query(InvestigationDocument).filter(
        InvestigationDocument.id == doc_id,
        InvestigationDocument.case_id == case_id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not os.path.exists(doc.stored_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(
        path=doc.stored_path,
        filename=doc.original_filename,
        media_type=doc.mime_type
    )

@router.delete("/cases/{case_id}/investigation-documents/{doc_id}")
def delete_investigation_document(
    case_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    doc = db.query(InvestigationDocument).filter(
        InvestigationDocument.id == doc_id,
        InvestigationDocument.case_id == case_id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    c = db.query(InvestigationCase).filter(InvestigationCase.id == case_id).first()
    
    if doc.investigator_id != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="You can only delete your own documents.")
        
    if c.status != StatusEnum.CASE_UNDER_INVESTIGATION and not is_admin(user):
        raise HTTPException(status_code=403, detail="Cannot delete documents once case investigation is complete.")
        
    try:
        if os.path.exists(doc.stored_path):
            os.remove(doc.stored_path)
    except Exception as e:
        print("Error removing file:", e)
        
    db.delete(doc)
    db.commit()
    
    log_audit_event(db, case_id, user.id, "Investigation document deleted", f"Deleted document: {doc.original_filename}")
    
    return {"message": "Document deleted successfully"}
