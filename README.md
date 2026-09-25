# Sentinel AI — Digital Forensics & Deepfake Investigation Portal

An enterprise-grade digital forensics platform powered by **Sentinel AI V1.7-A**, a frozen dual-head deep learning engine for image deepfake detection and pixel-level spatial manipulation localization.

---

## 🏛️ System Architecture

```text
USER / INVESTIGATOR
        │
        ▼
UPLOAD EVIDENCE FILE
        │
        ├── Validate (Integrity, Format, MIME)
        ├── SHA-256 Hash Computation
        └── Non-Destructive Storage (UUID Filename)
        │
        ▼
SENTINEL AI V1.7-A DUAL-HEAD ENGINE
        │
        ├── Dual Backbone (EfficientNet-B0 + Laplacian High-Pass Residual)
        ├── Classification Head (Softmax Probability vs. 0.40 Threshold)
        └── Localization Head (Spatial Heatmap Mask vs. 0.35 Threshold)
        │
        ▼
FORENSIC ARTIFACT GENERATOR
        │
        ├── Original Image Preservation
        ├── Binary Anomaly Mask PNG
        └── Alpha-Blended Heatmap Overlay PNG
        │
        ▼
DATABASE PERSISTENCE
        │
        ├── AIAnalysis Table (Per-Evidence Metrics & Hashes)
        └── ForensicScan Table (Aggregate Case Scan Records)
        │
        ▼
FORENSIC PDF REPORT ENGINE
        │
        ├── Executive Summary Table
        ├── Detailed Evidence Examinations & Heatmap Previews
        ├── Model Methodology & Technical Details
        └── Official Forensic Disclaimer
        │
        ▼
FRONTEND INVESTIGATION DASHBOARD & PDF DOWNLOAD
```

---

## 📋 Requirements & Dependencies

### Prerequisites
- **Python**: `3.10+`
- **Node.js**: `18.0+`
- **PyTorch**: `2.0+` (CPU / CUDA compatible)

### Backend Dependencies (`backend/requirements.txt`)
- `torch`, `torchvision`, `timm`
- `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`
- `pillow`, `reportlab`, `matplotlib`, `numpy`
- `pymysql`, `alembic`, `python-jose`, `passlib`

---

## 🧠 Model Specifications

- **Model Version**: Sentinel AI V1.7-A Dual-Head Architecture
- **Checkpoint Location**: `backend/sentinel_ai_v17a_frozen_dual_head.pth`
- **Parameters**: 7,968,783 (Frozen weights for deterministic inference)
- **Input Tensor Dimensions**: `[1, 3, 224, 224]` (ImageNet RGB normalized)
- **Calibrated Operational Thresholds**:
  - **Classification Threshold**: `0.40` (Tampered Probability $\ge 0.40 \rightarrow$ `TAMPERED`)
  - **Localization Threshold**: `0.35` (Heatmap Peak Activation $\ge 0.35 \rightarrow$ `Spatial Anomaly Detected`)

---

## 🚀 Running the Application

### 1. Backend Service (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend API server will start at `http://localhost:8000`.

### 2. Frontend Application (Next.js)
```bash
cd frontend
npm run dev
```
Frontend portal will start at `http://localhost:3000`.

---

## 🧪 Running Automated Test Suite

Run the full Sentinel AI automated test suite across all milestones:

```bash
PYTHONPATH=backend:backend/venv/lib/python3.14/site-packages /home/jagansyam/.local/bin/pytest backend/sentinel/
```

### Test Coverage (`backend/sentinel/`):
- `test_load_model.py`: Model architecture reconstruction & `.pth` checkpoint loading
- `test_inference.py`: Standalone image inference & probability output
- `test_localization.py`: Spatial mask thresholding & heatmap overlay generation
- `test_api_service.py`: Direct FastAPI backend service integration
- `test_database_persistence.py`: `AIAnalysis` and `ForensicScan` DB persistence
- `test_multiple_evidence.py`: Batch multi-evidence investigation processing
- `test_frontend_integration.py`: Frontend API contract alignment
- `test_pdf_engine.py`: PDF report generation with executive summary & heatmaps
- `test_error_handling.py`: Missing checkpoint, corrupted file, and PDF isolation
- `test_performance.py`: Sub-second timing benchmarks
- `test_e2e_full_flow.py`: Complete end-to-end investigation lifecycle

---

## 🛰️ Key API Endpoints

### 1. Execute Sentinel AI Scan
- **`POST /api/v1/user/cases/{case_id}/scan`**
- **`POST /api/v1/user/cases/{case_id}/analyze`**
- **Description**: Runs dual-head inference across all uploaded evidence files, generates localization artifacts, persists records to database, and builds PDF report.

### 2. Get Scan Summary
- **`GET /api/v1/user/cases/{case_id}/scan`**
- **Description**: Fetches latest saved AI analysis results, metrics, and artifact URLs for an investigation.

### 3. Download Forensic PDF Report
- **`GET /api/v1/user/cases/{case_id}/report/pdf`**
- **Description**: Generates (if needed) and streams official A4 forensic investigation PDF report.

### 4. Fetch Localization Artifact Images
- **`GET /api/v1/user/analysis/artifacts/{filename}`**
- **Description**: Serves generated heatmap overlays and binary anomaly mask images.

---

## 📄 License & Disclaimer

Official Sentinel AI forensic analysis platform for authorized forensic and law enforcement use. Automated AI results provide corroborative evidence and should be reviewed by qualified forensic experts.