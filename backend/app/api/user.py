import os
import uuid
import shutil
import hashlib
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, text, and_
from jose import jwt, JWTError

from app.database.database import SessionLocal
from app.models.models import (
    InvestigationCase, EvidenceFile, MediaMetadata, AIModel, AIAnalysis,
    ForensicReview, InvestigationNote, Report, Notification,
    PriorityEnum, StatusEnum, FileTypeEnum, AIResultEnum, ReportTypeEnum, MediaTypeEnum
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

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token"
            )
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
    total_cases = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id).count()
    open_cases = db.query(InvestigationCase).filter(
        InvestigationCase.created_by == user.id,
        InvestigationCase.status == StatusEnum.OPEN
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
    
    # AI Analyses count
    ai_completed = db.query(AIAnalysis).join(EvidenceFile).filter(
        EvidenceFile.uploaded_by == user.id
    ).count()
    
    # Reports generated count
    reports_count = db.query(Report).filter(Report.generated_by == user.id).count()
    
    return {
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
    # Recent Cases
    cases = db.query(InvestigationCase).filter(
        InvestigationCase.created_by == user.id
    ).order_by(desc(InvestigationCase.created_at)).limit(5).all()
    
    cases_list = []
    for c in cases:
        cases_list.append({
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "status": c.status.value,
            "priority": c.priority.value,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
        
    # Recent Uploads
    uploads = db.query(EvidenceFile).filter(
        EvidenceFile.uploaded_by == user.id
    ).order_by(desc(EvidenceFile.upload_time)).limit(5).all()
    
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
        
    # Latest AI Results
    ai_results = db.query(AIAnalysis).join(EvidenceFile).filter(
        EvidenceFile.uploaded_by == user.id
    ).order_by(desc(AIAnalysis.analyzed_at)).limit(5).all()
    
    ai_list = []
    for a in ai_results:
        ai_list.append({
            "id": a.id,
            "file_name": a.evidence.original_name,
            "model_name": a.model.model_name,
            "result": a.result.value,
            "confidence_score": a.confidence_score,
            "analyzed_at": a.analyzed_at.isoformat() if a.analyzed_at else None
        })
        
    # Recent Reports
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
        
    # Recent Notifications
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
    priority_filter: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(InvestigationCase).filter(InvestigationCase.created_by == user.id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                InvestigationCase.case_number.like(search_term),
                InvestigationCase.title.like(search_term),
                InvestigationCase.description.like(search_term)
            )
        )
        
    if status_filter:
        query = query.filter(InvestigationCase.status == status_filter.upper())
        
    if priority_filter:
        query = query.filter(InvestigationCase.priority == priority_filter.upper())
        
    if sort_by == "oldest":
        query = query.order_by(InvestigationCase.id)
    else:
        query = query.order_by(desc(InvestigationCase.created_at))
        
    total = query.count()
    offset = (page - 1) * limit
    cases = query.offset(offset).limit(limit).all()
    
    cases_list = []
    for c in cases:
        cases_list.append({
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "description": c.description,
            "status": c.status.value,
            "priority": c.priority.value,
            "incident_date": c.incident_date.isoformat() if c.incident_date else None,
            "created_at": c.created_at.isoformat() if c.created_at else None
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
    priority: str = Form("MEDIUM"),
    incident_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Generate unique case number
    case_num = f"CASE-{datetime.now().strftime('%y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    
    p_enum = PriorityEnum.MEDIUM
    try:
        p_enum = PriorityEnum[priority.upper()]
    except:
        pass
        
    inc_date = None
    if incident_date:
        try:
            inc_date = datetime.fromisoformat(incident_date)
        except:
            pass
            
    new_case = InvestigationCase(
        case_number=case_num,
        title=title,
        description=description,
        created_by=user.id,
        priority=p_enum,
        status=StatusEnum.OPEN,
        incident_date=inc_date
    )
    
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    add_user_notification(
        db, user.id, "Case Created",
        f"Case {case_num} ({title}) has been created successfully."
    )
    
    return {
        "message": "Case created successfully",
        "case": {
            "id": new_case.id,
            "case_number": new_case.case_number,
            "title": new_case.title
        }
    }

@router.get("/cases/{case_id}")
def get_case_detail(
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
        
    # Get Evidence
    evidence_list = []
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
                "model_name": a.model.model_name,
                "version": a.model.version,
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
            "reviewer_name": r.reviewer.full_name,
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
            "user_name": n.user.full_name,
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
        
    return {
        "id": c.id,
        "case_number": c.case_number,
        "title": c.title,
        "description": c.description,
        "priority": c.priority.value,
        "status": c.status.value,
        "incident_date": c.incident_date.isoformat() if c.incident_date else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "evidence": evidence_list,
        "forensic_reviews": reviews_list,
        "notes": notes_list,
        "reports": reports_list
    }

@router.put("/cases/{case_id}")
def update_case(
    case_id: int,
    title: str = Form(...),
    description: str = Form(...),
    priority: str = Form(...),
    status: str = Form(...),
    incident_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.query(InvestigationCase).filter(
        InvestigationCase.id == case_id,
        InvestigationCase.created_by == user.id
    ).first()
    
    if not c:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
        
    c.title = title
    c.description = description
    
    try:
        c.priority = PriorityEnum[priority.upper()]
    except:
        pass
        
    old_status = c.status
    try:
        c.status = StatusEnum[status.upper()]
    except:
        pass
        
    if incident_date:
        try:
            c.incident_date = datetime.fromisoformat(incident_date)
        except:
            pass
            
    db.commit()
    
    if old_status != c.status:
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
    c = db.query(InvestigationCase).filter(
        InvestigationCase.id == case_id,
        InvestigationCase.created_by == user.id
    ).first()
    
    if not c:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
        
    new_note = InvestigationNote(
        case_id=case_id,
        user_id=user.id,
        note=note
    )
    db.add(new_note)
    db.commit()
    
    return {"message": "Note added successfully"}

@router.put("/notes/{note_id}")
def update_case_note(
    note_id: int,
    note: str = Form(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    n = db.query(InvestigationNote).filter(
        InvestigationNote.id == note_id,
        InvestigationNote.user_id == user.id
    ).first()
    
    if not n:
        raise HTTPException(status_code=404, detail="Note not found or edit denied")
        
    n.note = note
    db.commit()
    return {"message": "Note updated successfully"}

@router.delete("/notes/{note_id}")
def delete_case_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    n = db.query(InvestigationNote).filter(
        InvestigationNote.id == note_id,
        InvestigationNote.user_id == user.id
    ).first()
    
    if not n:
        raise HTTPException(status_code=404, detail="Note not found or deletion denied")
        
    db.delete(n)
    db.commit()
    return {"message": "Note deleted successfully"}

# ─── 5. Upload Evidence Endpoint ───
@router.post("/evidence/upload")
async def upload_evidence(
    case_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # Verify case ownership
    c = db.query(InvestigationCase).filter(
        InvestigationCase.id == case_id,
        InvestigationCase.created_by == user.id
    ).first()
    
    if not c:
        raise HTTPException(status_code=404, detail="Case not found or access denied")
        
    original_name = file.filename
    content = await file.read()
    file_size = len(content)
    
    # Calculate SHA256 Hash
    sha256 = hashlib.sha256(content).hexdigest()
    
    # Generate unique stored filename
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(UPLOAD_DIR, stored_name)
    
    # Save the file to disk
    with open(storage_path, "wb") as f:
        f.write(content)
        
    # Map file type
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
    
    # Extract / Seed media metadata
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

@router.delete("/evidence/{evidence_id}")
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    e = db.query(EvidenceFile).filter(
        EvidenceFile.id == evidence_id,
        EvidenceFile.uploaded_by == user.id
    ).first()
    
    if not e:
        raise HTTPException(status_code=404, detail="Evidence not found or deletion denied")
        
    # Delete file from disk if exists
    if os.path.exists(e.storage_path):
        try:
            os.remove(e.storage_path)
        except Exception as err:
            print("Failed to remove file from disk:", err)
            
    orig_name = e.original_name
    db.delete(e)
    db.commit()
    
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
    # Verify evidence ownership
    e = db.query(EvidenceFile).filter(
        EvidenceFile.id == evidence_id,
        EvidenceFile.uploaded_by == user.id
    ).first()
    
    if not e:
        raise HTTPException(status_code=404, detail="Evidence file not found or access denied")
        
    model = db.query(AIModel).filter(AIModel.id == model_id, AIModel.status == True).first()
    if not model:
        raise HTTPException(status_code=404, detail="AI Model not found or inactive")
        
    # Perform simulated analysis
    import random
    choices = [AIResultEnum.REAL, AIResultEnum.DEEPFAKE, AIResultEnum.SUSPICIOUS]
    weights = [0.4, 0.4, 0.2] # weights matching our probabilities
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
    
    # Auto transition case status if it's currently OPEN
    if e.case and e.case.status == StatusEnum.OPEN:
        e.case.status = StatusEnum.UNDER_ANALYSIS
        
    db.commit()
    db.refresh(analysis)
    
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
