import sys
import os
import shutil
import time

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum, ForensicScan, AIAnalysis
from app.models.user import User
from app.utils.auth import create_access_token


def test_end_to_end_investigation_workflow():
    """
    Milestone 15 E2E Test:
    Simulates a full real-world investigation lifecycle across 4 evidence images:
    Create Investigation -> Upload 4 Evidence Files -> Trigger Sentinel AI V1.7-A ->
    Verify Dual-Head Classification & Localization Artifacts -> Verify DB Persistence ->
    Fetch Case Summary -> Generate & Download Official Forensic PDF Report.
    """
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None, "User required for E2E testing"

        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role_id": user.role_id})
        headers = {"Authorization": f"Bearer {token}"}
        client = TestClient(app)

        # STAGE 1: Create Investigation Case
        print("\n--- STAGE 1: Creating New Investigation Case ---")
        case_number = f"INV-E2E-{int(time.time())}"
        case = InvestigationCase(
            case_number=case_number,
            title="Full End-to-End Sentinel AI Investigation Audit",
            description="Real-world multi-evidence verification of Sentinel AI V1.7-A dual-head pipeline.",
            created_by=user.id,
            assigned_expert=user.id,
            status=StatusEnum.CASE_FILED
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        print(f"✓ Investigation Created: ID={case.id}, Number={case.case_number}")

        # STAGE 2: Upload 4 Evidence Images
        print("\n--- STAGE 2: Uploading 4 Evidence Images ---")
        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        assert os.path.exists(sample_img_src), f"Sample image missing: {sample_img_src}"

        evidence_ids = []
        for i in range(1, 5):
            target_filename = f"e2e_evidence_00{i}.jpg"
            target_path = os.path.join(backend_dir, "uploads", target_filename)
            shutil.copyfile(sample_img_src, target_path)

            ev = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name=target_filename,
                original_name=f"CCTV_Frame_00{i}.jpg",
                file_type=FileTypeEnum.IMAGE,
                mime_type="image/jpeg",
                file_size=os.path.getsize(target_path),
                storage_path=target_path,
                sha256_hash=f"57244f424f284ffbb6aae62425f06ea50000000000000000000000000000000{i}"
            )
            db.add(ev)
            db.commit()
            db.refresh(ev)
            evidence_ids.append(ev.id)
            print(f"  + Evidence #{i} Uploaded: ID={ev.id}, Hash={ev.sha256_hash[:16]}...")

        # STAGE 3 & 4: Trigger Sentinel AI V1.7-A Dual-Head Analysis
        print("\n--- STAGE 3 & 4: Executing Sentinel AI V1.7-A Dual-Head Analysis ---")
        scan_response = client.post(f"/api/v1/user/cases/{case.id}/scan", headers=headers)
        assert scan_response.status_code == 200, f"Analysis failed: {scan_response.text}"

        scan_data = scan_response.json()
        assert scan_data.get("scan_status") == "COMPLETED"
        results = scan_data.get("results", [])
        assert len(results) == 4, f"Expected 4 evidence results, got {len(results)}"
        print(f"✓ Scan Completed in {scan_data.get('scan_duration')}s across {len(results)} items.")

        # STAGE 5: Verify Classification & Localization Artifacts
        print("\n--- STAGE 5: Verifying Dual-Head Classification & Localization Maps ---")
        for idx, res in enumerate(results, 1):
            assert res.get("classification") in ["tampered", "authentic"]
            assert "tampered_probability" in res
            assert "authentic_probability" in res
            assert res.get("classification_threshold") == 0.40
            assert res.get("localization_threshold") == 0.35
            
            overlay_rel = res.get("overlay_artifact_path") or res.get("overlay_path")
            mask_rel = res.get("mask_artifact_path") or res.get("mask_path")
            
            assert overlay_rel is not None, f"Overlay artifact path missing for evidence #{idx}"
            assert mask_rel is not None, f"Mask artifact path missing for evidence #{idx}"

            overlay_disk = os.path.join(backend_dir, overlay_rel.lstrip("/"))
            mask_disk = os.path.join(backend_dir, mask_rel.lstrip("/"))

            assert os.path.exists(overlay_disk), f"Overlay image missing on disk: {overlay_disk}"
            assert os.path.exists(mask_disk), f"Mask image missing on disk: {mask_disk}"

            print(f"  Evidence #{idx} ({res['original_name']}):")
            print(f"    - Classification: {res['classification'].upper()}")
            print(f"    - Tampered Probability: {(res['tampered_probability'] * 100):.1f}%")
            print(f"    - Overlay Artifact: {overlay_rel}")

        # STAGE 6: Verify Database Storage
        print("\n--- STAGE 6: Verifying Persistent Database Storage ---")
        db.close()
        verify_db = SessionLocal()
        scans = verify_db.query(ForensicScan).filter(ForensicScan.case_id == case.id).all()
        assert len(scans) >= 1, "ForensicScan record persisted in DB"
        
        analyses = verify_db.query(AIAnalysis).filter(AIAnalysis.evidence_id.in_(evidence_ids)).all()
        assert len(analyses) == 4, "4 AIAnalysis records persisted in DB"
        print(f"✓ DB Persistence Confirmed: {len(scans)} ForensicScan, {len(analyses)} AIAnalysis records.")
        verify_db.close()

        # STAGE 7: Retrieve Case Summary
        print("\n--- STAGE 7: Retrieving Case Summary via GET Endpoint ---")
        get_summary = client.get(f"/api/v1/user/cases/{case.id}/scan", headers=headers)
        assert get_summary.status_code == 200
        summary_body = get_summary.json()
        assert summary_body.get("scan") is not None
        print("✓ Case Summary Retrieved Successfully.")

        # STAGE 8: Generate & Download Official Forensic PDF Report
        print("\n--- STAGE 8: Generating & Downloading Official PDF Report ---")
        pdf_response = client.get(f"/api/v1/user/cases/{case.id}/report/pdf", headers=headers)
        assert pdf_response.status_code == 200
        assert pdf_response.headers["content-type"] == "application/pdf"

        output_pdf_file = os.path.join(backend_dir, "uploads", "reports", f"E2E_{case.case_number}.pdf")
        with open(output_pdf_file, "wb") as f:
            f.write(pdf_response.content)

        assert os.path.exists(output_pdf_file)
        pdf_size = os.path.getsize(output_pdf_file)
        assert pdf_size > 10000, f"PDF file size suspiciously small: {pdf_size} bytes"
        print(f"✓ Official PDF Forensic Report Generated & Downloaded ({pdf_size} bytes) at: {output_pdf_file}")

        print("\n" + "=" * 60)
        print(" SENTINEL AI END-TO-END INVESTIGATION TEST: SUCCESS")
        print("=" * 60)
        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_end_to_end_investigation_workflow())
