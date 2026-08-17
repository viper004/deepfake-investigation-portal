from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import shutil
import uuid
import secrets
import hashlib
import re
from pydantic import BaseModel

from app.database.database import SessionLocal
from app.schemas.user import UserCreate, UserResponse, UserLogin
from app.services.user import get_user_by_email, create_user
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.models.user import User, InvestigatorProfile, InvestigatorInvitation, EmailVerification, PasswordResetOTP
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# OTP Helpers & Schemas
def hash_otp(otp: str) -> str:
    salt = "SENTINEL_AI_OTP_SALT_2026"
    return hashlib.sha256((otp + salt).encode()).hexdigest()

def cleanup_expired_otps(db: Session):
    try:
        now = datetime.now(timezone.utc)
        db.query(EmailVerification).filter(EmailVerification.expires_at < now).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

class OTPRequestSchema(BaseModel):
    email: str

class VerifyOTPRequestSchema(BaseModel):
    email: str
    otp: str

@router.post("/send-email-otp")
async def send_email_otp(data: OTPRequestSchema, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    
    # 1. Validate email format
    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email address format."
        )
    
    # 2. Check whether the email is already registered
    existing_user = get_user_by_email(db, email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # 3. Cleanup expired OTPs
    cleanup_expired_otps(db)

    # 4. Check rate limit: Maximum 3 OTP requests per hour for the same email
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_requests = db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.created_at >= one_hour_ago
    ).count()

    if recent_requests >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum 3 OTP requests allowed per hour. Please try again later."
        )

    # Invalidate previous unverified OTPs for this email
    db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.verified == False
    ).delete(synchronize_session=False)
    db.commit()

    # 5. Generate cryptographically secure random 6-digit OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    otp_hashed = hash_otp(otp_code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    # 6. Store in database
    verification_entry = EmailVerification(
        email=email,
        otp_hash=otp_hashed,
        expires_at=expires_at,
        attempt_count=0,
        verified=False
    )
    db.add(verification_entry)
    db.commit()

    # 7. Send OTP email
    await send_otp_email(email, otp_code)

    return {"message": "Verification code sent to your email."}

@router.post("/verify-email-otp")
def verify_email_otp(data: VerifyOTPRequestSchema, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    otp_code = data.otp.strip()

    if not otp_code or len(otp_code) != 6 or not otp_code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP must be a 6-digit number."
        )

    cleanup_expired_otps(db)

    record = db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.verified == False
    ).order_by(EmailVerification.id.desc()).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired or is invalid."
        )

    now = datetime.now(timezone.utc)
    record_expires = record.expires_at.replace(tzinfo=timezone.utc) if record.expires_at.tzinfo is None else record.expires_at
    if record_expires < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired or is invalid."
        )

    if record.attempt_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new verification code."
        )

    # Increment attempt count
    record.attempt_count += 1
    db.commit()

    # Check OTP hash
    if hash_otp(otp_code) == record.otp_hash:
        record.verified = True
        record.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"message": "Email verified successfully."}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )

@router.post("/resend-email-otp")
async def resend_email_otp(data: OTPRequestSchema, db: Session = Depends(get_db)):
    return await send_email_otp(data, db)

# ──────────────── FORGOT PASSWORD ENDPOINTS ────────────────

class ForgotPasswordRequestSchema(BaseModel):
    email: str

class VerifyResetOTPRequestSchema(BaseModel):
    email: str
    otp: str

class ResetPasswordSchema(BaseModel):
    email: str
    reset_token: str
    new_password: str
    confirm_password: str

@router.post("/forgot-password/request")
async def forgot_password_request(data: ForgotPasswordRequestSchema, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    
    # 1. Validate email format
    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email address format."
        )
    
    # 2. Check whether account exists in system
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registered account found with this email address."
        )
    
    # 3. Cleanup expired OTPs
    cleanup_expired_otps(db)

    # 4. Check rate limit: Maximum 3 OTP requests per hour for the same email
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_requests = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.created_at >= one_hour_ago
    ).count()

    if recent_requests >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum 3 password reset attempts allowed per hour. Please try again later."
        )

    # Invalidate previous unused reset records for this email
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.used == False
    ).update({"used": True}, synchronize_session=False)
    db.commit()

    # 5. Generate cryptographically secure random 6-digit OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    otp_hashed = hash_otp(otp_code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # 6. Store in database
    reset_record = PasswordResetOTP(
        email=email,
        otp_hash=otp_hashed,
        expires_at=expires_at,
        attempt_count=0,
        verified=False,
        used=False
    )
    db.add(reset_record)
    db.commit()

    # 7. Send OTP email
    await send_otp_email(email, otp_code)

    return {"message": "If an account exists with this email address, a verification code has been sent."}

@router.post("/forgot-password/verify-otp")
def forgot_password_verify_otp(data: VerifyResetOTPRequestSchema, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    otp_code = data.otp.strip()

    if not otp_code or len(otp_code) != 6 or not otp_code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP must be a 6-digit number."
        )

    cleanup_expired_otps(db)

    record = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.verified == False,
        PasswordResetOTP.used == False
    ).order_by(PasswordResetOTP.id.desc()).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired or is invalid."
        )

    now = datetime.now(timezone.utc)
    record_expires = record.expires_at.replace(tzinfo=timezone.utc) if record.expires_at.tzinfo is None else record.expires_at
    if record_expires < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    if record.attempt_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new verification code."
        )

    # Increment attempt count
    record.attempt_count += 1
    db.commit()

    # Verify OTP hash
    if hash_otp(otp_code) == record.otp_hash:
        reset_token = secrets.token_urlsafe(32)
        record.verified = True
        record.reset_token = reset_token
        record.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {
            "message": "OTP verified successfully.",
            "reset_token": reset_token
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check and try again."
        )

@router.post("/forgot-password/resend-otp")
async def forgot_password_resend_otp(data: ForgotPasswordRequestSchema, db: Session = Depends(get_db)):
    return await forgot_password_request(data, db)

@router.post("/forgot-password/reset-password")
def forgot_password_reset(data: ResetPasswordSchema, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    reset_token = data.reset_token.strip()

    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )

    new_pass = data.new_password
    if (
        len(new_pass) < 8 or
        not re.search(r"[A-Z]", new_pass) or
        not re.search(r"[a-z]", new_pass) or
        not re.search(r"[0-9]", new_pass)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number."
        )

    # Validate reset session record
    record = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email,
        PasswordResetOTP.reset_token == reset_token,
        PasswordResetOTP.verified == True,
        PasswordResetOTP.used == False
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset session. Please request a new OTP."
        )

    now = datetime.now(timezone.utc)
    record_expires = record.expires_at.replace(tzinfo=timezone.utc) if record.expires_at.tzinfo is None else record.expires_at
    if (now - record_expires) > timedelta(minutes=15):
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset session expired. Please restart the process."
        )

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    # Update password using existing bcrypt/argon2/pbkdf2 password hashing
    user.password = get_password_hash(new_pass)
    user.updated_at = datetime.now(timezone.utc)

    # Invalidate reset record
    record.used = True

    # Invalidate all reset records for this email
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email
    ).update({"used": True}, synchronize_session=False)

    db.commit()

    return {"message": "Your password has been updated successfully."}

@router.post("/register/user", status_code=status.HTTP_201_CREATED)
def register_user(
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    phone: Optional[str] = Form(None),
    profile_picture_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    email_clean = email.strip().lower()
    if get_user_by_email(db, email_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # Check if email is verified
    verification_record = db.query(EmailVerification).filter(
        EmailVerification.email == email_clean,
        EmailVerification.verified == True
    ).first()

    if not verification_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email address before completing registration."
        )
    
    hashed_password = get_password_hash(password)
    
    profile_pic_url = None
    if profile_picture_file and profile_picture_file.filename:
        os.makedirs("uploads/profiles", exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}_{profile_picture_file.filename}"
        filepath = os.path.join("uploads/profiles", unique_name)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(profile_picture_file.file, buffer)
        profile_pic_url = f"http://127.0.0.1:8000/api/v1/auth/document/profiles/{unique_name}"
    
    db_user = User(
        full_name=full_name,
        email=email_clean,
        password=hashed_password,
        phone=phone,
        role_id=3,  # USER
        status="ACTIVE",
        profile_picture=profile_pic_url,
        email_verified=True,
        email_verified_at=datetime.now(timezone.utc)
    )
    db.add(db_user)
    
    # Delete OTP records for this email after successful registration
    db.query(EmailVerification).filter(EmailVerification.email == email_clean).delete(synchronize_session=False)
    db.commit()
    db.refresh(db_user)
    
    return {
        "message": "Registration completed successfully. Please log in to continue.",
        "user_id": db_user.id
    }

@router.post("/register/investigator", status_code=status.HTTP_201_CREATED)
def register_investigator(
    invitation_token: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(""),
    phone: Optional[str] = Form(None),
    organization: str = Form(...),
    department: str = Form(...),
    designation: str = Form(...),
    employee_id: str = Form(...),
    government_id_file: UploadFile = File(...),
    profile_picture_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    invitation = db.query(InvestigatorInvitation).filter(
        InvestigatorInvitation.token == invitation_token,
        InvestigatorInvitation.status == "PENDING"
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token"
        )
    
    if invitation.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        invitation.status = "EXPIRED"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation token has expired"
        )
        
    if invitation.email.lower() != email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email does not match the invitation"
        )

    existing_user = get_user_by_email(db, email)
    
    if existing_user and not invitation.account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered, but this is a new invitation"
        )
    
    # Save Government ID
    os.makedirs("uploads/gov_ids", exist_ok=True)
    gov_id_unique_name = f"{uuid.uuid4().hex}_{government_id_file.filename}"
    gov_id_path = os.path.join("uploads/gov_ids", gov_id_unique_name)
    with open(gov_id_path, "wb") as buffer:
        shutil.copyfileobj(government_id_file.file, buffer)
    gov_id_url = f"http://127.0.0.1:8000/api/v1/auth/document/gov_ids/{gov_id_unique_name}"
    
    # Save Profile Picture
    profile_pic_url = None
    if profile_picture_file and profile_picture_file.filename:
        os.makedirs("uploads/profiles", exist_ok=True)
        prof_unique_name = f"{uuid.uuid4().hex}_{profile_picture_file.filename}"
        prof_path = os.path.join("uploads/profiles", prof_unique_name)
        with open(prof_path, "wb") as buffer:
            shutil.copyfileobj(profile_picture_file.file, buffer)
        profile_pic_url = f"http://127.0.0.1:8000/api/v1/auth/document/profiles/{prof_unique_name}"
    
    if existing_user:
        db_user = existing_user
        db_user.role_id = 2
        db_user.status = "ACTIVE"
    else:
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required for new accounts"
            )
        hashed_password = get_password_hash(password)
        db_user = User(
            full_name=full_name,
            email=email,
            password=hashed_password,
            phone=phone,
            role_id=2,  # INVESTIGATOR
            status="ACTIVE",
            profile_picture=profile_pic_url
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    
    # Create InvestigatorProfile
    db_profile = InvestigatorProfile(
        user_id=db_user.id,
        organization=organization,
        department=department,
        designation=designation,
        employee_id=employee_id,
        government_id_path=gov_id_url
    )
    db.add(db_profile)
    
    # Mark invitation as accepted
    invitation.status = "ACCEPTED"
    invitation.accepted_at = datetime.now(timezone.utc)

    # Log the completion
    from app.models.user import InvitationLog
    log = InvitationLog(
        invitation_id=invitation.id,
        event_type="Investigator Role Assigned",
        status="SUCCESS",
        recipient_email=invitation.email,
        message="Investigator registration completed and role activated.",
        ip_address=None
    )
    db.add(log)

    db.commit()
    
    return {
        "message": "Registration successful. You can now log in as an Investigator.",
        "user_id": db_user.id
    }

@router.get("/verify-invitation")
def verify_invitation(token: str, db: Session = Depends(get_db)):
    invitation = db.query(InvestigatorInvitation).filter(
        InvestigatorInvitation.token == token,
        InvestigatorInvitation.status == "PENDING"
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token")
        
    if invitation.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        invitation.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=400, detail="Invitation token has expired")
        
    return {
        "email": invitation.email,
        "full_name": invitation.full_name,
        "is_upgrade": invitation.account_id is not None
    }

@router.get("/document/profiles/{filename}")
def get_profile_picture(filename: str):
    filepath = os.path.join("uploads/profiles", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

@router.get("/document/gov_ids/{filename}")
def get_government_id(filename: str):
    filepath = os.path.join("uploads/gov_ids", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Fallback endpoint for generic Pydantic JSON registration
    if get_user_by_email(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    return create_user(db, user)

@router.post("/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    # Hardcoded admin login
    if credentials.email == "superuser@example.com" and credentials.password == "password":
        access_token = create_access_token(
            data={"sub": "admin", "email": "superuser@example.com", "role": 1, "roles": [1]}
        )
        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": 0,
                "full_name": "System Admin",
                "email": "superuser@example.com",
                "role_id": 1,
                "roles": [1],
                "status": "ACTIVE",
                "profile_picture": None
            }
        }

    user = get_user_by_email(db, credentials.email)
    
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    if user.role_id == 2:  # INVESTIGATOR
        if user.status == "PENDING":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your investigator application is awaiting administrator approval."
            )
        elif user.status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your investigator application has been rejected. Please contact the administrator for more information."
            )
            
    if user.status == "PENDING":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending approval"
        )
        
    if user.status in ["DISABLED", "BLOCKED", "INACTIVE"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled, inactive, or blocked"
        )
        
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    
    # Fetch roles from AccountRole mapping
    roles = [ar.role_id for ar in user.account_roles]
    if not roles and user.role_id:
        roles = [user.role_id]
    
    # Create JWT
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role_id, "roles": roles}
    )
    
    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role_id": user.role_id,
            "roles": roles,
            "status": user.status,
            "profile_picture": user.profile_picture
        }
    }

@router.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    pending_approvals = db.query(User).filter(User.status == "PENDING").count()
    active_users_count = db.query(User).filter(User.status.in_(["APPROVED", "ACTIVE"])).count()
    return {
        "total_users": total_users,
        "pending_approvals": pending_approvals,
        "active_users_count": active_users_count,
    }
