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
    investigator_profile = relationship("InvestigatorProfile", foreign_keys="[InvestigatorProfile.user_id]", back_populates="user", uselist=False, cascade="all, delete-orphan")
    investigation_cases = relationship("InvestigationCase", foreign_keys="[InvestigationCase.created_by]", back_populates="creator")
    assigned_cases = relationship("InvestigationCase", foreign_keys="[InvestigationCase.assigned_expert]", back_populates="expert")
    evidence_uploaded = relationship("EvidenceFile", back_populates="uploader")
    reviews = relationship("ForensicReview", back_populates="reviewer")
    notes = relationship("InvestigationNote", back_populates="user")
    reports_generated = relationship("Report", back_populates="generator")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    # New Enterprise Architecture Relationships
    account_roles = relationship("AccountRole", foreign_keys="[AccountRole.account_id]", back_populates="account", cascade="all, delete-orphan")
    user_profile = relationship("UserProfile", back_populates="account", uselist=False, cascade="all, delete-orphan")


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

    verification_status = Column(String(50), default="PENDING", nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="investigator_profile")
    approver = relationship("User", foreign_keys=[approved_by])

class AccountRole(Base):
    __tablename__ = "account_roles"

    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("User", foreign_keys=[account_id], back_populates="account_roles")
    role = relationship("Role", back_populates="account_roles")
    assigner = relationship("User", foreign_keys=[assigned_by])

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    profile_photo = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    dob = Column(String(50), nullable=True)
    gender = Column(String(20), nullable=True)

    account = relationship("User", back_populates="user_profile")

class InvestigatorInvitation(Base):
    __tablename__ = "investigator_invitations"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(100), index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    status = Column(String(50), default="PENDING", nullable=False) # PENDING, COMPLETED, CANCELLED
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # For existing user upgrade
    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    account = relationship("User", foreign_keys=[account_id])

