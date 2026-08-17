import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.database import Base
import app.models.models

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
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    role = relationship("Role", back_populates="users")
    investigator_profile = relationship("InvestigatorProfile", foreign_keys="InvestigatorProfile.user_id", back_populates="user", uselist=False, cascade="all, delete-orphan")
    investigation_cases = relationship("InvestigationCase", foreign_keys="InvestigationCase.created_by", back_populates="creator")
    assigned_cases = relationship("InvestigationCase", foreign_keys="InvestigationCase.assigned_expert", back_populates="expert")
    evidence_uploaded = relationship("EvidenceFile", back_populates="uploader")
    reviews = relationship("ForensicReview", back_populates="reviewer")
    notes = relationship("InvestigationNote", back_populates="user")
    reports_generated = relationship("Report", back_populates="generator")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    # New Enterprise Architecture Relationships
    account_roles = relationship("AccountRole", foreign_keys="AccountRole.account_id", back_populates="account", cascade="all, delete-orphan")
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
    applied_date = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id], back_populates="investigator_profile")

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
    status = Column(String(50), default="Pending", nullable=False) # Pending, Delivered, Failed, Expired, Accepted, Cancelled
    invitation_type = Column(String(50), default="New Investigator", nullable=False)
    delivery_status = Column(String(50), default="Pending", nullable=False)
    send_attempts = Column(Integer, default=0, nullable=False)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # For existing user upgrade
    account_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    account = relationship("User", foreign_keys=[account_id])
    logs = relationship("InvitationLog", back_populates="invitation", cascade="all, delete-orphan")

class InvitationLog(Base):
    __tablename__ = "invitation_logs"

    id = Column(Integer, primary_key=True, index=True)
    invitation_id = Column(Integer, ForeignKey("investigator_invitations.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    recipient_email = Column(String(100), nullable=False)
    message = Column(String(500), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invitation = relationship("InvestigatorInvitation", back_populates="logs")
    performer = relationship("User", foreign_keys=[performed_by])

class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    otp_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    otp_hash = Column(String(255), nullable=False)
    reset_token = Column(String(255), unique=True, index=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

