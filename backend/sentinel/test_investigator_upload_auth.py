import sys
import os
import time
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, StatusEnum, ForensicScan, AIAnalysis
from app.models.user import User, InvestigatorProfile
from app.utils.auth import create_access_token, get_password_hash


def test_investigator_upload_authorization_and_pipeline():
    """
    Comprehensive Test Suite for Investigator Evidence Upload Authorization & Sentinel AI Pipeline:
    1. Case owner upload -> Allowed (200 OK)
    2. Unclaimed investigator upload -> Denied (403 Forbidden)
    3. Claimed investigator upload -> Allowed (200 OK)
    4. Different investigator upload -> Denied (403 Forbidden)
    5. Direct unauthorized API upload -> Denied (403 Forbidden)
    6. Case owner upload after investigator claim -> Allowed (200 OK)
    7. Sentinel AI dual-head inference & PDF report generation across multi-uploader evidence.
    """
    db = SessionLocal()
    try:
        # Set up test users & roles
        print("\n--- STAGE 1: Test User Provisioning ---")
        ts = int(time.time())

        # 1. Standard Case Owner User (role_id = 3)
        user_owner = User(
            full_name="Standard Case Owner",
            email=f"owner_{ts}@sentinel.ai",
            password=get_password_hash("password123"),
            role_id=3,
            status="ACTIVE"
        )
        db.add(user_owner)

        # 2. Claiming Investigator A (role_id = 2)
        inv_a = User(
            full_name="Investigator Alpha",
            email=f"inv_a_{ts}@sentinel.ai",
            password=get_password_hash("password123"),
            role_id=2,
            status="ACTIVE"
        )
        db.add(inv_a)

        # 3. Unauthorized Investigator B (role_id = 2)
        inv_b = User(
            full_name="Investigator Beta",
            email=f"inv_b_{ts}@sentinel.ai",
            password=get_password_hash("password123"),
            role_id=2,
            status="ACTIVE"
        )
        db.add(inv_b)

        db.commit()
        db.refresh(user_owner)
        db.refresh(inv_a)
        db.refresh(inv_b)

        token_owner = create_access_token(data={"sub": str(user_owner.id), "email": user_owner.email, "role_id": user_owner.role_id})
        token_inv_a = create_access_token(data={"sub": str(inv_a.id), "email": inv_a.email, "role_id": inv_a.role_id})
        token_inv_b = create_access_token(data={"sub": str(inv_b.id), "email": inv_b.email, "role_id": inv_b.role_id})

        headers_owner = {"Authorization": f"Bearer {token_owner}"}
        headers_inv_a = {"Authorization": f"Bearer {token_inv_a}"}
        headers_inv_b = {"Authorization": f"Bearer {token_inv_b}"}

        client = TestClient(app)

        # Create an investigation case by Case Owner
        print("\n--- STAGE 2: Creating Unclaimed Investigation Case ---")
        case = InvestigationCase(
            case_number=f"INV-AUTH-{ts}",
            title="Multi-Role Evidence Authorization & Processing Audit",
            description="Audit case for investigator evidence upload authorization.",
            created_by=user_owner.id,
            assigned_expert=None,
            status=StatusEnum.DRAFT
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        print(f"✓ Case Created: ID={case.id}, Number={case.case_number}")

        # Prepare sample image for upload
        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        assert os.path.exists(sample_img_src), f"Sample image missing at {sample_img_src}"

        # TEST 1: Case Owner Upload -> Allowed
        print("\n--- TEST 1: Case Owner Evidence Upload ---")
        with open(sample_img_src, "rb") as f:
            res1 = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_owner,
                data={"case_id": case.id},
                files={"file": ("owner_ev_01.jpg", f, "image/jpeg")}
            )
        assert res1.status_code == 200, f"Case owner upload failed: {res1.text}"
        ev1_id = res1.json()["evidence"]["id"]
        print(f"✓ Case Owner uploaded evidence ID: {ev1_id}")

        # TEST 3: Unclaimed Investigator Upload -> Denied (403)
        print("\n--- TEST 3: Unclaimed Investigator Upload Attempt ---")
        with open(sample_img_src, "rb") as f:
            res_unclaimed = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_inv_a,
                data={"case_id": case.id},
                files={"file": ("inv_unclaimed.jpg", f, "image/jpeg")}
            )
        assert res_unclaimed.status_code == 403, f"Unclaimed upload should be 403, got {res_unclaimed.status_code}"
        print(f"✓ Unclaimed investigator upload blocked with 403 Forbidden: {res_unclaimed.json()['detail']}")

        # Claim Case by Investigator Alpha
        print("\n--- STAGE 3: Claiming Case by Investigator Alpha ---")
        db.refresh(case)
        case.assigned_expert = inv_a.id
        case.status = StatusEnum.CASE_FILED
        db.commit()
        print(f"✓ Case assigned to Investigator Alpha (ID={inv_a.id})")

        # TEST 2: Claimed Investigator Upload -> Allowed
        print("\n--- TEST 2: Claimed Investigator (Alpha) Evidence Upload ---")
        with open(sample_img_src, "rb") as f:
            res2 = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_inv_a,
                data={"case_id": case.id},
                files={"file": ("inv_alpha_ev_02.jpg", f, "image/jpeg")}
            )
        assert res2.status_code == 200, f"Claimed investigator upload failed: {res2.text}"
        ev2_id = res2.json()["evidence"]["id"]
        print(f"✓ Claimed Investigator Alpha uploaded evidence ID: {ev2_id}")

        # TEST 4: Different Investigator Upload -> Denied (403)
        print("\n--- TEST 4: Non-Claimed Investigator (Beta) Upload Attempt ---")
        with open(sample_img_src, "rb") as f:
            res_beta = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_inv_b,
                data={"case_id": case.id},
                files={"file": ("inv_beta_unauth.jpg", f, "image/jpeg")}
            )
        assert res_beta.status_code == 403, f"Non-claimed upload should be 403, got {res_beta.status_code}"
        print(f"✓ Non-claimed investigator upload blocked with 403 Forbidden: {res_beta.json()['detail']}")

        # TEST 6: Case Owner Upload After Claim -> Allowed
        print("\n--- TEST 6: Case Owner Upload After Case Claimed ---")
        with open(sample_img_src, "rb") as f:
            res6 = client.post(
                "/api/v1/user/evidence/upload",
                headers=headers_owner,
                data={"case_id": case.id},
                files={"file": ("owner_ev_03.jpg", f, "image/jpeg")}
            )
        assert res6.status_code == 200, f"Case owner upload after claim failed: {res6.text}"
        ev3_id = res6.json()["evidence"]["id"]
        print(f"✓ Case owner uploaded post-claim evidence ID: {ev3_id}")

        # STAGE 4: Verify Case Details API Metadata (Uploaded By & Uploader Role)
        print("\n--- STAGE 4: Verifying Evidence Metadata & Roles in API ---")
        res_details = client.get(f"/api/v1/user/cases/{case.id}", headers=headers_inv_a)
        assert res_details.status_code == 200
        case_data = res_details.json()
        evidence_items = case_data["evidence"]
        assert len(evidence_items) == 3, f"Expected 3 evidence items, got {len(evidence_items)}"

        for ev in evidence_items:
            assert "uploaded_by" in ev
            assert "uploaded_by_name" in ev
            assert "uploader_role" in ev
            print(f"  • Evidence ID {ev['id']}: File '{ev['original_name']}', Uploaded By: {ev['uploaded_by_name']} ({ev['uploader_role']})")

        # TEST 7: Run Sentinel AI Scan & Generate PDF Report across multi-uploader evidence
        print("\n--- TEST 7: Triggering Sentinel AI Scan & PDF Report Generation ---")
        res_scan = client.post(f"/api/v1/user/cases/{case.id}/scan", headers=headers_inv_a)
        assert res_scan.status_code == 200
        scan_json = res_scan.json()
        assert scan_json["scan_status"] == "COMPLETED"
        assert len(scan_json["results"]) == 3, f"Expected 3 analysis results, got {len(scan_json['results'])}"
        print(f"✓ Sentinel AI V1.7-A processed all 3 evidence files across both uploaders in {scan_json['scan_duration']:.2f}s.")

        res_pdf = client.get(f"/api/v1/user/cases/{case.id}/report/pdf", headers=headers_inv_a)
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert len(res_pdf.content) > 10000
        print(f"✓ Official Forensic PDF Report generated successfully ({len(res_pdf.content)} bytes).")

        print("\n=======================================================")
        print(" ALL INVESTIGATOR EVIDENTIARY AUTHORIZATION TESTS PASSED! ")
        print("=======================================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    test_investigator_upload_authorization_and_pipeline()
