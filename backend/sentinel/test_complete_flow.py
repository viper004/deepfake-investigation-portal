import sys
import os
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum, ForensicScan, AIAnalysis
from app.models.user import User
from app.utils.auth import create_access_token


def test_complete_report_flow():
    """
    Milestone 12 Test: Verify the complete pipeline from evidence upload -> Sentinel AI -> Database -> PDF generator -> Report endpoint.
    """
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None, "User required for testing"

        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role_id": user.role_id})
        headers = {"Authorization": f"Bearer {token}"}

        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == "CASE-TEST-M12").first()
        if not case:
            case = InvestigationCase(
                case_number="CASE-TEST-M12",
                title="Milestone 12 Complete Report Flow Test",
                description="Testing end-to-end evidence upload -> Sentinel AI -> DB -> PDF generation flow.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        evidence_target_path = os.path.join(backend_dir, "uploads", "evidence_m12_test.jpg")
        shutil.copyfile(sample_img_src, evidence_target_path)

        ev_file = db.query(EvidenceFile).filter(EvidenceFile.file_name == "evidence_m12_test.jpg").first()
        if not ev_file:
            ev_file = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name="evidence_m12_test.jpg",
                original_name="source_photo_m12.jpg",
                file_type=FileTypeEnum.IMAGE,
                mime_type="image/jpeg",
                file_size=os.path.getsize(evidence_target_path),
                storage_path=evidence_target_path,
                sha256_hash="57244f424f284ffbb6aae62425f06ea500000000000000000000000000000000"
            )
            db.add(ev_file)
            db.commit()
            db.refresh(ev_file)

        client = TestClient(app)

        # 1. Trigger Report Endpoint directly
        print("--- Testing PDF Report Endpoint GET /api/v1/user/cases/{case_id}/report/pdf ---")
        pdf_res = client.get(f"/api/v1/user/cases/{case.id}/report/pdf", headers=headers)
        assert pdf_res.status_code == 200, f"PDF report generation failed: {pdf_res.text}"
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert len(pdf_res.content) > 5000

        # 2. Verify Database Persistence
        db.expire_all()
        scans = db.query(ForensicScan).filter(ForensicScan.case_id == case.id).all()
        assert len(scans) >= 1, "Expected ForensicScan record in database"
        
        analyses = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev_file.id).all()
        assert len(analyses) >= 1, "Expected AIAnalysis record in database"

        print(f"✓ Complete report generation flow validated successfully ({len(pdf_res.content)} bytes returned).")
        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_complete_report_flow())
