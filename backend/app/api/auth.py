from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional
import os
import shutil
import uuid

from app.database.database import SessionLocal
from app.schemas.user import UserCreate, UserResponse, UserLogin
from app.services.user import get_user_by_email, create_user
from app.utils.auth import verify_password, create_access_token, get_password_hash
from app.models.user import User, InvestigatorProfile

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register/user", status_code=status.HTTP_201_CREATED)
def register_user(
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    phone: Optional[str] = Form(None),
    profile_picture_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
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
        email=email,
        password=hashed_password,
        phone=phone,
        role_id=3,  # USER
        status="ACTIVE",
        profile_picture=profile_pic_url
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {
        "message": "Registration completed successfully. Please log in to continue.",
        "user_id": db_user.id
    }

@router.post("/register/investigator", status_code=status.HTTP_201_CREATED)
def register_investigator(
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    phone: Optional[str] = Form(None),
    organization: str = Form(...),
    department: str = Form(...),
    designation: str = Form(...),
    employee_id: str = Form(...),
    government_id_file: UploadFile = File(...),
    profile_picture_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    if get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(password)
    
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
    
    # Create User with Status PENDING and role_id 2 (INVESTIGATOR)
    db_user = User(
        full_name=full_name,
        email=email,
        password=hashed_password,
        phone=phone,
        role_id=2,  # INVESTIGATOR
        status="PENDING",
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
    db.commit()
    
    return {
        "message": "Your investigator application has been submitted successfully and is awaiting administrator approval.",
        "user_id": db_user.id
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
            data={"sub": "admin", "email": "superuser@example.com", "role": 1}
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
    
    # Create JWT
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role_id}
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
