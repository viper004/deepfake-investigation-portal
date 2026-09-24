import os
import json
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.models import (
    InvestigationCase, EvidenceFile, AIModel, AIAnalysis,
    ForensicScan, AIResultEnum, MediaTypeEnum, StatusEnum, Report, ReportTypeEnum
)
from app.models.user import User
from sentinel.inference import SentinelInferenceEngine
from sentinel.localization import create_localization_artifacts


def ensure_sentinel_ai_model(db: Session) -> AIModel:
    """
    Ensures Sentinel AI V1.7-A is registered in the ai_models database table.
    """
    model = db.query(AIModel).filter(
        AIModel.model_name.ilike("%Sentinel AI%"),
        AIModel.status == True
    ).first()

    if not model:
        model = AIModel(
            model_name="Sentinel AI V1.7-A Dual-Head",
            version="1.7.0",
            media_type=MediaTypeEnum.IMAGE,
            accuracy=99.4,
            description="Production dual-head deepfake detection and pixel-level manipulation localization engine.",
            status=True
        )
        db.add(model)
        db.commit()
        db.refresh(model)

    return model


def analyze_investigation_evidence(
    case: InvestigationCase,
    evidence_files: List[EvidenceFile],
    db: Session,
    user: User
) -> Dict[str, Any]:
    """
    Runs real Sentinel AI V1.7-A inference across all evidence files belonging to an investigation.
    Generates localization artifacts and persists AI results to the database.
    """
    if not evidence_files:
        raise ValueError("No evidence files provided for investigation analysis.")

    engine = SentinelInferenceEngine.get_instance()
    ai_model_record = ensure_sentinel_ai_model(db)

    results: List[Dict[str, Any]] = []
    base_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    output_analysis_dir = os.path.join(base_backend_dir, "uploads", "analysis")
    os.makedirs(output_analysis_dir, exist_ok=True)

    total_start_time = time.perf_counter()

    for idx, ef in enumerate(evidence_files, 1):
        if not ef.storage_path or not os.path.exists(ef.storage_path):
            results.append({
                "evidence_id": ef.id,
                "file_name": ef.file_name,
                "original_name": ef.original_name,
                "status": "failed",
                "error": "Evidence file missing on disk."
            })
            continue

        try:
            # 1. Run real Sentinel AI inference
            inf_res = engine.analyze_image(ef.storage_path)

            # 2. Generate forensic localization artifacts
            base_name = f"case_{case.id}_ev_{ef.id}_{int(time.time())}"
            artifacts = create_localization_artifacts(
                original_image_input=ef.storage_path,
                localization_mask=inf_res["localization_mask"],
                output_dir=output_analysis_dir,
                base_name=base_name,
                localization_threshold=inf_res["localization_threshold"]
            )

            rel_mask_path = f"/uploads/analysis/{os.path.basename(artifacts['mask_path'])}"
            rel_overlay_path = f"/uploads/analysis/{os.path.basename(artifacts['overlay_path'])}"

            # 3. Map classification result to AIResultEnum
            is_tampered = inf_res["classification"] == "tampered"
            ai_enum_result = AIResultEnum.DEEPFAKE if is_tampered else AIResultEnum.REAL

            # 4. Persist AIAnalysis record with all forensic metadata
            analysis_record = AIAnalysis(
                evidence_id=ef.id,
                model_id=ai_model_record.id,
                result=ai_enum_result,
                confidence_score=inf_res["tampered_probability"] if is_tampered else inf_res["authentic_probability"],
                tampered_probability=inf_res["tampered_probability"],
                authentic_probability=inf_res["authentic_probability"],
                classification_threshold=inf_res["classification_threshold"],
                localization_available=inf_res["localization_available"],
                localization_threshold=inf_res["localization_threshold"],
                mask_path=rel_mask_path,
                overlay_path=rel_overlay_path,
                processing_time=inf_res["inference_time_seconds"],
                device=inf_res["device"],
                model_version=inf_res["model_version"],
                sha256_hash=ef.sha256_hash,
                details_json={
                    "metrics": inf_res.get("metrics", {}),
                    "original_size": inf_res.get("original_size"),
                    "classification": inf_res["classification"]
                },
                report_path=rel_overlay_path
            )
            db.add(analysis_record)

            evidence_result = {
                "evidence_id": ef.id,
                "file_name": ef.file_name,
                "original_name": ef.original_name,
                "file_type": ef.file_type.value if hasattr(ef.file_type, "value") else str(ef.file_type),
                "mime_type": ef.mime_type,
                "sha256_hash": ef.sha256_hash,
                "classification": inf_res["classification"],
                "assessment": "LIKELY MANIPULATED" if is_tampered else "AUTHENTIC MEDIA",
                "assessment_code": "DEEPFAKE" if is_tampered else "REAL",
                "tampered_probability": inf_res["tampered_probability"],
                "authentic_probability": inf_res["authentic_probability"],
                "deepfake_probability": round(inf_res["tampered_probability"] * 100, 1),
                "manipulation_confidence": round(inf_res["tampered_probability"] * 100, 1) if is_tampered else round(inf_res["authentic_probability"] * 100, 1),
                "classification_threshold": inf_res["classification_threshold"],
                "localization_available": inf_res["localization_available"],
                "localization_threshold": inf_res["localization_threshold"],
                "mask_artifact_path": rel_mask_path,
                "overlay_artifact_path": rel_overlay_path,
                "inference_time_seconds": inf_res["inference_time_seconds"],
                "model_version": inf_res["model_version"],
                "device": inf_res["device"],
                "status": "completed"
            }
            results.append(evidence_result)

        except Exception as err:
            results.append({
                "evidence_id": ef.id,
                "file_name": ef.file_name,
                "original_name": ef.original_name,
                "status": "failed",
                "error": str(err)
            })

    total_duration = round(time.perf_counter() - total_start_time, 2)

    # 5. Persist aggregate ForensicScan record
    scan_record = ForensicScan(
        case_id=case.id,
        scanned_by=user.id,
        scan_status="COMPLETED",
        scan_duration=total_duration,
        evidence_count=len(results),
        results_json=json.dumps(results),
        pdf_path=None
    )
    db.add(scan_record)

    # Update case status if in early stages
    if case.status in [StatusEnum.CASE_FILED, StatusEnum.CASE_OPENED, StatusEnum.OPEN, StatusEnum.DRAFT]:
        case.status = StatusEnum.CASE_UNDER_INVESTIGATION

    db.commit()
    db.refresh(scan_record)

    return {
        "success": True,
        "investigation_id": case.case_number,
        "case_id": case.id,
        "status": "completed",
        "evidence_count": len(results),
        "scan_id": scan_record.id,
        "scan_duration": total_duration,
        "results": results
    }
