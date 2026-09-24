import sys
import os
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum, AIAnalysis, ForensicScan
from app.models.user import User
from app.utils.auth import create_access_token


def test_database_persistence():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "alexander.pierce@sentinel.ai").first()
        if not user:
            user = db.query(User).first()

        assert user is not None, "No test user found in database"

        # 1. Create a unique test case
        case_num = "CASE-TEST-M5-PERSIST"
        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == case_num).first()
        if not case:
            case = InvestigationCase(
                case_number=case_num,
                title="Milestone 5 Persistence Test Case",
                description="Testing database persistence of real Sentinel AI analysis results.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        # 2. Upload/prepare real test evidence file
        sample_img = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        assert os.path.exists(sample_img), f"Sample image not found: {sample_img}"

        evidence_filename = "evidence_m5_persist.jpg"
        ev_dest = os.path.join(backend_dir, "uploads", evidence_filename)
        shutil.copyfile(sample_img, ev_dest)

        ev_file = db.query(EvidenceFile).filter(EvidenceFile.file_name == evidence_filename).first()
        if not ev_file:
            ev_file = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name=evidence_filename,
                original_name="forensic_sample_image.jpg",
                file_type=FileTypeEnum.IMAGE,
                mime_type="image/jpeg",
                file_size=os.path.getsize(ev_dest),
                storage_path=ev_dest,
                sha256_hash="57244f424f284ffbb6aae62425f06ea500000000000000000000000000000000"
            )
            db.add(ev_file)
            db.commit()
            db.refresh(ev_file)

        # 3. Trigger analysis via API TestClient
        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role_id": user.role_id})
        headers = {"Authorization": f"Bearer {token}"}
        client = TestClient(app)

        print("--- Triggering Analysis via Backend API ---")
        response = client.post(f"/api/v1/user/cases/{case.id}/analyze", headers=headers)
        assert response.status_code == 200, f"Analysis failed: {response.text}"

    finally:
        db.close()

    # 4. Open a completely NEW database session to verify persistent storage
    print("\n--- Verifying Direct Database Persistence in New DB Session ---")
    new_db = SessionLocal()
    try:
        # Query AIAnalysis directly from database
        analysis = new_db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev_file.id).order_by(AIAnalysis.id.desc()).first()
        assert analysis is not None, "AIAnalysis record was not persisted to the database!"

        print(f"Stored AIAnalysis ID: {analysis.id}")
        print(f"Evidence ID: {analysis.evidence_id}")
        print(f"Model ID: {analysis.model_id} ({analysis.model.model_name})")
        print(f"Classification Result: {analysis.result.value}")
        print(f"Tampered Probability: {analysis.tampered_probability}")
        print(f"Authentic Probability: {analysis.authentic_probability}")
        print(f"Classification Threshold: {analysis.classification_threshold}")
        print(f"Localization Available: {analysis.localization_available}")
        print(f"Localization Threshold: {analysis.localization_threshold}")
        print(f"Mask Artifact Path: {analysis.mask_path}")
        print(f"Overlay Artifact Path: {analysis.overlay_path}")
        print(f"Model Version: {analysis.model_version}")
        print(f"SHA-256 Hash: {analysis.sha256_hash}")
        print(f"Inference Duration: {analysis.processing_time}s")
        print(f"Processing Device: {analysis.device}")
        print(f"Analysis Timestamp: {analysis.analyzed_at}")

        # Assert all Milestone 5 required fields
        assert analysis.evidence_id == ev_file.id
        assert analysis.result.value in ["REAL", "DEEPFAKE", "SUSPICIOUS"]
        assert analysis.tampered_probability is not None and 0.0 <= analysis.tampered_probability <= 1.0
        assert analysis.authentic_probability is not None and 0.0 <= analysis.authentic_probability <= 1.0
        assert analysis.classification_threshold == 0.40
        assert analysis.localization_available is not None
        assert analysis.mask_path is not None and len(analysis.mask_path) > 0
        assert analysis.overlay_path is not None and len(analysis.overlay_path) > 0
        assert analysis.model_version is not None
        assert analysis.analyzed_at is not None
        assert analysis.sha256_hash is not None
        assert analysis.processing_time is not None
        assert analysis.device is not None

        # Verify ForensicScan record
        scan = new_db.query(ForensicScan).filter(ForensicScan.case_id == case.id).order_by(ForensicScan.id.desc()).first()
        assert scan is not None, "ForensicScan record not persisted!"
        print(f"\nStored ForensicScan ID: {scan.id} (Status: {scan.scan_status}, Duration: {scan.scan_duration}s)")

        print("\n✓ Milestone 5 Database Persistence verification PASSED.")
        return 0
    finally:
        new_db.close()


if __name__ == "__main__":
    sys.exit(test_database_persistence())
