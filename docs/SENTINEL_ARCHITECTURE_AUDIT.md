# Sentinel AI — Project Architecture & Pipeline Audit

**Audit Date:** 2026-09-24  
**Project:** Deepfake Investigation Portal  
**Milestone:** Milestone 0 — Project Audit  

---

## 1. System Overview & Architecture Flow

### Current Workflow

```text
User / Investigator
        │
        ▼
Frontend (Next.js 16 + React 19 + Tailwind CSS)
        │
        ▼
Backend API (FastAPI + SQLAlchemy)
        │
        ▼
Evidence Storage (`backend/uploads/`) & MySQL Database
        │
        ▼
Mock AI Logic (`MockForensicScanner` / `random.choices`)
        │
        ▼
Mock Report Generator (`reportlab` with simulated metrics)
```

---

## 2. Component Breakdown

### 2.1 Frontend Framework
- **Framework:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript 5.
- **Styling:** Tailwind CSS v4, PostCSS, Lucide React icons.
- **Auth:** NextAuth v5 (`auth.ts`, `middleware.ts`).
- **Key UI Views:**
  - `frontend/app/page.tsx`: Landing page.
  - `frontend/app/dashboard/page.tsx`: User / Investigator Case Management & AI scanning dashboard.
  - `frontend/app/dashboard/cases/[caseId]/page.tsx`: Detailed investigation case review with scan metrics and report triggers.
  - `frontend/app/admin/page.tsx`: Administrative overview, user/role management, and audit log inspection.

### 2.2 Backend Framework
- **Framework:** FastAPI (Python 3) running on Uvicorn.
- **ORM & Migrations:** SQLAlchemy, Alembic.
- **Entrypoint:** `backend/app/main.py`.
- **Routers:**
  - `backend/app/api/auth.py`: Authentication, user registration, JWT token issuing, verification.
  - `backend/app/api/user.py`: Case creation, evidence upload, AI analysis endpoints, scanning, report generation.
  - `backend/app/api/admin.py`: Administration, role management, audit log retrieval.

### 2.3 Database
- **Engine:** MySQL (InnoDB) with `pymysql` driver.
- **Models (`backend/app/models/models.py` & `backend/app/models/user.py`):**
  - `User`, `Role`, `AccountRole`, `InvestigatorProfile`
  - `InvestigationCase`: Stores case number, title, description, status, dates, creator, assigned expert.
  - `EvidenceFile`: Stores case association, uploader, file name, original name, MIME type, size, storage path, SHA-256 hash, upload timestamp.
  - `MediaMetadata`: Dimensions, duration, codec, FPS, device, GPS location, JSON metadata.
  - `AIModel`: Registered models (name, version, media type, accuracy, description, status).
  - `AIAnalysis`: Evidence analysis record (`evidence_id`, `model_id`, `result` [REAL/DEEPFAKE/SUSPICIOUS], `confidence_score`, `processing_time`, `report_path`).
  - `ForensicScan`: Case scan results record (`case_id`, `scanned_by`, `scan_status`, `scan_duration`, `evidence_count`, `results_json`, `pdf_path`).
  - `ForensicReview`: Human investigator verification overrides and notes.
  - `Report`: PDF report metadata (`case_id`, `generated_by`, `report_type`, `report_file`, `generated_at`).
  - `AuditLog`: Forensic event audit trail.
  - `CaseMessage` & `InvestigatorNote`: Collaborative case notes and communications.

### 2.4 Evidence Upload Endpoint & Flow
- **Endpoints:**
  - `POST /api/v1/user/cases/{case_id}/evidence` (and legacy `POST /api/user/cases/{case_id}/evidence`): Uploads evidence attached to a specific case.
  - `POST /api/v1/user/evidence`: Uploads standalone evidence.
- **Handling:** Validates file type, computes SHA-256 hash, saves file to local filesystem, creates `EvidenceFile` and optional `MediaMetadata` records.

### 2.5 Evidence Storage Location
- **Location:** `backend/uploads/` (with reports saved to `backend/uploads/reports/`).

### 2.6 Investigation Model / Schema
- Model: `InvestigationCase`
- Fields:
  - `id`: Integer Primary Key
  - `case_number`: Unique case identifier (e.g. `CASE-2026-0048`)
  - `title`: String(200)
  - `description`: Text
  - `created_by`: Foreign Key to `users.id`
  - `assigned_expert`: Foreign Key to `users.id`
  - `status`: Enum (`DRAFT`, `CASE_FILED`, `CASE_UNDER_INVESTIGATION`, `CLOSED`)
  - `incident_date`, `submitted_at`, `opened_at`, `created_at`, `updated_at`

### 2.7 Existing Analysis API
1. **Case Multi-Evidence Scan:**
   - `POST /api/v1/user/cases/{case_id}/scan`
   - Scans all evidence attached to `case_id`, invokes `MockForensicScanner.analyze_case_evidence`, compiles `ForensicScan` results JSON, generates PDF report, records audit logs.
   - `GET /api/v1/user/cases/{case_id}/scan`: Retrieves latest scan record and results.
2. **Single Evidence AI Scan:**
   - `POST /api/v1/user/evidence/{evidence_id}/analyze`
   - Accepts `model_id`, simulates AI analysis (`random.choices` across `[REAL, DEEPFAKE, SUSPICIOUS]`), persists `AIAnalysis` entry.
3. **Analysis Listing:**
   - `GET /api/v1/user/analysis`: Retrieves list of user's analyzed evidence.

### 2.8 Existing Report Generation & PDF Library
- **Library:** Python `reportlab` (ReportLab Platypus: `SimpleDocTemplate`, `Paragraph`, `Table`, `NumberedCanvas`, `Image`).
- **File:** `backend/app/services/forensic_report.py` (`generate_forensic_pdf_report`).
- **Report Download Endpoint:** `GET /api/v1/user/cases/{case_id}/report/pdf`.

### 2.9 Identification of All Mock AI Logic
| Location | Type | Description |
|---|---|---|
| `backend/app/services/forensic_report.py` | `MockForensicScanner.analyze_case_evidence` | Deterministic hash/ID-seeded pseudo-random math calculating fake manipulation probabilities (68-95% vs 5-24%), confidence (84-97%), and hardcoded artifact summary strings. |
| `backend/app/api/user.py` (line ~1296) | `analyze_evidence` | Uses `random.choices` (`[REAL, DEEPFAKE, SUSPICIOUS]` with weights `[0.4, 0.4, 0.2]`), `random.uniform(0.85, 0.99)` for confidence score, `random.uniform(1.2, 2.9)` for processing time, and 50% simulated `ForensicReview` generation. |
| `backend/app/api/admin.py` (line ~861) | Admin AI overview | Returns hardcoded `"avg_confidence": "94.2%"`. |
| `frontend/app/dashboard/cases/[caseId]/page.tsx` & `dashboard/page.tsx` | Simulated Ticker & Fallbacks | Simulated scan progression timers and mock fallback metrics for manipulation confidence. |

### 2.10 Existing Environment & Dependency Files
- Backend:
  - `backend/requirements.txt`: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `pymysql`, `passlib[bcrypt]`, `python-jose[cryptography]`, `pydantic`, `pydantic-settings`, `reportlab`.
  - `backend/.env`: Database credentials and JWT security parameters.
  - Model File: `backend/sentinel_ai_v17a_frozen_dual_head.pth` (32,223,115 bytes).
- Frontend:
  - `frontend/package.json`: Next.js 16, React 19, Lucide, TipTap.
  - `frontend/.env.local`: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`.

---

## 3. Findings & Transition Path for Sentinel AI V1.7-A

1. **Backend Integration:** The existing backend is already native Python (FastAPI), meaning the Sentinel AI PyTorch model (`sentinel_ai_v17a_frozen_dual_head.pth`) can be loaded and executed directly in Python without requiring a separate microservice.
2. **Database Schema Compatibility:** The `AIAnalysis`, `AIModel`, `EvidenceFile`, and `ForensicScan` database models already provide structured fields for confidence scores, results, model references, processing durations, and storage paths. Minimal non-breaking enhancements can capture localization artifact paths and granular probabilities.
3. **Report Generation:** `backend/app/services/forensic_report.py` already utilizes `reportlab`. We will replace `MockForensicScanner` with the real Sentinel AI V1.7-A dual-head pipeline (classification + spatial localization heatmaps) and feed authentic model outputs into the PDF engine.
