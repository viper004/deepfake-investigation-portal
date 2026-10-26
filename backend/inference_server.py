import os
import sys
import io
import time
import secrets
from fastapi import FastAPI, File, UploadFile, Header, HTTPException, status
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np

# Ensure sentinel module is in path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from sentinel.inference import SentinelInferenceEngine

app = FastAPI(title="Aurora Sentinel AI Inference Microservice", version="1.7.0")

# Service-to-service authentication secret
INFERENCE_API_KEY = os.environ.get("INFERENCE_SERVICE_API_KEY", "aurora_secret_infer_key_91704")

# Load model resident in memory on startup
MODEL_PATH = os.path.join(BASE_DIR, "sentinel_ai_v17a_frozen_dual_head.pth")
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Sentinel checkpoint missing: {MODEL_PATH}")

print(f"[Inference Server] Loading Sentinel AI checkpoint from {MODEL_PATH}...")
engine = SentinelInferenceEngine.get_instance(MODEL_PATH)
print("[Inference Server] Sentinel AI dual-head model resident in memory and ready.")

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "aurora-sentinel-inference",
        "model_version": "V1.7-A",
        "device": str(engine.device)
    }

@app.post("/api/v1/infer")
async def infer_image(
    file: UploadFile = File(...),
    x_inference_key: str = Header(None, alias="X-Inference-Key")
):
    # Verify service-to-service authentication
    if not x_inference_key or not secrets.compare_digest(x_inference_key, INFERENCE_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Inference-Key authorization header."
        )

    # Read and validate payload size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded image exceeds maximum limit of 50 MB."
        )
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file uploaded."
        )

    # Validate image format
    try:
        pil_img = Image.open(io.BytesIO(content))
        pil_img.verify()
    except Exception as img_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {str(img_err)}"
        )

    # Run Sentinel dual-head inference
    try:
        # Re-open image stream since verify() consumes it
        pil_img = Image.open(io.BytesIO(content)).convert("RGB")
        res = engine.analyze_image(pil_img)

        # Convert numpy mask to list for JSON serialization
        mask = res.get("localization_mask")
        if isinstance(mask, np.ndarray):
            mask_list = mask.tolist()
        else:
            mask_list = mask

        return {
            "status": "success",
            "classification": res["classification"],
            "tampered_probability": res["tampered_probability"],
            "authentic_probability": res["authentic_probability"],
            "classification_threshold": res["classification_threshold"],
            "localization_available": res["localization_available"],
            "localization_threshold": res["localization_threshold"],
            "localization_mask": mask_list,
            "original_size": list(res.get("original_size", pil_img.size)),
            "model_version": res.get("model_version", "V1.7-A"),
            "device": res.get("device", "cpu"),
            "inference_time_seconds": res.get("inference_time_seconds", 0.0),
            "metrics": res.get("metrics", {})
        }
    except Exception as inf_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(inf_err)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("inference_server:app", host="127.0.0.1", port=8001, log_level="info")
