import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base

class UserStatus(enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone = Column(String(20))
    organization = Column(String(100))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    status = Column(String(50), default="PENDING", nullable=False)
    government_id = Column(String(100), nullable=True)
    profile_picture = Column(String(255))
    date_of_birth = Column(String(50), nullable=True)
    gender = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    digital_id_path = Column(String(255), nullable=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    role = relationship("Role", back_populates="users")
    investigator_profile = relationship("InvestigatorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    investigation_cases = relationship("InvestigationCase", foreign_keys="[InvestigationCase.created_by]", back_populates="creator")
    assigned_cases = relationship("InvestigationCase", foreign_keys="[InvestigationCase.assigned_expert]", back_populates="expert")
    evidence_uploaded = relationship("EvidenceFile", back_populates="uploader")
    reviews = relationship("ForensicReview", back_populates="reviewer")
    notes = relationship("InvestigationNote", back_populates="user")
    reports_generated = relationship("Report", back_populates="generator")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class InvestigatorProfile(Base):
    __tablename__ = "investigator_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    employee_id = Column(String(100), nullable=True)
    government_id_path = Column(String(255), nullable=True)
    rejection_reason = Column(String(500), nullable=True)
    applied_date = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="investigator_profile")

