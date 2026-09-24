import sys
import os
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum
from app.models.user import User
from app.utils.auth import create_access_token


def test_frontend_scan_integration():
    """
    Milestone 7 Test: Verify that the API endpoint called by the frontend (/api/v1/user/cases/{case_id}/scan)
    returns real Sentinel AI V1.7-A analysis, probabilities, thresholds, and localization map artifacts.
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "alexander.pierce@sentinel.ai").first()
        if not user:
            user = db.query(User).first()

        assert user is not None, "User required for testing"

        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role_id": user.role_id})
        headers = {"Authorization": f"Bearer {token}"}

        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == "CASE-TEST-M7").first()
        if not case:
            case = InvestigationCase(
                case_number="CASE-TEST-M7",
                title="Milestone 7 Frontend Integration Test",
                description="Testing frontend /scan endpoint integration with real Sentinel AI.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        evidence_target_path = os.path.join(backend_dir, "uploads", "evidence_m7_test.jpg")
        shutil.copyfile(sample_img_src, evidence_target_path)

        ev_file = db.query(EvidenceFile).filter(EvidenceFile.file_name == "evidence_m7_test.jpg").first()
        if not ev_file:
            ev_file = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name="evidence_m7_test.jpg",
                original_name="target_m7_photo.jpg",
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

        print("--- Testing POST /api/v1/user/cases/{case_id}/scan ---")
        response = client.post(f"/api/v1/user/cases/{case.id}/scan", headers=headers)
        assert response.status_code == 200, f"Scan request failed: {response.text}"

        data = response.json()
        assert data.get("scan_status") == "COMPLETED"
        results = data.get("results", [])
        assert len(results) >= 1, "Expected results array in scan response"

        item = results[0]
        assert item.get("classification") in ["tampered", "authentic"]
        assert "tampered_probability" in item
        assert "authentic_probability" in item
        assert item.get("overlay_artifact_path") is not None
        assert item.get("mask_artifact_path") is not None

        print(f"Classification: {item.get('classification')}")
        print(f"Tampered Probability: {item.get('tampered_probability')}")
        print(f"Overlay Path: {item.get('overlay_artifact_path')}")
        print("✓ Milestone 7 frontend endpoint integration test passed.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_frontend_scan_integration())
