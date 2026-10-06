import sys
import os
import time
import io

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, InvestigationNote, StatusEnum, AuditLog
from app.models.user import User, InvestigatorProfile
from app.utils.auth import create_access_token, get_password_hash


def test_full_investigator_case_lifecycle():
    """
    Test the full Sentinel AI Investigator Console lifecycle:
    1. Case Created & Filed
    2. Case Assigned to Investigator Alpha -> Visible in 'Assigned Cases'
    3. Forwarding without evidence is rejected with 400
    4. Evidence & notes added
    5. Investigator Alpha clicks 'Forward to Expert' -> Case moves to FORWARDED_TO_EXPERT
    6. Case removed from Alpha's active 'Assigned Cases'
    7. Case immediately appears in Alpha's 'Completed Cases'
    8. Stats reflects completedCases count
    9. Case is read-only for investigator (evidence upload/delete locked)
    10. Investigator Beta cannot see Alpha's completed case in Beta's Completed Cases
    11. Case available in Expert Review module
    12. Expert verification moves status to VERIFIED
    13. Admin closure moves status to CLOSED while preserving investigator completed record
    """
    db = SessionLocal()
    try:
        ts = int(time.time())

        # 1. Create Case Owner User
        owner = User(
            full_name="Lifecycle Citizen",
            email=f"citizen_{ts}@test.com",
            password=get_password_hash("password123"),
            role_id=3,
            status="ACTIVE"
        )
        db.add(owner)

        # 2. Create Investigator Alpha (role_id = 2)
        inv_alpha = User(
            full_name="Investigator Alpha",
            email=f"alpha_{ts}@test.com",
            password=get_password_hash("password123"),
            role_id=2,
            status="ACTIVE"
        )
        db.add(inv_alpha)

        # 3. Create Investigator Beta (role_id = 2)
        inv_beta = User(
            full_name="Investigator Beta",
            email=f"beta_{ts}@test.com",
            password=get_password_hash("password123"),
            role_id=2,
            status="ACTIVE"
        )
        db.add(inv_beta)

        # 4. Create Expert / Admin User (role_id = 1)
        admin_user = User(
            full_name="System Admin",
            email=f"admin_{ts}@test.com",
            password=get_password_hash("password123"),
            role_id=1,
            status="ACTIVE"
        )
        db.add(admin_user)
        db.commit()

        # Add investigator profiles
        prof_a = InvestigatorProfile(user_id=inv_alpha.id, employee_id=f"EMP-A-{ts}", department="Digital Forensics")
        prof_b = InvestigatorProfile(user_id=inv_beta.id, employee_id=f"EMP-B-{ts}", department="Cyber Crimes")
        db.add_all([prof_a, prof_b])
        db.commit()

        client = TestClient(app)
        owner_token = create_access_token({"sub": str(owner.id), "email": owner.email, "id": owner.id, "role": "USER"})
        alpha_token = create_access_token({"sub": str(inv_alpha.id), "email": inv_alpha.email, "id": inv_alpha.id, "role": "INVESTIGATOR"})
        beta_token = create_access_token({"sub": str(inv_beta.id), "email": inv_beta.email, "id": inv_beta.id, "role": "INVESTIGATOR"})
        admin_token = create_access_token({"sub": str(admin_user.id), "email": admin_user.email, "id": admin_user.id, "role": "ADMIN"})

        # Step 1: Create a Case by Citizen
        create_res = client.post(
            "/api/v1/user/cases",
            headers={"Authorization": f"Bearer {owner_token}"},
            data={
                "title": f"Lifecycle Investigation Case {ts}",
                "description": "Deepfake audio and video extortion investigation"
            }
        )
        assert create_res.status_code == 200, create_res.text
        case_data = create_res.json()
        case_id = case_data["case"]["id"]

        # Step 1b: Citizen uploads initial complaint evidence
        file_bytes = b"Sample citizen complaint evidence"
        cit_upload = client.post(
            "/api/v1/user/evidence/upload",
            headers={"Authorization": f"Bearer {owner_token}"},
            data={"case_id": case_id},
            files={"file": ("citizen_complaint.png", io.BytesIO(file_bytes), "image/png")}
        )
        assert cit_upload.status_code == 200, cit_upload.text

        # Step 1c: Citizen adds initial note
        note_res = client.post(
            f"/api/v1/user/cases/{case_id}/notes",
            headers={"Authorization": f"Bearer {owner_token}"},
            data={"note": "Initial citizen complaint statement regarding fraudulent video call."}
        )
        assert note_res.status_code == 200, note_res.text

        # Step 2: Citizen files/submits the case
        file_res = client.post(
            f"/api/v1/user/cases/{case_id}/submit",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert file_res.status_code == 200, file_res.text

        # Step 3: Investigator Alpha claims the case
        claim_res = client.post(
            f"/api/v1/user/cases/{case_id}/open",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert claim_res.status_code == 200, claim_res.text

        # Step 4: Verify case is in Investigator Alpha's active Assigned Cases
        assigned_res = client.get(
            "/api/v1/user/cases?scope=assigned",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert assigned_res.status_code == 200
        assigned_ids = [c["id"] for c in assigned_res.json()["cases"]]
        assert case_id in assigned_ids, "Case should be in Alpha's active assigned workload"

        # Step 5: Investigator Alpha attempts to forward to Expert without any analysis or investigation notes
        fwd_empty_res = client.post(
            f"/api/v1/user/cases/{case_id}/forward-to-expert",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert fwd_empty_res.status_code == 400, "Should reject forwarding if no analysis or investigation notes exist"
        assert "analysis" in fwd_empty_res.json()["detail"].lower() or "notes" in fwd_empty_res.json()["detail"].lower()

        # Step 6: Investigator Alpha uploads forensic evidence and adds investigation notes
        inv_file_bytes = b"Sample video content for lifecycle test"
        upload_res = client.post(
            "/api/v1/user/evidence/upload",
            headers={"Authorization": f"Bearer {alpha_token}"},
            data={"case_id": case_id},
            files={"file": ("deepfake_audio.mp3", io.BytesIO(inv_file_bytes), "audio/mpeg")}
        )
        assert upload_res.status_code == 200, upload_res.text
        ev_data = upload_res.json()
        evidence_id = ev_data.get("evidence", {}).get("id", ev_data.get("id"))

        # Add an investigator note
        note_res = client.post(
            f"/api/v1/user/cases/{case_id}/investigation-notes",
            headers={"Authorization": f"Bearer {alpha_token}"},
            json={"content": "Initial acoustic analysis completed. Forwarding for expert endorsement."}
        )
        assert note_res.status_code == 200, note_res.text

        # Step 7: Investigator Alpha successfully forwards case to Expert
        fwd_res = client.post(
            f"/api/v1/user/cases/{case_id}/forward-to-expert",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert fwd_res.status_code == 200, fwd_res.text
        fwd_data = fwd_res.json()
        assert fwd_data["status"] == "FORWARDED_TO_EXPERT"
        assert fwd_data["forwarded_to_expert_at"] is not None
        assert fwd_data["investigator_completed_at"] is not None
        assert fwd_data["assigned_investigator_id"] == inv_alpha.id

        # Step 8: Verify case DISAPPEARS from Alpha's active Assigned Cases
        assigned_after = client.get(
            "/api/v1/user/cases?scope=assigned",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert assigned_after.status_code == 200
        assigned_after_ids = [c["id"] for c in assigned_after.json()["cases"]]
        assert case_id not in assigned_after_ids, "Forwarded case must NOT appear in active assigned cases"

        # Step 9: Verify case APPEARS in Alpha's Completed Cases
        completed_res = client.get(
            "/api/v1/user/cases/completed",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert completed_res.status_code == 200
        completed_cases = completed_res.json()["cases"]
        completed_ids = [c["id"] for c in completed_cases]
        assert case_id in completed_ids, "Case must appear in Alpha's completed cases"

        # Check completed case detail payload
        completed_item = next(c for c in completed_cases if c["id"] == case_id)
        assert completed_item["forwarded_date"] is not None
        assert completed_item["is_investigation_completed"] is True
        assert completed_item["expert_review_status"] in ["PENDING", "PENDING_REVIEW", "UNDER_REVIEW"]

        # Step 10: Verify stats reflect completedCases
        stats_res = client.get(
            "/api/v1/user/stats",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert stats["completedCases"] >= 1, "Completed cases count in stats should be >= 1"

        # Step 11: Verify role separation: Investigator Beta does NOT see this completed case
        beta_completed = client.get(
            "/api/v1/user/cases/completed",
            headers={"Authorization": f"Bearer {beta_token}"}
        )
        assert beta_completed.status_code == 200
        beta_completed_ids = [c["id"] for c in beta_completed.json()["cases"]]
        assert case_id not in beta_completed_ids, "Investigator Beta must NOT see cases completed by Investigator Alpha"

        # Step 12: Verify case is available in Expert Review module
        expert_rev_res = client.get(
            "/api/v1/user/cases/expert-review",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert expert_rev_res.status_code == 200
        expert_rev_ids = [c["id"] for c in expert_rev_res.json()["cases"]]
        assert case_id in expert_rev_ids, "Forwarded case must be available in Expert Review module"

        # Step 13: Verify Investigator is locked from modifying completed investigation
        locked_upload = client.post(
            "/api/v1/user/evidence/upload",
            headers={"Authorization": f"Bearer {alpha_token}"},
            data={"case_id": case_id, "evidence_type": "IMAGE", "title": "Locked Evidence"},
            files={"file": ("locked.jpg", io.BytesIO(b"dummy image data"), "image/jpeg")}
        )
        assert locked_upload.status_code == 403, "Investigator cannot upload new evidence to completed case"

        locked_delete = client.delete(
            f"/api/v1/user/evidence/{evidence_id}",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert locked_delete.status_code == 403, "Investigator cannot delete evidence from completed case"

        # Step 14: Expert Verification
        verify_res = client.post(
            f"/api/v1/user/cases/{case_id}/verify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"decision": "VERIFIED", "observations": "Forensic acoustic traces confirmed deepfake synthesis."}
        )
        assert verify_res.status_code == 200, verify_res.text
        v_data = verify_res.json()
        assert v_data["status"] == "VERIFIED"
        assert v_data["expert_verified_at"] is not None

        # Step 15: Case remains visible in Alpha's Completed Cases with VERIFIED review status
        completed_after_v = client.get(
            "/api/v1/user/cases/completed",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert completed_after_v.status_code == 200
        completed_v_item = next(c for c in completed_after_v.json()["cases"] if c["id"] == case_id)
        assert completed_v_item["expert_review_status"] == "VERIFIED"

        # Step 16: Admin Case Closure
        close_res = client.post(
            f"/api/v1/user/cases/{case_id}/close",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert close_res.status_code == 200, close_res.text
        c_data = close_res.json()
        assert c_data["status"] == "CLOSED"
        assert c_data["closed_at"] is not None

        # Verify Alpha can still view completed case details
        detail_res = client.get(
            f"/api/v1/user/cases/{case_id}",
            headers={"Authorization": f"Bearer {alpha_token}"}
        )
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["status"] == "CLOSED"
        assert detail["is_investigation_completed"] is True
        assert detail["forwarded_to_expert_at"] is not None
        assert detail["assigned_investigator_name"] == "Investigator Alpha"

        print("\nAll Lifecycle Integration Assertions Passed Successfully!")

    finally:
        db.close()
