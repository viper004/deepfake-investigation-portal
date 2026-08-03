import sys
import os

# Ensure app is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.user import User, AccountRole, UserProfile
import app.models.models

def migrate_data():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            # 1. Migrate Role to AccountRole
            if user.role_id:
                # Check if it already exists
                existing_role = db.query(AccountRole).filter(
                    AccountRole.account_id == user.id,
                    AccountRole.role_id == user.role_id
                ).first()
                if not existing_role:
                    new_account_role = AccountRole(
                        account_id=user.id,
                        role_id=user.role_id
                    )
                    db.add(new_account_role)
            
            # 2. Migrate Profile Data to UserProfile
            existing_profile = db.query(UserProfile).filter(UserProfile.account_id == user.id).first()
            if not existing_profile:
                new_profile = UserProfile(
                    account_id=user.id,
                    full_name=user.full_name,
                    phone=user.phone,
                    profile_photo=user.profile_picture,
                    address=user.address,
                    dob=user.date_of_birth,
                    gender=user.gender
                )
                db.add(new_profile)
        
        db.commit()
        print("Data migration completed successfully.")
    except Exception as e:
        print("Error during data migration:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_data()
