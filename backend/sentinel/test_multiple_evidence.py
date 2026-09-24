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


def test_multiple_evidence_processing():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "alexander.pierce@sentinel.ai").first()
        if not user:
            user = db.query(User).first()

        assert user is not None, "No test user found in database"

        # 1. Create a new case for multi-evidence testing
        case_num = "CASE-TEST-M6-MULTI"
        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == case_num).first()
        if not case:
            case = InvestigationCase(
                case_number=case_num,
                title="Multi-Evidence Forensic Investigation",
                description="Testing batch multi-evidence analysis across 5 image files.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        # 2. Gather 5 real image sources
        image_sources = [
            ("ev_m6_01.jpg", os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg"), "Security_Feed_Frame01.jpg"),
            ("ev_m6_02.jpg", os.path.join(backend_dir, "uploads", "219302ef27434208abc8aa4c621c712e.jpg"), "ID_Card_Scan.jpg"),
            ("ev_m6_03.jpg", os.path.join(backend_dir, "uploads", "b1f9f7991a2840399ac270d364b6fb4a.jpg"), "Surveillance_Capture.jpg"),
            ("ev_m6_04.png", os.path.join(backend_dir, "..", "frontend", "public", "images", "auth", "cyber1.png"), "Digital_Composite_01.png"),
            ("ev_m6_05.png", os.path.join(backend_dir, "..", "frontend", "public", "images", "auth", "cyber2.png"), "Digital_Composite_02.png"),
        ]

        created_evidence_ids = []
        for file_name, src_path, orig_name in image_sources:
            dest_path = os.path.join(backend_dir, "uploads", file_name)
            if not os.path.exists(dest_path) and os.path.exists(src_path):
                shutil.copyfile(src_path, dest_path)

            ef = db.query(EvidenceFile).filter(EvidenceFile.case_id == case.id, EvidenceFile.file_name == file_name).first()
            if not ef:
                ef = EvidenceFile(
                    case_id=case.id,
                    uploaded_by=user.id,
                    file_name=file_name,
                    original_name=orig_name,
                    file_type=FileTypeEnum.IMAGE,
                    mime_type="image/jpeg" if file_name.endswith(".jpg") else "image/png",
                    file_size=os.path.getsize(dest_path) if os.path.exists(dest_path) else 1024,
                    storage_path=dest_path,
                    sha256_hash=f"hash_{file_name}_000000000000000000000000000000000000000000000000"[:64]
                )
                db.add(ef)
                db.commit()
                db.refresh(ef)
            created_evidence_ids.append(ef.id)

        assert len(created_evidence_ids) == 5, f"Expected 5 evidence files, got {len(created_evidence_ids)}"
        print(f"Prepared 5 evidence records in database: {created_evidence_ids}")

        # 3. Call API Endpoint
        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role_id": user.role_id})
        headers = {"Authorization": f"Bearer {token}"}
        client = TestClient(app)

        print("\n--- Triggering Batch Analysis for 5 Evidence Files via API ---")
        response = client.post(f"/api/v1/user/cases/{case.id}/analyze", headers=headers)
        assert response.status_code == 200, f"API failed with status {response.status_code}: {response.text}"

        data = response.json()
        print(f"HTTP Status: 200 OK")
        print(f"Investigation ID: {data.get('investigation_id')}")
        print(f"Total Evidence Count: {data.get('evidence_count')}")

        summary = data.get("summary", {})
        print(f"Summary Tracking: Total={summary.get('total')} | Processed={summary.get('processed')} | Failed={summary.get('failed')} | Pending={summary.get('pending')}")
        print(f"Classification Breakdown: Tampered={summary.get('tampered_count')}, Authentic={summary.get('authentic_count')}")
        print(f"Total Scan Duration: {data.get('scan_duration')}s")

        results = data.get("results", [])
        assert len(results) == 5, f"Expected 5 results, got {len(results)}"
        assert summary.get("processed") == 5, f"Expected 5 processed, got {summary.get('processed')}"
        assert summary.get("failed") == 0, f"Expected 0 failed, got {summary.get('failed')}"

        print("\nIndividual Evidence Analysis Results:")
        for idx, r in enumerate(results, 1):
            print(f"  [{idx}/5] Evidence ID {r['evidence_id']} ({r['original_name']}):")
            print(f"        Classification: {r['classification'].upper()} ({r['assessment_code']})")
            print(f"        Probabilities: Tampered={r['tampered_probability']:.2%} | Authentic={r['authentic_probability']:.2%}")
            print(f"        Localization: Available={r['localization_available']} | Overlay={r['overlay_artifact_path']}")
            print(f"        Latency: {r['inference_time_seconds'] * 1000:.1f}ms")

            # Check individual validity
            assert r["status"] == "completed"
            assert r["classification"] in ["tampered", "authentic"]
            assert 0.0 <= r["tampered_probability"] <= 1.0
            assert 0.0 <= r["authentic_probability"] <= 1.0
            assert r["overlay_artifact_path"].startswith("/uploads/analysis/")

        # 4. Verify all 5 individual records exist in AIAnalysis table using fresh DB session
        db.close()
        fresh_db = SessionLocal()
        try:
            for ev_id in created_evidence_ids:
                an_record = fresh_db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev_id).first()
                assert an_record is not None, f"Missing AIAnalysis record for evidence_id {ev_id}"
                assert an_record.tampered_probability is not None
                assert an_record.overlay_path is not None
        finally:
            fresh_db.close()

        print("\n✓ Milestone 6 Multiple Evidence Processing test PASSED successfully.")
        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_multiple_evidence_processing())
