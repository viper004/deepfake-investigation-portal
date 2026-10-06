import os
import sys

sys.path.append("/home/jagansyam/Desktop/deepfake-investigation-portal/backend")

from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.models import (
    InvestigationCase, EvidenceFile, MediaMetadata, AIAnalysis, ForensicReview,
    InvestigationNote, Report, AuditLog, CaseMessage, MessageAttachment,
    ForensicScan, InvestigatorNote, InvestigationDocument, FinalCaseReport
)
from app.models.user import User

def delete_file_safely(path):
    if not path:
        return 0
    if path.startswith("/uploads"):
        path = "/home/jagansyam/Desktop/deepfake-investigation-portal/backend" + path
    if os.path.exists(path):
        try:
            os.remove(path)
            return 1
        except Exception as e:
            print(f"Could not delete {path}: {e}")
    return 0

def cleanup_sample_cases():
    db: Session = SessionLocal()
    
    # 1. Identify sample cases
    all_cases = db.query(InvestigationCase).all()
    sample_cases = [c for c in all_cases if c.id not in (1, 3)]
    
    print(f"Found {len(sample_cases)} sample cases to delete.")
    
    files_deleted = 0
    cases_deleted = 0
    
    for c in sample_cases:
        case_id = c.id
        
        # Collect physical files to delete
        # Evidence files
        evidences = db.query(EvidenceFile).filter(EvidenceFile.case_id == case_id).all()
        for ev in evidences:
            files_deleted += delete_file_safely(ev.storage_path)
            # Delete ForensicReview -> AIAnalysis -> MediaMetadata
            analyses = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev.id).all()
            for a in analyses:
                db.query(ForensicReview).filter(ForensicReview.analysis_id == a.id).delete()
            db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev.id).delete()
            db.query(MediaMetadata).filter(MediaMetadata.evidence_id == ev.id).delete()
            
        # Delete EvidenceFiles
        db.query(EvidenceFile).filter(EvidenceFile.case_id == case_id).delete()
        
        # Forensic Scans
        scans = db.query(ForensicScan).filter(ForensicScan.case_id == case_id).all()
        for s in scans:
            files_deleted += delete_file_safely(s.pdf_path)
        db.query(ForensicScan).filter(ForensicScan.case_id == case_id).delete()
        
        # Investigation Documents
        docs = db.query(InvestigationDocument).filter(InvestigationDocument.case_id == case_id).all()
        for d in docs:
            files_deleted += delete_file_safely(d.stored_path)
        db.query(InvestigationDocument).filter(InvestigationDocument.case_id == case_id).delete()
        
        # Final Case Reports
        f_reports = db.query(FinalCaseReport).filter(FinalCaseReport.case_id == case_id).all()
        for fr in f_reports:
            files_deleted += delete_file_safely(fr.stored_path)
        db.query(FinalCaseReport).filter(FinalCaseReport.case_id == case_id).delete()
        
        # Reports
        reports = db.query(Report).filter(Report.case_id == case_id).all()
        for r in reports:
            files_deleted += delete_file_safely(r.report_file)
        db.query(Report).filter(Report.case_id == case_id).delete()
        
        # Case Messages and Attachments
        messages = db.query(CaseMessage).filter(CaseMessage.case_id == case_id).all()
        for m in messages:
            atts = db.query(MessageAttachment).filter(MessageAttachment.message_id == m.id).all()
            for att in atts:
                files_deleted += delete_file_safely(att.storage_key)
            db.query(MessageAttachment).filter(MessageAttachment.message_id == m.id).delete()
        db.query(CaseMessage).filter(CaseMessage.case_id == case_id).delete()
        
        # Other case_id relationships
        db.query(AuditLog).filter(AuditLog.case_id == case_id).delete()
        db.query(InvestigationNote).filter(InvestigationNote.case_id == case_id).delete()
        db.query(InvestigatorNote).filter(InvestigatorNote.case_id == case_id).delete()
        
        # Delete Case itself
        db.delete(c)
        cases_deleted += 1

    db.commit()
    db.close()
    print(f"Cleanup finished. Deleted {cases_deleted} cases and {files_deleted} physical files.")

if __name__ == "__main__":
    cleanup_sample_cases()
