from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database.database import SessionLocal
from app.schemas.user import UserCreate, UserResponse, UserLogin
from app.services.user import get_user_by_email, create_user
from app.utils.auth import verify_password, create_access_token
from app.models.user import User, UserStatus

router = APIRouter(prefix="/auth", tags=["auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
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
        
    if user.status == UserStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending approval"
        )
        
    if user.status == UserStatus.DISABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled"
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
            "status": user.status.value,
            "profile_picture": user.profile_picture
        }
    }

@router.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    pending_approvals = db.query(User).filter(User.status == UserStatus.PENDING).count()
    return {
        "total_users": total_users,
        "pending_approvals": pending_approvals,
    }
