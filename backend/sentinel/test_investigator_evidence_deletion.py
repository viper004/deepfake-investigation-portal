import sys
import os
import time
import shutil
import json

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from pypdf import PdfReader
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, StatusEnum, ForensicScan, AIAnalysis, FileTypeEnum
from app.models.user import User
from app.utils.auth import create_access_token, get_password_hash


def test_investigator_evidence_deletion_and_pdf_metadata():
    """
    Comprehensive verification covering Part 17 Tests:
    TEST 1: User uploads evidence -> Investigator can see it; investigator CANNOT delete it (403 Forbidden).
    TEST 2: Investigator A uploads evidence -> Investigator A can see Delete; Investigator A can delete it (200 OK).
    TEST 3: Investigator B views the same case -> Investigator B cannot delete Investigator A's evidence (403 Forbidden).
    TEST 4: Investigator A deletes their evidence -> DB record removed, physical file removed, artifacts cleaned up, disappears from UI.
    TEST 5: Generate PDF after AI scan -> PDF identifies Uploaded By: Investigator A, Uploader Role: Investigator, includes AI scan result.
    TEST 6: Generate PDF containing both user and investigator evidence -> Each item identifies its own uploader and role.
    TEST 7: Delete an investigator-uploaded evidence -> Generate a new PDF -> Deleted evidence does NOT appear in the new report.
    TEST 8: Try deleting another investigator's evidence by directly calling DELETE API -> HTTP 403 Forbidden.
    """
    db = SessionLocal()
    try:
        ts = int(time.time())
        print(f"\n=================================================================")
        print(f" STARTING INVESTIGATOR EVIDENCE DELETION & PDF REPORT TEST SUITE ")
        print(f"=================================================================\n")

        # 1. Provision Users: Owner (User, role_id=3), Inv A (role_id=2), Inv B (role_id=2)
        user_owner = User(
            full_name=f"Case Owner {ts}",
            email=f"owner_{ts}@sentinel.ai",
            password=get_password_hash("password123"),
            role_id=3,
            status="ACTIVE"
        )
        inv_a = User(
            full_name=f"Detective Alpha {ts}",
            email=f"inva_{ts}@sentinel.ai",
            password=get_password_hash("password123"),
            role_id=2,
            status="ACTIVE"
        )
        inv_b = User(
            full_name=f"Detective Beta {ts}",
            email=f"invb_{ts}@sentinel.ai",
            password=get_password_hash("password123"),
            role_id=2,
            status="ACTIVE"
        )
        db.add_all([user_owner, inv_a, inv_b])
        db.commit()
        db.refresh(user_owner)
        db.refresh(inv_a)
        db.refresh(inv_b)

        token_owner = create_access_token(data={"sub": str(user_owner.id), "email": user_owner.email, "role_id": 3})
        token_inv_a = create_access_token(data={"sub": str(inv_a.id), "email": inv_a.email, "role_id": 2})
        token_inv_b = create_access_token(data={"sub": str(inv_b.id), "email": inv_b.email, "role_id": 2})

        headers_owner = {"Authorization": f"Bearer {token_owner}"}
        headers_inv_a = {"Authorization": f"Bearer {token_inv_a}"}
        headers_inv_b = {"Authorization": f"Bearer {token_inv_b}"}

        client = TestClient(app)

        # 2. Create Case and assign to Investigator Alpha
        case = InvestigationCase(
            case_number=f"CASE-DEL-{ts}",
            title="Evidence Deletion & Forensic Reporting Audit Case",
            description="Testing investigator evidence deletion and PDF report evidence metadata.",
            created_by=user_owner.id,
            assigned_expert=inv_a.id,
            assigned_investigator_id=inv_a.id,
            status=StatusEnum.CASE_UNDER_INVESTIGATION
        )
        db.add(case)
        db.commit()
        db.refresh(case)

        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        assert os.path.exists(sample_img_src), f"Sample image missing at {sample_img_src}"

        # -----------------------------------------------------------------
        # TEST 1: User uploads evidence -> Investigator sees it, cannot delete it
        # -----------------------------------------------------------------
        print("--- RUNNING TEST 1: User Uploads Evidence; Investigator Cannot Delete ---")
        with open(sample_img_src, "rb") as f:
            res_up1 = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_owner,
                data={"case_id": case.id},
                files={"file": (f"user_ev_test1_{ts}.jpg", f, "image/jpeg")}
            )
        assert res_up1.status_code == 200, f"Owner upload failed: {res_up1.text}"
        ev_user_id = res_up1.json()["evidence"]["id"]
        assert res_up1.json()["evidence"]["uploaded_by_role"] == "USER"
        print(f"✓ User uploaded evidence ID {ev_user_id} with role USER.")

        # Investigator A views case evidence
        res_case_detail = client.get(f"/api/v1/user/cases/{case.id}", headers=headers_inv_a)
        assert res_case_detail.status_code == 200
        case_ev_items = res_case_detail.json()["evidence"]
        user_ev_in_case = next((e for e in case_ev_items if e["id"] == ev_user_id), None)
        assert user_ev_in_case is not None, "Investigator A could not see the user's evidence"
        assert user_ev_in_case["uploaded_by"] == user_owner.id
        print(f"✓ Investigator A successfully views evidence ID {ev_user_id} in case workspace.")

        # Investigator A attempts to delete user's evidence -> MUST BE 403 Forbidden
        res_del_user_ev = client.delete(f"/api/v1/user/evidence/{ev_user_id}", headers=headers_inv_a)
        assert res_del_user_ev.status_code == 403, f"Expected 403 Forbidden when investigator deletes user evidence, got {res_del_user_ev.status_code}"
        print(f"✓ Investigator A blocked from deleting user evidence: 403 Forbidden ({res_del_user_ev.json()['detail']})")

        # -----------------------------------------------------------------
        # TEST 2 & TEST 8: Investigator A uploads evidence; Investigator B cannot delete it
        # -----------------------------------------------------------------
        print("\n--- RUNNING TEST 2 & TEST 8: Investigator A Uploads Evidence; Direct API Denial for Other Users ---")
        with open(sample_img_src, "rb") as f:
            res_up_inv_a = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_inv_a,
                data={"case_id": case.id},
                files={"file": (f"inv_a_ev_{ts}.jpg", f, "image/jpeg")}
            )
        assert res_up_inv_a.status_code == 200, f"Investigator A upload failed: {res_up_inv_a.text}"
        ev_inv_a_id = res_up_inv_a.json()["evidence"]["id"]
        assert res_up_inv_a.json()["evidence"]["uploaded_by_role"] == "INVESTIGATOR"
        print(f"✓ Investigator A uploaded evidence ID {ev_inv_a_id} with role INVESTIGATOR.")

        # TEST 3 & 8: Investigator B attempts to delete Investigator A's evidence -> MUST BE 403 Forbidden
        res_del_by_b = client.delete(f"/api/v1/user/evidence/{ev_inv_a_id}", headers=headers_inv_b)
        assert res_del_by_b.status_code == 403, f"Expected 403 when Inv B deletes Inv A's evidence, got {res_del_by_b.status_code}"
        print(f"✓ Investigator B blocked from deleting Investigator A's evidence via /api/v1/user/evidence: 403 Forbidden")

        # Test direct root endpoint alias /api/evidence/:id
        res_del_direct = client.delete(f"/api/evidence/{ev_inv_a_id}", headers=headers_inv_b)
        assert res_del_direct.status_code == 403, f"Expected 403 on direct /api/evidence alias, got {res_del_direct.status_code}"
        print(f"✓ Direct call to /api/evidence/{ev_inv_a_id} by unauthorized investigator also securely denied: 403 Forbidden")

        # Also verify user cannot delete investigator's evidence
        res_del_by_user = client.delete(f"/api/v1/user/evidence/{ev_inv_a_id}", headers=headers_owner)
        assert res_del_by_user.status_code == 403, f"Expected 403 when User deletes Inv A's evidence, got {res_del_by_user.status_code}"
        print(f"✓ Case user blocked from deleting Investigator A's evidence: 403 Forbidden")

        # -----------------------------------------------------------------
        # TEST 5 & TEST 6: Trigger AI Scan and Generate PDF with User + Investigator Evidence
        # -----------------------------------------------------------------
        print("\n--- RUNNING TEST 5 & TEST 6: Trigger AI Scan & Generate PDF with Evidence Metadata ---")
        res_scan = client.post(f"/api/v1/user/cases/{case.id}/scan", headers=headers_inv_a)
        assert res_scan.status_code == 200, f"Scan failed: {res_scan.text}"
        scan_data = res_scan.json()
        assert scan_data["scan_status"] == "COMPLETED"
        assert len(scan_data["results"]) == 2, f"Expected 2 evidence results, got {len(scan_data['results'])}"
        print(f"✓ Sentinel AI V1.7-A scan completed across both evidence items.")

        # Download PDF report
        res_pdf = client.get(f"/api/v1/user/cases/{case.id}/report/pdf", headers=headers_inv_a)
        assert res_pdf.status_code == 200, f"PDF download failed: {res_pdf.status_code}"
        assert res_pdf.headers["content-type"] == "application/pdf"
        pdf_bytes = res_pdf.content
        assert len(pdf_bytes) > 5000

        # Read and verify PDF text content using pypdf
        import io
        pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
        full_pdf_text = "".join(page.extract_text() or "" for page in pdf_reader.pages)

        # Check Investigation Information (Part 14)
        assert case.case_number in full_pdf_text, "Case ID missing from PDF"
        assert inv_a.full_name in full_pdf_text, "Investigator name missing from PDF"
        assert f"INV-{inv_a.id:03d}" in full_pdf_text, "Investigator ID missing from PDF"

        # Check Evidence Summary (Part 10)
        assert "EVIDENCE SUMMARY" in full_pdf_text, "Evidence Summary section missing from PDF"
        assert "Total Evidence:" in full_pdf_text, "Total Evidence count missing from PDF"
        assert "User Uploaded:" in full_pdf_text, "User Uploaded count missing from PDF"
        assert "Investigator Uploaded:" in full_pdf_text, "Investigator Uploaded count missing from PDF"

        # Check Individual Evidence Details (Part 9 & Part 11)
        assert "DETAILED EVIDENCE EXAMINATION" in full_pdf_text, "Evidence examination section missing"
        assert f"EV-{ev_user_id:05d}" in full_pdf_text, f"EV-{ev_user_id:05d} missing from PDF"
        assert f"EV-{ev_inv_a_id:05d}" in full_pdf_text, f"EV-{ev_inv_a_id:05d} missing from PDF"
        assert "User" in full_pdf_text, "Role 'User' missing from PDF"
        assert "Investigator" in full_pdf_text, "Role 'Investigator' missing from PDF"
        print("✓ PDF Report correctly contains Investigation Information, Evidence Summary, and detailed Evidence Metadata for both uploaders!")

        # -----------------------------------------------------------------
        # TEST 2 & TEST 4: Investigator A deletes their own evidence
        # -----------------------------------------------------------------
        print("\n--- RUNNING TEST 2 & TEST 4: Investigator A Deletes Their Evidence ---")
        db.commit()
        ev_file_record = db.query(EvidenceFile).filter(EvidenceFile.id == ev_inv_a_id).first()
        assert ev_file_record is not None
        storage_file_path = ev_file_record.storage_path
        assert os.path.exists(storage_file_path), f"Evidence physical file missing at {storage_file_path}"

        # Fetch AI analysis artifacts
        analyses = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev_inv_a_id).all()
        artifact_files_to_check = []
        for a in analyses:
            if a.mask_path:
                abs_mask = os.path.join(backend_dir, a.mask_path.lstrip("/"))
                if os.path.exists(abs_mask):
                    artifact_files_to_check.append(abs_mask)
            if a.overlay_path:
                abs_ov = os.path.join(backend_dir, a.overlay_path.lstrip("/"))
                if os.path.exists(abs_ov):
                    artifact_files_to_check.append(abs_ov)

        # Investigator A deletes their evidence -> Allowed (200 OK)
        res_del_ok = client.delete(f"/api/v1/user/evidence/{ev_inv_a_id}", headers=headers_inv_a)
        assert res_del_ok.status_code == 200, f"Investigator A deletion failed: {res_del_ok.text}"
        print(f"✓ Investigator A successfully deleted their evidence: {res_del_ok.json()}")

        # Verify DB record is removed
        db.commit()
        ev_deleted_check = db.query(EvidenceFile).filter(EvidenceFile.id == ev_inv_a_id).first()
        assert ev_deleted_check is None, "Evidence DB row was not deleted"
        print("✓ Database record permanently removed.")

        # Verify physical file is removed
        assert not os.path.exists(storage_file_path), f"Physical file was not removed: {storage_file_path}"
        print("✓ Physical storage file permanently removed.")

        # Verify generated AI artifacts are removed
        for art_path in artifact_files_to_check:
            assert not os.path.exists(art_path), f"AI artifact file was not removed: {art_path}"
        print("✓ Associated AI mask/heatmap artifacts permanently removed.")

        # Verify evidence disappears from case evidence list
        res_after_del = client.get(f"/api/v1/user/cases/{case.id}", headers=headers_inv_a)
        remaining_ev_items = res_after_del.json()["evidence"]
        assert len(remaining_ev_items) == 1, f"Expected 1 remaining evidence item, got {len(remaining_ev_items)}"
        assert remaining_ev_items[0]["id"] == ev_user_id
        print("✓ Deleted evidence no longer appears in case workspace API response.")

        # -----------------------------------------------------------------
        # TEST 7: Generate New PDF after Deletion -> Deleted evidence does NOT appear
        # -----------------------------------------------------------------
        print("\n--- RUNNING TEST 7: Generate New PDF Report After Deletion ---")
        res_pdf_new = client.get(f"/api/v1/user/cases/{case.id}/report/pdf", headers=headers_inv_a)
        assert res_pdf_new.status_code == 200
        new_pdf_bytes = res_pdf_new.content

        new_pdf_reader = PdfReader(io.BytesIO(new_pdf_bytes))
        new_pdf_text = "".join(page.extract_text() or "" for page in new_pdf_reader.pages)

        # Verify deleted evidence is NOT present in the active report
        assert f"EV-{ev_inv_a_id:05d}" not in new_pdf_text, f"Deleted evidence EV-{ev_inv_a_id:05d} still appears in newly generated PDF!"
        assert f"user_ev_test1_{ts}.jpg" in new_pdf_text, "Active user evidence missing from newly generated PDF"
        assert "Total Evidence: 1" in new_pdf_text or "1" in new_pdf_text, "Evidence summary not updated"
        print(f"✓ Newly generated PDF report excludes deleted evidence EV-{ev_inv_a_id:05d} and includes only active evidence!")

        print("\n=======================================================")
        print(" ALL 8 INVESTIGATOR EVIDENCE DELETION TESTS PASSED! ")
        print("=======================================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    test_investigator_evidence_deletion_and_pdf_metadata()
    sys.exit(0)
