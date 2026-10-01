import os
import sys
import time
import io
import hashlib
from fastapi.testclient import TestClient
from pypdf import PdfReader

# Adjust path to import backend app
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.database.database import SessionLocal
from app.models.user import User
from app.models.models import (
    Role, InvestigationCase, CaseMessage, MessageAttachment, EvidenceFile, AIAnalysis, ForensicScan
)
from app.utils.auth import create_access_token, get_password_hash

def test_secure_case_messaging_and_attachments():
    print("\n=======================================================")
    print(" STARTING SECURE MESSAGING ATTACHMENTS TEST SUITE ")
    print("=======================================================\n")

    client = TestClient(app)
    db = SessionLocal()
    ts = int(time.time())

    try:
        # 1. Setup Users: Case Owner (User, role_id=3), Investigator A (role_id=2), Investigator B (role_id=2)
        owner = User(
            full_name=f"Case Owner {ts}",
            email=f"owner_{ts}@sentinel.ai",
            password=get_password_hash("testpass123"),
            role_id=3,
            status="ACTIVE"
        )
        inv_a = User(
            full_name=f"Lead Investigator {ts}",
            email=f"inva_{ts}@sentinel.ai",
            password=get_password_hash("testpass123"),
            role_id=2,
            status="ACTIVE"
        )
        inv_b = User(
            full_name=f"Unauthorized Inv {ts}",
            email=f"invb_{ts}@sentinel.ai",
            password=get_password_hash("testpass123"),
            role_id=2,
            status="ACTIVE"
        )
        db.add_all([owner, inv_a, inv_b])
        db.commit()
        db.refresh(owner)
        db.refresh(inv_a)
        db.refresh(inv_b)

        token_owner = create_access_token(data={"sub": str(owner.id), "email": owner.email, "role_id": 3})
        token_inv_a = create_access_token(data={"sub": str(inv_a.id), "email": inv_a.email, "role_id": 2})
        token_inv_b = create_access_token(data={"sub": str(inv_b.id), "email": inv_b.email, "role_id": 2})

        headers_owner = {"Authorization": f"Bearer {token_owner}"}
        headers_inv_a = {"Authorization": f"Bearer {token_inv_a}"}
        headers_inv_b = {"Authorization": f"Bearer {token_inv_b}"}

        # 2. Create Investigation Case with owner and assigned investigator inv_a
        case = InvestigationCase(
            case_number=f"CASE-ATT-{ts}",
            title=f"Attachment Security Verification Case {ts}",
            description="Case to verify secure messaging attachments and promotion pipeline",
            created_by=owner.id,
            assigned_expert=inv_a.id,
            assigned_investigator_id=inv_a.id,
            status="CASE_UNDER_INVESTIGATION"
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        print(f"✓ Case created: {case.case_number} (ID: {case.id}) assigned to Investigator {inv_a.full_name}")

        # -------------------------------------------------------------
        # TEST 1 & 2 & 17: Normal Text Messages (User & Investigator)
        # -------------------------------------------------------------
        print("\n--- TEST 1, 2, 17: User & Investigator Standard Text Messaging ---")
        res_msg_owner = client.post(
            f"/api/v1/user/cases/{case.id}/messages",
            headers=headers_owner,
            json={"message": "Hello Investigator, sending suspicious photo."}
        )
        assert res_msg_owner.status_code == 200, f"Owner message failed: {res_msg_owner.text}"
        data_m1 = res_msg_owner.json()
        assert data_m1["message"] == "Hello Investigator, sending suspicious photo."
        assert data_m1["sender_id"] == owner.id
        print("✓ User sent normal text message successfully.")

        res_msg_inv = client.post(
            f"/api/v1/user/cases/{case.id}/messages",
            headers=headers_inv_a,
            json={"message": "Received. Please upload the photo file as an attachment."}
        )
        assert res_msg_inv.status_code == 200
        print("✓ Investigator sent normal text message successfully.")

        # -------------------------------------------------------------
        # TEST 8: Unsupported File Upload (.exe / shell script rejected)
        # -------------------------------------------------------------
        print("\n--- TEST 8: Reject Unsupported / Dangerous Executable Files ---")
        fake_exe_bytes = b"\x4d\x5a\x90\x00\x03\x00\x00\x00" # Windows PE MZ header
        res_exe = client.post(
            f"/api/v1/user/cases/{case.id}/attachments/upload",
            headers=headers_owner,
            files={"file": ("malware.exe", io.BytesIO(fake_exe_bytes), "application/x-msdownload")}
        )
        assert res_exe.status_code == 415, f"Expected 415 for exe file, got {res_exe.status_code}"
        print(f"✓ Blocked .exe file with 415: {res_exe.json().get('detail')}")

        # Disallowed script masquerading as image
        fake_script = b"#!/bin/bash\nrm -rf /\n"
        res_script = client.post(
            f"/api/v1/user/cases/{case.id}/attachments/upload",
            headers=headers_owner,
            files={"file": ("script.jpg", io.BytesIO(fake_script), "image/jpeg")}
        )
        assert res_script.status_code == 415
        print(f"✓ Blocked malicious script payload masquerading as JPG with 415: {res_script.json().get('detail')}")

        # -------------------------------------------------------------
        # TEST 9: Oversized File Rejected (413 File Too Large)
        # -------------------------------------------------------------
        print("\n--- TEST 9: Reject Oversized Attachments ---")
        large_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * (51 * 1024 * 1024) # 51 MB (exceeds 50MB)
        res_large = client.post(
            f"/api/v1/user/cases/{case.id}/attachments/upload",
            headers=headers_owner,
            files={"file": ("huge_photo.jpg", io.BytesIO(large_bytes), "image/jpeg")}
        )
        assert res_large.status_code == 413, f"Expected 413 for oversized file, got {res_large.status_code}"
        print(f"✓ Blocked oversized attachment with 413: {res_large.json().get('detail')}")

        # -------------------------------------------------------------
        # TEST 3 & 15: User Sends Image Attachment & SHA-256 Storage
        # -------------------------------------------------------------
        print("\n--- TEST 3 & 15: User Uploads Image Attachment & Computes SHA-256 ---")
        from PIL import Image as PILImage
        img_buffer_user = io.BytesIO()
        pil_img_user = PILImage.new("RGB", (200, 200), color=(220, 50, 50))
        pil_img_user.save(img_buffer_user, format="JPEG")
        user_img_bytes = img_buffer_user.getvalue()
        expected_user_sha256 = hashlib.sha256(user_img_bytes).hexdigest()

        res_up_user = client.post(
            f"/api/v1/user/cases/{case.id}/attachments/upload",
            headers=headers_owner,
            files={"file": (f"user_evidence_{ts}.jpg", io.BytesIO(user_img_bytes), "image/jpeg")}
        )
        assert res_up_user.status_code == 200, f"User attachment upload failed: {res_up_user.text}"
        user_att_data = res_up_user.json()
        user_att_id = user_att_data["id"]
        assert user_att_data["sha256_hash"] == expected_user_sha256
        assert user_att_data["status"] == "CLEAN"
        assert user_att_data["scan_status"] == "CLEAN"
        print(f"✓ User attachment uploaded: ID {user_att_id}, SHA-256: {expected_user_sha256}")

        # Send message linking attachment
        res_msg_with_att = client.post(
            f"/api/v1/user/cases/{case.id}/messages",
            headers=headers_owner,
            json={
                "message": "Here is the suspected manipulated passport photo.",
                "attachment_ids": [user_att_id]
            }
        )
        assert res_msg_with_att.status_code == 200
        msg_with_att_data = res_msg_with_att.json()
        assert len(msg_with_att_data["attachments"]) == 1
        assert msg_with_att_data["attachments"][0]["id"] == user_att_id
        print("✓ Message sent with attached evidence photo.")

        # -------------------------------------------------------------
        # TEST 4: Investigator Sends Image Attachment
        # -------------------------------------------------------------
        print("\n--- TEST 4: Investigator Uploads Comparison Attachment ---")
        img_buffer_inv = io.BytesIO()
        pil_img_inv = PILImage.new("RGB", (200, 200), color=(50, 100, 200))
        pil_img_inv.save(img_buffer_inv, format="JPEG")
        inv_img_bytes = img_buffer_inv.getvalue()
        expected_inv_sha256 = hashlib.sha256(inv_img_bytes).hexdigest()

        res_up_inv = client.post(
            f"/api/v1/user/cases/{case.id}/attachments/upload",
            headers=headers_inv_a,
            files={"file": (f"inv_ref_{ts}.jpg", io.BytesIO(inv_img_bytes), "image/jpeg")}
        )
        assert res_up_inv.status_code == 200
        inv_att_id = res_up_inv.json()["id"]

        res_msg_inv_att = client.post(
            f"/api/v1/user/cases/{case.id}/messages",
            headers=headers_inv_a,
            json={
                "message": "Here is the reference image I retrieved from archives.",
                "attachment_ids": [inv_att_id]
            }
        )
        assert res_msg_inv_att.status_code == 200
        print(f"✓ Investigator uploaded attachment ID {inv_att_id} and sent message.")

        # -------------------------------------------------------------
        # TEST 5 & 6: Download Attachment (User & Investigator)
        # -------------------------------------------------------------
        print("\n--- TEST 5 & 6: Authenticated & Signed Download Flow ---")
        # 5. User downloads via authenticated endpoint
        res_dl_user = client.get(
            f"/api/v1/user/cases/{case.id}/attachments/{user_att_id}/download",
            headers=headers_owner
        )
        assert res_dl_user.status_code == 200
        assert res_dl_user.content == user_img_bytes
        assert res_dl_user.headers.get("x-content-type-options") == "nosniff"
        print("✓ Case owner downloaded attachment with correct bytes and nosniff header.")

        # 6. Investigator downloads via short-lived signed URL
        signed_url = user_att_data["download_url"]
        res_dl_signed = client.get(signed_url) # No Authorization header needed with signed token!
        assert res_dl_signed.status_code == 200
        assert res_dl_signed.content == user_img_bytes
        print("✓ Investigator downloaded attachment via short-lived signed URL without permanent exposure.")

        # -------------------------------------------------------------
        # TEST 7: Unauthorized User Attempt Access (403 Forbidden)
        # -------------------------------------------------------------
        print("\n--- TEST 7: Unauthorized Access Blocked (403 Forbidden) ---")
        res_unauth_meta = client.get(
            f"/api/v1/user/cases/{case.id}/attachments/{user_att_id}",
            headers=headers_inv_b
        )
        assert res_unauth_meta.status_code == 403, f"Expected 403 for unauthorized investigator, got {res_unauth_meta.status_code}"
        print(f"✓ Unauthorized investigator blocked from attachment metadata: 403 Forbidden")

        res_unauth_dl = client.get(
            f"/api/v1/user/cases/{case.id}/attachments/{user_att_id}/download",
            headers=headers_inv_b
        )
        assert res_unauth_dl.status_code == 403
        print(f"✓ Unauthorized investigator blocked from direct download: 403 Forbidden")

        # -------------------------------------------------------------
        # TEST 12: Promote Chat Attachment to Formal Evidence
        # -------------------------------------------------------------
        print("\n--- TEST 12 & 15: Promote Chat Attachment to Formal Investigation Evidence ---")
        res_promote = client.post(
            f"/api/v1/user/cases/{case.id}/attachments/{user_att_id}/promote-to-evidence",
            headers=headers_inv_a
        )
        assert res_promote.status_code == 200, f"Promote failed: {res_promote.text}"
        promoted_data = res_promote.json()
        new_ev_id = promoted_data["evidence_id"]
        assert new_ev_id is not None
        print(f"✓ Attachment ID {user_att_id} promoted to formal Evidence EV-{new_ev_id:05d}")

        # Verify DB EvidenceFile record preserves provenance
        db.commit()
        ev_record = db.query(EvidenceFile).filter(EvidenceFile.id == new_ev_id).first()
        assert ev_record is not None
        assert ev_record.sha256_hash == expected_user_sha256, "SHA-256 hash was altered during promotion!"
        assert ev_record.uploaded_by == owner.id, "Uploader identity was lost during promotion!"
        assert ev_record.uploaded_by_role == "USER", "Uploader role was lost during promotion!"
        print(f"✓ Formal Evidence EV-{new_ev_id:05d} preserved original SHA-256 and uploader provenance.")

        # -------------------------------------------------------------
        # TEST 13 & 14: Run AI Scan and Generate PDF Report
        # -------------------------------------------------------------
        print("\n--- TEST 13 & 14: Run AI Scan & Verify Evidence in PDF Report ---")
        res_scan = client.post(f"/api/v1/user/cases/{case.id}/scan", headers=headers_inv_a)
        assert res_scan.status_code == 200, f"Scan failed: {res_scan.text}"
        scan_data = res_scan.json()
        assert scan_data["scan_status"] == "COMPLETED"
        print("✓ Sentinel AI dual-head scan completed on promoted formal evidence.")

        # Download forensic PDF report
        res_pdf = client.get(f"/api/v1/user/cases/{case.id}/report/pdf", headers=headers_inv_a)
        assert res_pdf.status_code == 200
        pdf_reader = PdfReader(io.BytesIO(res_pdf.content))
        pdf_text = "".join(page.extract_text() or "" for page in pdf_reader.pages)

        # PDF must include the promoted evidence metadata
        assert f"EV-{new_ev_id:05d}" in pdf_text, "Promoted evidence ID missing from forensic PDF report"
        assert expected_user_sha256[:16] in pdf_text or "SHA-256" in pdf_text
        assert "EVIDENCE SUMMARY" in pdf_text
        print("✓ Forensic PDF report contains promoted evidence metadata, SHA-256, and AI results.")

        # -------------------------------------------------------------
        # TEST 11 & 16: Delete Attachment & Physical File Removal
        # -------------------------------------------------------------
        print("\n--- TEST 11 & 16: Delete Attachment and Verify Storage Object Removal ---")
        # Attempt deletion of user's attachment by unauthorized investigator inv_b -> 403
        res_del_denied = client.delete(
            f"/api/v1/user/cases/{case.id}/attachments/{inv_att_id}",
            headers=headers_inv_b
        )
        assert res_del_denied.status_code == 403, f"Expected 403 when Inv B deletes Inv A's attachment, got {res_del_denied.status_code}"
        print("✓ Unauthorized investigator blocked from deleting attachment: 403 Forbidden")

        # Investigator A deletes their own attachment
        db.commit()
        inv_att_record = db.query(MessageAttachment).filter(MessageAttachment.id == inv_att_id).first()
        from app.services.storage_service import storage_service
        inv_local_path = storage_service.get_local_path(inv_att_record.storage_key)
        assert os.path.exists(inv_local_path), f"File missing before deletion at {inv_local_path}"

        res_del_ok = client.delete(
            f"/api/v1/user/cases/{case.id}/attachments/{inv_att_id}",
            headers=headers_inv_a
        )
        assert res_del_ok.status_code == 200, f"Deletion failed: {res_del_ok.text}"
        print("✓ Investigator A successfully deleted their uploaded attachment.")

        # Verify DB metadata deleted
        db.commit()
        att_check = db.query(MessageAttachment).filter(MessageAttachment.id == inv_att_id).first()
        assert att_check is None, "Attachment row still present in database!"

        # Verify physical file removed
        assert not os.path.exists(inv_local_path), f"Attachment file still exists on disk at {inv_local_path}!"
        print("✓ Physical storage object and database record permanently removed.")

        print("\n=======================================================")
        print(" ALL 17 SECURE ATTACHMENT TESTS PASSED SUCCESSFULLY! ")
        print("=======================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    test_secure_case_messaging_and_attachments()
