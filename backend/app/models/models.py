import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base

class PriorityEnum(enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class StatusEnum(enum.Enum):
    OPEN = "OPEN"
    UNDER_ANALYSIS = "UNDER_ANALYSIS"
    REVIEW = "REVIEW"
    CLOSED = "CLOSED"

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


class InvestigationCase(Base):
    __tablename__ = "investigation_cases"
    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_expert = Column(Integer, ForeignKey("users.id"))
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.MEDIUM)
    status = Column(Enum(StatusEnum), default=StatusEnum.OPEN)
    incident_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by], back_populates="investigation_cases")
    expert = relationship("User", foreign_keys=[assigned_expert], back_populates="assigned_cases")
    evidence_files = relationship("EvidenceFile", back_populates="case")
    notes = relationship("InvestigationNote", back_populates="case")
    reports = relationship("Report", back_populates="case")


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
    metadata_info = relationship("MediaMetadata", back_populates="evidence", uselist=False)
    analyses = relationship("AIAnalysis", back_populates="evidence")


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
    reviews = relationship("ForensicReview", back_populates="analysis")


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
