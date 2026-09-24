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


def test_api_service_endpoint():
    db = SessionLocal()
    try:
        # Find admin or investigator user
        user = db.query(User).filter(User.email == "alexander.pierce@sentinel.ai").first()
        if not user:
            user = db.query(User).first()

        assert user is not None, "No user found in database for testing"

        # Generate auth token
        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role_id": user.role_id})
        headers = {"Authorization": f"Bearer {token}"}

        # Create or find a test case
        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == "CASE-TEST-M4").first()
        if not case:
            case = InvestigationCase(
                case_number="CASE-TEST-M4",
                title="Milestone 4 Automated API Service Test",
                description="Testing Sentinel AI V1.7-A direct API endpoint integration.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        # Prepare evidence file
        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        assert os.path.exists(sample_img_src), f"Sample image not found: {sample_img_src}"

        evidence_target_path = os.path.join(backend_dir, "uploads", "evidence_m4_test.jpg")
        shutil.copyfile(sample_img_src, evidence_target_path)

        # Create EvidenceFile record if not existing
        ev_file = db.query(EvidenceFile).filter(EvidenceFile.file_name == "evidence_m4_test.jpg").first()
        if not ev_file:
            ev_file = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name="evidence_m4_test.jpg",
                original_name="source_photo.jpg",
                file_type=FileTypeEnum.IMAGE,
                mime_type="image/jpeg",
                file_size=os.path.getsize(evidence_target_path),
                storage_path=evidence_target_path,
                sha256_hash="57244f424f284ffbb6aae62425f06ea500000000000000000000000000000000"
            )
            db.add(ev_file)
            db.commit()
            db.refresh(ev_file)

        # Test API Client
        client = TestClient(app)

        print("--- Testing API Endpoint POST /api/v1/user/cases/{case_id}/analyze ---")
        response = client.post(f"/api/v1/user/cases/{case.id}/analyze", headers=headers)

        print(f"HTTP Status Code: {response.status_code}")
        assert response.status_code == 200, f"API failed with status {response.status_code}: {response.text}"

        data = response.json()
        print("\nAPI Response:")
        print(f"Success: {data.get('success')}")
        print(f"Investigation ID: {data.get('investigation_id')}")
        print(f"Status: {data.get('status')}")
        print(f"Evidence count: {data.get('evidence_count')}")

        results = data.get("results", [])
        assert len(results) >= 1, "Expected at least 1 evidence result in response"

        r0 = results[0]
        print(f"\nEvidence #{r0.get('evidence_id')}:")
        print(f"  Classification: {r0.get('classification')}")
        print(f"  Tampered Probability: {r0.get('tampered_probability')}")
        print(f"  Authentic Probability: {r0.get('authentic_probability')}")
        print(f"  Localization Available: {r0.get('localization_available')}")
        print(f"  Mask Path: {r0.get('mask_artifact_path')}")
        print(f"  Overlay Path: {r0.get('overlay_artifact_path')}")
        print(f"  Inference Time: {r0.get('inference_time_seconds')}s")

        # Verify real values
        assert r0.get("classification") in ["tampered", "authentic"]
        assert isinstance(r0.get("tampered_probability"), float)
        assert r0.get("mask_artifact_path") is not None
        assert r0.get("overlay_artifact_path") is not None

        # Verify artifacts exist on disk
        overlay_disk_path = os.path.join(backend_dir, r0["overlay_artifact_path"].lstrip("/"))
        assert os.path.exists(overlay_disk_path), f"Overlay artifact missing on disk: {overlay_disk_path}"

        print("\n✓ Real API Inference Service validated successfully without frontend.")
        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_api_service_endpoint())
