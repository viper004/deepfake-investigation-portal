import sys
import os
import time
import shutil
from typing import List

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sentinel.inference import SentinelInferenceEngine
from sentinel.localization import create_localization_artifacts
from app.database.database import SessionLocal
from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum
from app.models.user import User
from app.services.sentinel_service import analyze_investigation_evidence
from app.services.forensic_report import generate_forensic_pdf_report


def test_performance_benchmarks():
    """
    Milestone 14 Test: Measure performance metrics:
    - Model initial loading time
    - Model singleton reuse loading time
    - Single image inference time
    - Localization artifact generation time
    - PDF report generation time
    - Total investigation processing time for multi-image batch
    """
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None

        # 1. Benchmark Model Load Time (First Load vs Singleton Reuse)
        t0 = time.perf_counter()
        engine1 = SentinelInferenceEngine.get_instance()
        first_load_time = time.perf_counter() - t0

        t1 = time.perf_counter()
        engine2 = SentinelInferenceEngine.get_instance()
        reuse_load_time = time.perf_counter() - t1

        assert engine1 is engine2, "Inference engine must be a Singleton"
        assert reuse_load_time < 0.001, "Singleton instance retrieval should be near-instantaneous"

        # 2. Benchmark Single Image Inference Time
        sample_img = os.path.join(backend_dir, "uploads", "57244f424f284ffbb6aae62425f06ea5.jpg")
        assert os.path.exists(sample_img), f"Sample image missing: {sample_img}"

        t2 = time.perf_counter()
        inf_res = engine1.analyze_image(sample_img)
        single_inference_time = time.perf_counter() - t2

        assert single_inference_time < 2.0, f"Single image inference took too long: {single_inference_time:.4f}s"

        # 3. Benchmark Localization Generation Time
        out_dir = os.path.join(backend_dir, "uploads", "analysis")
        t3 = time.perf_counter()
        loc_res = create_localization_artifacts(
            original_image_input=sample_img,
            localization_mask=inf_res["localization_mask"],
            output_dir=out_dir,
            base_name="perf_test_loc",
            localization_threshold=inf_res["localization_threshold"]
        )
        localization_gen_time = time.perf_counter() - t3
        assert os.path.exists(loc_res["overlay_path"])

        # 4. Benchmark Multi-Evidence Investigation Batch Processing
        case = db.query(InvestigationCase).filter(InvestigationCase.case_number == "CASE-TEST-PERF").first()
        if not case:
            case = InvestigationCase(
                case_number="CASE-TEST-PERF",
                title="Milestone 14 Performance Test",
                description="Benchmarking multi-image batch processing and PDF report speed.",
                created_by=user.id,
                assigned_expert=user.id,
                status=StatusEnum.CASE_FILED
            )
            db.add(case)
            db.commit()
            db.refresh(case)

        evidence_list: List[EvidenceFile] = []
        for i in range(1, 4):
            target_path = os.path.join(backend_dir, "uploads", f"perf_ev_{i}.jpg")
            shutil.copyfile(sample_img, target_path)
            ev = db.query(EvidenceFile).filter(EvidenceFile.file_name == f"perf_ev_{i}.jpg").first()
            if not ev:
                ev = EvidenceFile(
                    case_id=case.id,
                    uploaded_by=user.id,
                    file_name=f"perf_ev_{i}.jpg",
                    original_name=f"batch_photo_{i}.jpg",
                    file_type=FileTypeEnum.IMAGE,
                    mime_type="image/jpeg",
                    file_size=os.path.getsize(target_path),
                    storage_path=target_path,
                    sha256_hash="57244f424f284ffbb6aae62425f06ea500000000000000000000000000000000"
                )
                db.add(ev)
                db.commit()
                db.refresh(ev)
            evidence_list.append(ev)

        t4 = time.perf_counter()
        batch_res = analyze_investigation_evidence(case, evidence_list, db, user)
        batch_investigation_time = time.perf_counter() - t4

        # 5. Benchmark PDF Generation Time
        pdf_out = os.path.join(backend_dir, "uploads", "reports", "perf_report.pdf")
        t5 = time.perf_counter()
        generate_forensic_pdf_report(case, user, user, evidence_list, batch_res, pdf_out)
        pdf_gen_time = time.perf_counter() - t5

        print("\n" + "=" * 50)
        print(" SENTINEL AI PERFORMANCE METRICS")
        print("=" * 50)
        print(f" Device:                           {inf_res['device']}")
        print(f" Initial Model Loading Time:       {first_load_time:.4f}s")
        print(f" Singleton Load Reuse Time:        {reuse_load_time * 1000:.4f}ms")
        print(f" Single Image Inference Time:      {single_inference_time:.4f}s")
        print(f" Localization Map Generation Time: {localization_gen_time:.4f}s")
        print(f" Batch (3 Images) Processing Time: {batch_investigation_time:.4f}s")
        print(f" PDF Report Generation Time:       {pdf_gen_time:.4f}s")
        print("=" * 50)

        return 0

    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(test_performance_benchmarks())
