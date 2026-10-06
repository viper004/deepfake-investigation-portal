import os
import sys
from dotenv import load_dotenv

sys.path.append("/home/jagansyam/Desktop/deepfake-investigation-portal/backend")

from app.database.database import SessionLocal
from app.models.models import (
    Report, FinalCaseReport, InvestigationCase, EvidenceFile,
    InvestigatorNote, InvestigationDocument, InvestigationNote
)
from app.models.user import User

def cleanup_reports():
    db = SessionLocal()
    try:
        # Pre-counts
        cases_count = db.query(InvestigationCase).count()
        evidence_count = db.query(EvidenceFile).count()
        inv_notes_count = db.query(InvestigatorNote).count()
        case_notes_count = db.query(InvestigationNote).count()
        inv_docs_count = db.query(InvestigationDocument).count()
        final_reports_count = db.query(FinalCaseReport).count()
        users_count = db.query(User).count()
        
        reports = db.query(Report).all()
        report_count = len(reports)
        
        print(f"Pre-cleanup counts:")
        print(f"  Cases: {cases_count}")
        print(f"  Evidence: {evidence_count}")
        print(f"  Investigator Notes: {inv_notes_count}")
        print(f"  Case Notes: {case_notes_count}")
        print(f"  Investigation Docs: {inv_docs_count}")
        print(f"  Final Reports: {final_reports_count}")
        print(f"  Users: {users_count}")
        print(f"  => Generated Reports to delete: {report_count}")
        
        # Delete physical files
        files_deleted = 0
        for r in reports:
            file_path = r.report_file
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    files_deleted += 1
                except Exception as e:
                    print(f"Could not delete file {file_path}: {e}")
                    
        print(f"Deleted {files_deleted} physical report files.")
        
        # Delete DB records
        deleted_rows = db.query(Report).delete()
        db.commit()
        
        print(f"Deleted {deleted_rows} records from reports table.")
        
        # Post-counts
        p_cases = db.query(InvestigationCase).count()
        p_evidence = db.query(EvidenceFile).count()
        p_inv_notes = db.query(InvestigatorNote).count()
        p_case_notes = db.query(InvestigationNote).count()
        p_inv_docs = db.query(InvestigationDocument).count()
        p_final_reports = db.query(FinalCaseReport).count()
        p_users = db.query(User).count()
        p_reports = db.query(Report).count()
        
        print(f"\nPost-cleanup counts:")
        print(f"  Cases: {p_cases} (Expected: {cases_count})")
        print(f"  Evidence: {p_evidence} (Expected: {evidence_count})")
        print(f"  Investigator Notes: {p_inv_notes} (Expected: {inv_notes_count})")
        print(f"  Case Notes: {p_case_notes} (Expected: {case_notes_count})")
        print(f"  Investigation Docs: {p_inv_docs} (Expected: {inv_docs_count})")
        print(f"  Final Reports: {p_final_reports} (Expected: {final_reports_count})")
        print(f"  Users: {p_users} (Expected: {users_count})")
        print(f"  => Generated Reports: {p_reports} (Expected: 0)")
        
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_reports()
