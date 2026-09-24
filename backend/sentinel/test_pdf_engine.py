import sys
import os
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum
from app.models.user import User
from app.services.sentinel_service import analyze_investigation_evidence
from app.services.forensic_report import generate_forensic_pdf_report


def test_pdf_report_engine():
    """
    Milestone 9 Test: Rebuild PDF engine with actual Sentinel AI investigation data,
    Executive Summary, Evidence Item Analysis with heatmaps, Model Methodology, and Disclaimer.
    """
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None, "User required for testing"

        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == "CASE-TEST-M9").first()
        if not case:
            case = InvestigationCase(
                case_number="CASE-TEST-M9",
                title="Milestone 9 PDF Report Engine Test",
                description="Testing real PDF report generation flow with Sentinel AI V1.7-A.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        evidence_target_path = os.path.join(backend_dir, "uploads", "evidence_m9_test.jpg")
        shutil.copyfile(sample_img_src, evidence_target_path)

        ev_file = db.query(EvidenceFile).filter(EvidenceFile.file_name == "evidence_m9_test.jpg").first()
        if not ev_file:
            ev_file = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name="evidence_m9_test.jpg",
                original_name="source_photo_m9.jpg",
                file_type=FileTypeEnum.IMAGE,
                mime_type="image/jpeg",
                file_size=os.path.getsize(evidence_target_path),
                storage_path=evidence_target_path,
                sha256_hash="57244f424f284ffbb6aae62425f06ea500000000000000000000000000000000"
            )
            db.add(ev_file)
            db.commit()
            db.refresh(ev_file)

        # 1. Execute Real Sentinel AI analysis
        ai_res = analyze_investigation_evidence(case, [ev_file], db, user)
        assert ai_res["success"] is True

        # 2. Generate PDF report using real results
        output_pdf_path = os.path.join(backend_dir, "uploads", "reports", "test_report_m9.pdf")
        pdf_result_path = generate_forensic_pdf_report(
            case=case,
            creator_user=user,
            investigator_user=user,
            evidence_files=[ev_file],
            scan_record=ai_res,
            output_path=output_pdf_path
        )

        assert os.path.exists(pdf_result_path), f"PDF file was not created: {pdf_result_path}"
        assert os.path.getsize(pdf_result_path) > 5000, f"Generated PDF file size is suspiciously small: {os.path.getsize(pdf_result_path)} bytes"

        print(f"✓ Generated PDF report successfully ({os.path.getsize(pdf_result_path)} bytes) at: {pdf_result_path}")
        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_pdf_report_engine())
