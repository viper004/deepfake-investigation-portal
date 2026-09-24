import sys
import os
import shutil
import pytest
from PIL import Image

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sentinel.preprocessing import validate_and_load_image
from sentinel.model import load_sentinel_model, resolve_model_path
from sentinel.inference import SentinelInferenceEngine
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum
from app.models.user import User
from app.services.sentinel_service import analyze_investigation_evidence
from app.services.forensic_report import generate_forensic_pdf_report


def test_missing_model_checkpoint(monkeypatch):
    """
    Test 1: Missing model (.pth unavailable).
    Expected: FileNotFoundError / Error. Never generate fake results.
    """
    monkeypatch.setattr("sentinel.model.resolve_model_path", lambda path=None: "/nonexistent/path/sentinel.pth")
    with pytest.raises(FileNotFoundError) as exc_info:
        load_sentinel_model(checkpoint_path="/nonexistent/path/sentinel.pth")
    assert "not found" in str(exc_info.value).lower() or "sentinel" in str(exc_info.value).lower()


def test_corrupted_image(tmp_path):
    """
    Test 2: Corrupted image file.
    Expected: ValueError containing 'Invalid or corrupted evidence image'
    """
    corrupt_path = tmp_path / "corrupt_image.jpg"
    with open(corrupt_path, "wb") as f:
        f.write(b"NOT_AN_IMAGE_HEADER_CORRUPTED_DATA_1234567890")

    with pytest.raises(ValueError) as exc_info:
        validate_and_load_image(str(corrupt_path))
    assert "invalid or corrupted evidence image" in str(exc_info.value).lower()


def test_unsupported_format(tmp_path):
    """
    Test 3: Unsupported evidence file format.
    Expected: ValueError containing 'Unsupported evidence format'
    """
    unsupported_path = tmp_path / "evidence_data.xyz"
    with open(unsupported_path, "w") as f:
        f.write("text content")

    with pytest.raises(ValueError) as exc_info:
        validate_and_load_image(str(unsupported_path))
    assert "unsupported evidence format" in str(exc_info.value).lower()


def test_pdf_failure_preserves_db_analysis():
    """
    Test 4: PDF generation failure must not cause DB analysis loss.
    Expected: Analysis completed but report generation failed message, DB records intact.
    """
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None

        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == "CASE-TEST-M13").first()
        if not case:
            case = InvestigationCase(
                case_number="CASE-TEST-M13",
                title="Milestone 13 Error Handling Test",
                description="Testing PDF failure gracefully preserves stored AI results.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        sample_img_src = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        evidence_target_path = os.path.join(backend_dir, "uploads", "evidence_m13_test.jpg")
        shutil.copyfile(sample_img_src, evidence_target_path)

        ev_file = db.query(EvidenceFile).filter(EvidenceFile.file_name == "evidence_m13_test.jpg").first()
        if not ev_file:
            ev_file = EvidenceFile(
                case_id=case.id,
                uploaded_by=user.id,
                file_name="evidence_m13_test.jpg",
                original_name="source_photo_m13.jpg",
                file_type=FileTypeEnum.IMAGE,
                mime_type="image/jpeg",
                file_size=os.path.getsize(evidence_target_path),
                storage_path=evidence_target_path,
                sha256_hash="57244f424f284ffbb6aae62425f06ea500000000000000000000000000000000"
            )
            db.add(ev_file)
            db.commit()
            db.refresh(ev_file)

        # Execute analysis
        ai_res = analyze_investigation_evidence(case, [ev_file], db, user)
        assert ai_res["success"] is True

        # Simulate PDF generation failure to invalid directory path
        invalid_pdf_path = "/nonexistent_root_dir_1234/report.pdf"
        pdf_error_occurred = False
        try:
            generate_forensic_pdf_report(case, user, user, [ev_file], ai_res, invalid_pdf_path)
        except Exception:
            pdf_error_occurred = True

        assert pdf_error_occurred is True, "Expected PDF generation to raise an exception for invalid path"
        
        # Verify AI results in DB remain intact despite PDF failure
        db.expire_all()
        from app.models.models import AIAnalysis
        analysis_record = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev_file.id).first()
        assert analysis_record is not None, "AI analysis record in DB was preserved despite PDF failure"

        print("✓ Milestone 13 error handling tests passed.")
        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_pdf_failure_preserves_db_analysis())
