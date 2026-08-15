import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base


class StatusEnum(enum.Enum):
    DRAFT = "DRAFT"
    CASE_FILED = "CASE_FILED"
    CASE_UNDER_INVESTIGATION = "CASE_UNDER_INVESTIGATION"
    CLOSED = "CLOSED"

    # Legacy/compatibility values
    CASE_OPENED = "CASE_OPENED"
    UNDER_ANALYSIS = "UNDER_ANALYSIS"
    EXPERT_REVIEW = "EXPERT_REVIEW"
    OPEN = "OPEN"
    REVIEW = "REVIEW"

class FileTypeEnum(enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    DOCUMENT = "DOCUMENT"

class MediaTypeEnum(enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"

class AIResultEnum(enum.Enum):
    REAL = "REAL"
    DEEPFAKE = "DEEPFAKE"
    SUSPICIOUS = "SUSPICIOUS"

class DecisionEnum(enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"

class ReportTypeEnum(enum.Enum):
    AI = "AI"
    FORENSIC = "FORENSIC"
    FINAL = "FINAL"

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)

    users = relationship("User", back_populates="role")
    account_roles = relationship("AccountRole", back_populates="role", cascade="all, delete-orphan")


class InvestigationCase(Base):
    __tablename__ = "investigation_cases"
    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_expert = Column(Integer, ForeignKey("users.id"))
    status = Column(Enum(StatusEnum), default=StatusEnum.DRAFT)
    incident_date = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by], back_populates="investigation_cases")
    expert = relationship("User", foreign_keys=[assigned_expert], back_populates="assigned_cases")
    evidence_files = relationship("EvidenceFile", back_populates="case", cascade="all, delete-orphan")
    notes = relationship("InvestigationNote", back_populates="case", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="case", cascade="all, delete-orphan")
    messages = relationship("CaseMessage", back_populates="case", cascade="all, delete-orphan")


class EvidenceFile(Base):
    __tablename__ = "evidence_files"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_type = Column(Enum(FileTypeEnum), nullable=False)
    mime_type = Column(String(100))
    file_size = Column(Integer)
    storage_path = Column(String(500), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    upload_time = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("InvestigationCase", back_populates="evidence_files")
    uploader = relationship("User", back_populates="evidence_uploaded")
    metadata_info = relationship("MediaMetadata", back_populates="evidence", uselist=False, cascade="all, delete-orphan")
    analyses = relationship("AIAnalysis", back_populates="evidence", cascade="all, delete-orphan")


class MediaMetadata(Base):
    __tablename__ = "media_metadata"
    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence_files.id"), nullable=False)
    width = Column(Integer)
    height = Column(Integer)
    duration = Column(Float)
    codec = Column(String(50))
    fps = Column(Float)
    sample_rate = Column(Integer)
    device = Column(String(100))
    gps_location = Column(String(100))
    creation_date = Column(DateTime(timezone=True))
    metadata_json = Column(JSON)

    evidence = relationship("EvidenceFile", back_populates="metadata_info")


class AIModel(Base):
    __tablename__ = "ai_models"
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    media_type = Column(Enum(MediaTypeEnum), nullable=False)
    accuracy = Column(Float)
    description = Column(Text)
    status = Column(Boolean, default=True)

    analyses = relationship("AIAnalysis", back_populates="model")


class AIAnalysis(Base):
    __tablename__ = "ai_analysis"
    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence_files.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("ai_models.id"), nullable=False)
    result = Column(Enum(AIResultEnum), nullable=False)
    confidence_score = Column(Float, nullable=False)
    processing_time = Column(Float)
    analyzed_at = Column(DateTime(timezone=True), server_default=func.now())
    report_path = Column(String(500))

    evidence = relationship("EvidenceFile", back_populates="analyses")
    model = relationship("AIModel", back_populates="analyses")
    reviews = relationship("ForensicReview", back_populates="analysis", cascade="all, delete-orphan")


class ForensicReview(Base):
    __tablename__ = "forensic_reviews"
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("ai_analysis.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(Enum(DecisionEnum), nullable=False)
    observations = Column(Text)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis = relationship("AIAnalysis", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")


class InvestigationNote(Base):
    __tablename__ = "investigation_notes"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("InvestigationCase", back_populates="notes")
    user = relationship("User", back_populates="notes")


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=False)
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_type = Column(Enum(ReportTypeEnum), nullable=False)
    report_file = Column(String(500), nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("InvestigationCase", back_populates="reports")
    generator = relationship("User", back_populates="reports_generated")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    description = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("InvestigationCase", back_populates="audit_logs")
    user = relationship("User")


class CaseMessage(Base):
    __tablename__ = "case_messages"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    case = relationship("InvestigationCase", back_populates="messages")
    sender = relationship("User")


class ForensicScan(Base):
    __tablename__ = "forensic_scans"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=False)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    scan_status = Column(String(50), default="COMPLETED")
    scan_duration = Column(Float, default=10.2)
    evidence_count = Column(Integer, default=0)
    results_json = Column(Text, nullable=False)
    pdf_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("InvestigationCase")
    scanner = relationship("User")


class InvestigatorNote(Base):
    __tablename__ = "investigator_notes"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id", ondelete="CASCADE"), nullable=False)
    investigator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    content_json = Column(JSON, nullable=True)
    related_evidence_ids = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    case = relationship("InvestigationCase")
    investigator = relationship("User", foreign_keys=[investigator_id])



