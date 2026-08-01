from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.auth import get_password_hash

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = User(
        full_name=user.full_name,
        email=user.email,
        password=hashed_password,
        phone=user.phone,
        organization=user.organization,
        status="PENDING"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
