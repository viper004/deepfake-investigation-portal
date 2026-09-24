import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
import app.models.models  # Import all models to register with SQLAlchemy
from sqlalchemy import text
from app.database.database import SessionLocal

# Database updates on startup
def init_db_updates():
    db = SessionLocal()
    try:
        # Check if government_id column exists
        res = db.execute(text("SHOW COLUMNS FROM users LIKE 'government_id'")).fetchone()
        if not res:
            db.execute(text("ALTER TABLE users ADD COLUMN government_id VARCHAR(100) NULL"))
        
        # Modify status column to VARCHAR(50)
        db.execute(text("ALTER TABLE users MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'"))
        
        # Create notifications table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                `read` TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """))

        # Create investigator_profiles table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS investigator_profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                organization VARCHAR(100) NULL,
                department VARCHAR(100) NULL,
                designation VARCHAR(100) NULL,
                employee_id VARCHAR(100) NULL,
                government_id_path VARCHAR(255) NULL,
                rejection_reason VARCHAR(500) NULL,
                applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """))
        # Check if email_verified column exists
        res_ev = db.execute(text("SHOW COLUMNS FROM users LIKE 'email_verified'")).fetchone()
        if not res_ev:
            db.execute(text("ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0 NOT NULL"))
            db.execute(text("ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL"))

        # Create email_verifications table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS email_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                attempt_count INT DEFAULT 0 NOT NULL,
                verified TINYINT(1) DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email)
            ) ENGINE=InnoDB;
        """))
        # Create password_reset_otps table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS password_reset_otps (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                reset_token VARCHAR(255) NULL,
                expires_at DATETIME NOT NULL,
                attempt_count INT DEFAULT 0 NOT NULL,
                verified TINYINT(1) DEFAULT 0 NOT NULL,
                used TINYINT(1) DEFAULT 0 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_reset_token (reset_token)
            ) ENGINE=InnoDB;
        """))
        # Create investigator_notes table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS investigator_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                investigator_id INT NOT NULL,
                content TEXT NOT NULL,
                content_json JSON NULL,
                related_evidence_ids JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
                FOREIGN KEY (investigator_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """))

        # Check columns on investigation_cases
        res_sub = db.execute(text("SHOW COLUMNS FROM investigation_cases LIKE 'submitted_at'")).fetchone()
        if not res_sub:
            db.execute(text("ALTER TABLE investigation_cases ADD COLUMN submitted_at DATETIME NULL"))
        
        res_op = db.execute(text("SHOW COLUMNS FROM investigation_cases LIKE 'opened_at'")).fetchone()
        if not res_op:
            db.execute(text("ALTER TABLE investigation_cases ADD COLUMN opened_at DATETIME NULL"))

        res_inv = db.execute(text("SHOW COLUMNS FROM investigation_cases LIKE 'assigned_investigator_id'")).fetchone()
        if not res_inv:
            db.execute(text("ALTER TABLE investigation_cases ADD COLUMN assigned_investigator_id INT NULL"))

        # Modify status column on investigation_cases to VARCHAR(50) DEFAULT 'DRAFT'
        try:
            db.execute(text("ALTER TABLE investigation_cases MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'"))
        except Exception as st_e:
            print("Status column modify note:", st_e)

        # Create audit_logs table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id VARCHAR(50) NULL,
                case_id INT NULL,
                user_id INT NULL,
                actor_id VARCHAR(50) NULL,
                actor_role VARCHAR(50) NULL,
                action VARCHAR(100) NOT NULL,
                module VARCHAR(50) NOT NULL DEFAULT 'System',
                target_type VARCHAR(50) NULL,
                target_id VARCHAR(100) NULL,
                severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
                status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
                description TEXT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;
        """))

        # Add missing columns to audit_logs if table already exists
        audit_cols = [
            ("event_id", "VARCHAR(50) NULL"),
            ("actor_id", "VARCHAR(50) NULL"),
            ("actor_role", "VARCHAR(50) NULL"),
            ("module", "VARCHAR(50) NOT NULL DEFAULT 'System'"),
            ("target_type", "VARCHAR(50) NULL"),
            ("target_id", "VARCHAR(100) NULL"),
            ("severity", "VARCHAR(20) NOT NULL DEFAULT 'INFO'"),
            ("status", "VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'")
        ]
        for col_name, col_def in audit_cols:
            res_col = db.execute(text(f"SHOW COLUMNS FROM audit_logs LIKE '{col_name}'")).fetchone()
            if not res_col:
                db.execute(text(f"ALTER TABLE audit_logs ADD COLUMN {col_name} {col_def}"))

        try:
            db.execute(text("ALTER TABLE audit_logs MODIFY COLUMN user_id INT NULL"))
        except Exception:
            pass

        # Create case_messages table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS case_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                sender_id INT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME NULL,
                FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """))

        # Create forensic_scans table if not exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS forensic_scans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                case_id INT NOT NULL,
                scanned_by INT NOT NULL,
                scan_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
                scan_duration FLOAT DEFAULT 10.2,
                evidence_count INT DEFAULT 0,
                results_json LONGTEXT NOT NULL,
                pdf_path VARCHAR(500) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES investigation_cases(id) ON DELETE CASCADE,
                FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """))

        # Add Sentinel forensic columns to ai_analysis if table exists
        ai_analysis_cols = [
            ("tampered_probability", "FLOAT NULL"),
            ("authentic_probability", "FLOAT NULL"),
            ("classification_threshold", "FLOAT NULL DEFAULT 0.40"),
            ("localization_available", "TINYINT(1) NULL DEFAULT 0"),
            ("localization_threshold", "FLOAT NULL DEFAULT 0.35"),
            ("mask_path", "VARCHAR(500) NULL"),
            ("overlay_path", "VARCHAR(500) NULL"),
            ("device", "VARCHAR(50) NULL"),
            ("model_version", "VARCHAR(50) NULL"),
            ("sha256_hash", "VARCHAR(64) NULL"),
            ("details_json", "JSON NULL")
        ]
        for col_name, col_def in ai_analysis_cols:
            try:
                res_col = db.execute(text(f"SHOW COLUMNS FROM ai_analysis LIKE '{col_name}'")).fetchone()
                if not res_col:
                    db.execute(text(f"ALTER TABLE ai_analysis ADD COLUMN {col_name} {col_def}"))
            except Exception as col_err:
                print(f"ai_analysis col check note ({col_name}):", col_err)

        db.commit()
    except Exception as e:
        print("Database migration/update error:", e)
        db.rollback()
    finally:
        db.close()

def seed_roles_and_users():
    db = SessionLocal()
    try:
        from app.models.models import Role
        from app.models.user import User
        from app.utils.auth import get_password_hash
        
        # Seed Roles
        roles_to_seed = [
            {"id": 1, "role_name": "ADMIN", "description": "System Administrator"},
            {"id": 2, "role_name": "INVESTIGATOR", "description": "Lead Case Investigator"},
            {"id": 3, "role_name": "USER", "description": "Portal End User"}
        ]
        for r_data in roles_to_seed:
            existing_role = db.query(Role).filter(Role.id == r_data["id"]).first()
            if not existing_role:
                role = Role(id=r_data["id"], role_name=r_data["role_name"], description=r_data["description"])
                db.add(role)
            else:
                existing_role.role_name = r_data["role_name"]
                existing_role.description = r_data["description"]
        db.commit()

        # Seed Users if table is empty or only has the superuser
        total_users = db.query(User).count()
        if total_users <= 1:
            users_to_seed = [
                {
                    "full_name": "Alexander Pierce",
                    "email": "alexander.pierce@sentinel.ai",
                    "password": get_password_hash("password123"),
                    "phone": "+1 (555) 234-5678",
                    "organization": "Department of Homeland Security",
                    "role_id": 2,
                    "status": "ACTIVE",
                    "profile_picture": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
                    "government_id": "GOV-DHS-88291"
                },
                {
                    "full_name": "Jane Cooper",
                    "email": "jane.cooper@fbi.gov",
                    "password": get_password_hash("password123"),
                    "phone": "+1 (555) 345-6789",
                    "organization": "Federal Bureau of Investigation",
                    "role_id": 3,
                    "status": "APPROVED",
                    "profile_picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
                    "government_id": "GOV-FBI-99102"
                },
                {
                    "full_name": "Cody Fisher",
                    "email": "cody.fisher@nypd.org",
                    "password": get_password_hash("password123"),
                    "phone": "+1 (555) 456-7890",
                    "organization": "New York Police Department",
                    "role_id": 2,
                    "status": "INACTIVE",
                    "profile_picture": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150",
                    "government_id": "GOV-NYPD-7721"
                },
                {
                    "full_name": "Esther Howard",
                    "email": "esther.howard@interpol.int",
                    "password": get_password_hash("password123"),
                    "phone": "+1 (555) 567-8901",
                    "organization": "Interpol Cyber Crime Division",
                    "role_id": 1,
                    "status": "BLOCKED",
                    "profile_picture": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
                    "government_id": "GOV-INT-55123"
                },
                {
                    "full_name": "Marcus Aurelius",
                    "email": "marcus.aurelius@senate.gov",
                    "password": get_password_hash("password123"),
                    "phone": "+1 (555) 678-9012",
                    "organization": "US Senate Intelligence Committee",
                    "role_id": 2,
                    "status": "PENDING",
                    "profile_picture": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150",
                    "government_id": "GOV-SEN-11002"
                },
                {
                    "full_name": "Sarah Connor",
                    "email": "sarah.connor@cyberdyne.org",
                    "password": get_password_hash("password123"),
                    "phone": "+1 (555) 789-0123",
                    "organization": "Cyberdyne Security Systems",
                    "role_id": 3,
                    "status": "PENDING",
                    "profile_picture": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
                    "government_id": "GOV-CYB-00812"
                }
            ]
            for u_data in users_to_seed:
                db_user = User(
                    full_name=u_data["full_name"],
                    email=u_data["email"],
                    password=u_data["password"],
                    phone=u_data["phone"],
                    organization=u_data["organization"],
                    role_id=u_data["role_id"],
                    status=u_data["status"],
                    profile_picture=u_data["profile_picture"],
                    government_id=u_data["government_id"]
                )
                db.add(db_user)
            db.commit()
    except Exception as e:
        print("Database seeding error:", e)
        db.rollback()
    finally:
        db.close()

def seed_ai_models():
    db = SessionLocal()
    try:
        from app.models.models import AIModel, MediaTypeEnum
        if db.query(AIModel).count() == 0:
            models = [
                AIModel(
                    model_name="DeepFakeVision V4",
                    version="4.2.1",
                    media_type=MediaTypeEnum.VIDEO,
                    accuracy=99.2,
                    description="Facial manipulation detection for high-definition video feeds.",
                    status=True
                ),
                AIModel(
                    model_name="FaceConsistency AI",
                    version="1.0.5",
                    media_type=MediaTypeEnum.IMAGE,
                    accuracy=98.7,
                    description="Analyzes facial features consistency, lighting patterns, and shadows in images.",
                    status=True
                ),
                AIModel(
                    model_name="VoiceGuard Synthetic",
                    version="2.1.0",
                    media_type=MediaTypeEnum.AUDIO,
                    accuracy=97.9,
                    description="Voice cloning and synthetic audio detection.",
                    status=True
                )
            ]
            db.add_all(models)
            db.commit()
    except Exception as e:
        print("Database AI models seeding error:", e)
        db.rollback()
    finally:
        db.close()

def seed_investigation_cases():
    db = SessionLocal()
    try:
        from app.models.models import InvestigationCase, EvidenceFile, FileTypeEnum, StatusEnum, InvestigationNote, AuditLog
        from app.models.user import User
        from datetime import datetime, timezone, timedelta
        
        if db.query(InvestigationCase).count() == 0:
            creator = db.query(User).filter(User.role_id == 3).first()
            creator_id = creator.id if creator else 1
            
            investigator = db.query(User).filter(User.role_id == 2).first()
            investigator_id = investigator.id if investigator else 1
            
            now = datetime.now(timezone.utc)
            
            cases_data = [
                {
                    "case_number": "CASE-2026-0048",
                    "title": "Deepfake Investigation – Video Evidence",
                    "description": "AI-generated video submitted as potential digital evidence for forensic analysis and verification.",
                    "created_by": creator_id,
                    "assigned_expert": investigator_id,
                    "status": StatusEnum.CASE_UNDER_INVESTIGATION,
                    "incident_date": now - timedelta(days=2),
                    "submitted_at": now - timedelta(days=2),
                    "opened_at": now - timedelta(days=1),
                },
                {
                    "case_number": "CASE-2026-0039",
                    "title": "Synthetic Audio Impersonation – Executive Call",
                    "description": "Cloned voice recording claiming to be corporate executive authorizing unauthorized wire transfers.",
                    "created_by": creator_id,
                    "assigned_expert": investigator_id,
                    "status": StatusEnum.CASE_UNDER_INVESTIGATION,
                    "incident_date": now - timedelta(days=5),
                    "submitted_at": now - timedelta(days=4),
                    "opened_at": now - timedelta(days=3),
                },
                {
                    "case_number": "CASE-2026-0025",
                    "title": "Manipulated Identity Document Scan",
                    "description": "High-resolution digital passport scan submitted for verification containing neural network facial tampering.",
                    "created_by": creator_id,
                    "assigned_expert": None,
                    "status": StatusEnum.CASE_FILED,
                    "incident_date": now - timedelta(days=3),
                    "submitted_at": now - timedelta(days=3),
                    "opened_at": None,
                },
                {
                    "case_number": "CASE-2026-0012",
                    "title": "Election Broadcast Tampering Analysis",
                    "description": "Altered video clip of political speech circulated on social media platforms.",
                    "created_by": creator_id,
                    "assigned_expert": investigator_id,
                    "status": StatusEnum.CLOSED,
                    "incident_date": now - timedelta(days=10),
                    "submitted_at": now - timedelta(days=10),
                    "opened_at": now - timedelta(days=9),
                },
                {
                    "case_number": "CASE-2026-0051",
                    "title": "Biometric Verification Fraud Check",
                    "description": "Facial recognition spoof attempt detected at automated border control terminal.",
                    "created_by": creator_id,
                    "assigned_expert": investigator_id,
                    "status": StatusEnum.CASE_UNDER_INVESTIGATION,
                    "incident_date": now - timedelta(days=1),
                    "submitted_at": now - timedelta(days=1),
                    "opened_at": now - timedelta(hours=5),
                }
            ]
            
            for c_data in cases_data:
                c = InvestigationCase(**c_data)
                db.add(c)
                db.flush()
                
                # Add sample evidence file
                ef = EvidenceFile(
                    case_id=c.id,
                    uploaded_by=creator_id,
                    file_name=f"evidence_{c.case_number.lower()}.mp4",
                    original_name=f"Digital_Evidence_{c.case_number}.mp4",
                    file_type=FileTypeEnum.VIDEO,
                    mime_type="video/mp4",
                    file_size=15482000,
                    storage_path=f"uploads/evidence_{c.case_number.lower()}.mp4",
                    sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                )
                db.add(ef)
                
                # Add sample audit log
                log = AuditLog(
                    case_id=c.id,
                    user_id=creator_id,
                    action="Case Filed",
                    description=f"Initial case {c.case_number} created and submitted for forensic review."
                )
                db.add(log)
                
            db.commit()
    except Exception as e:
        print("Database case seeding error:", e)
        db.rollback()
    finally:
        db.close()

def seed_synthetic_audit_logs():
    db = SessionLocal()
    try:
        from app.models.models import AuditLog
        from datetime import datetime, timezone, timedelta
        
        count = db.query(AuditLog).filter(AuditLog.event_id != None).count()
        if count < 10:
            now = datetime.now(timezone.utc)
            synthetic_events = [
                {
                    "event_id": "AUD-2026-004281",
                    "actor_id": "INV-023",
                    "actor_role": "Investigator",
                    "action": "CASE_STATUS_CHANGED",
                    "module": "Cases",
                    "target_type": "Case",
                    "target_id": "CASE-00421",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Case status changed.",
                    "timestamp": now - timedelta(minutes=5)
                },
                {
                    "event_id": "AUD-2026-004280",
                    "actor_id": "SENTINEL_AI",
                    "actor_role": "Sentinel AI",
                    "action": "AI_ANALYSIS_COMPLETED",
                    "module": "AI",
                    "target_type": "Evidence",
                    "target_id": "EVD-00912",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "AI risk assessment completed.",
                    "timestamp": now - timedelta(minutes=45)
                },
                {
                    "event_id": "AUD-2026-004279",
                    "actor_id": "USR-0041",
                    "actor_role": "User",
                    "action": "LOGIN_SUCCESS",
                    "module": "Authentication",
                    "target_type": "User",
                    "target_id": "USR-0041",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Successful login.",
                    "timestamp": now - timedelta(hours=2)
                },
                {
                    "event_id": "AUD-2026-004278",
                    "actor_id": "UNK-0000",
                    "actor_role": "User",
                    "action": "LOGIN_FAILED",
                    "module": "Authentication",
                    "target_type": "User",
                    "target_id": "AUTH-REQ",
                    "severity": "WARNING",
                    "status": "FAILED",
                    "description": "Failed login attempt.",
                    "timestamp": now - timedelta(hours=3, minutes=15)
                },
                {
                    "event_id": "AUD-2026-004277",
                    "actor_id": "ADM-001",
                    "actor_role": "Admin",
                    "action": "USER_ROLE_CHANGED",
                    "module": "Permissions",
                    "target_type": "User",
                    "target_id": "USR-0182",
                    "severity": "HIGH",
                    "status": "SUCCESS",
                    "description": "User role changed.",
                    "timestamp": now - timedelta(hours=4, minutes=10)
                },
                {
                    "event_id": "AUD-2026-004276",
                    "actor_id": "INV-014",
                    "actor_role": "Investigator",
                    "action": "AI_DECISION_OVERRIDDEN",
                    "module": "AI",
                    "target_type": "Analysis",
                    "target_id": "AI-9912",
                    "severity": "HIGH",
                    "status": "SUCCESS",
                    "description": "AI assessment manually overridden.",
                    "timestamp": now - timedelta(hours=5, minutes=30)
                },
                {
                    "event_id": "AUD-2026-004275",
                    "actor_id": "SENTINEL_AI",
                    "actor_role": "Sentinel AI",
                    "action": "ALERT_ESCALATED",
                    "module": "System Alerts",
                    "target_type": "Alert",
                    "target_id": "ALT-2026-88",
                    "severity": "HIGH",
                    "status": "SUCCESS",
                    "description": "System alert escalated.",
                    "timestamp": now - timedelta(hours=7, minutes=20)
                },
                {
                    "event_id": "AUD-2026-004274",
                    "actor_id": "ADM-001",
                    "actor_role": "Superuser",
                    "action": "SECURITY_SETTING_CHANGED",
                    "module": "Configuration",
                    "target_type": "System",
                    "target_id": "CFG-SEC-01",
                    "severity": "HIGH",
                    "status": "SUCCESS",
                    "description": "Security threshold updated.",
                    "timestamp": now - timedelta(hours=9)
                },
                {
                    "event_id": "AUD-2026-004273",
                    "actor_id": "SENTINEL_AI",
                    "actor_role": "Sentinel AI",
                    "action": "AI_ANALYSIS_FAILED",
                    "module": "AI",
                    "target_type": "Evidence",
                    "target_id": "EVD-00814",
                    "severity": "WARNING",
                    "status": "FAILED",
                    "description": "AI analysis failed.",
                    "timestamp": now - timedelta(hours=11)
                },
                {
                    "event_id": "AUD-2026-004272",
                    "actor_id": "INV-009",
                    "actor_role": "Investigator",
                    "action": "CASE_ASSIGNED",
                    "module": "Cases",
                    "target_type": "Case",
                    "target_id": "CASE-00422",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Case assigned to investigator.",
                    "timestamp": now - timedelta(hours=14)
                },
                {
                    "event_id": "AUD-2026-004271",
                    "actor_id": "USR-0055",
                    "actor_role": "User",
                    "action": "CASE_CREATED",
                    "module": "Cases",
                    "target_type": "Case",
                    "target_id": "CASE-00422",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Case created.",
                    "timestamp": now - timedelta(hours=16)
                },
                {
                    "event_id": "AUD-2026-004270",
                    "actor_id": "ADM-001",
                    "actor_role": "Admin",
                    "action": "USER_ACTIVATED",
                    "module": "User Management",
                    "target_type": "User",
                    "target_id": "USR-0201",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "User activated.",
                    "timestamp": now - timedelta(hours=20)
                },
                {
                    "event_id": "AUD-2026-004269",
                    "actor_id": "USR-0099",
                    "actor_role": "User",
                    "action": "ACCESS_DENIED",
                    "module": "Permissions",
                    "target_type": "Resource",
                    "target_id": "RES-ADMIN",
                    "severity": "CRITICAL",
                    "status": "FAILED",
                    "description": "Permission denied for unauthorized resource access.",
                    "timestamp": now - timedelta(days=1, hours=2)
                },
                {
                    "event_id": "AUD-2026-004268",
                    "actor_id": "ADM-001",
                    "actor_role": "Superuser",
                    "action": "AI_THRESHOLD_CHANGED",
                    "module": "Configuration",
                    "target_type": "Config",
                    "target_id": "CFG-AI-THRESH",
                    "severity": "HIGH",
                    "status": "SUCCESS",
                    "description": "AI risk threshold changed.",
                    "timestamp": now - timedelta(days=1, hours=5)
                },
                {
                    "event_id": "AUD-2026-004267",
                    "actor_id": "USR-0033",
                    "actor_role": "User",
                    "action": "PASSWORD_RESET_REQUESTED",
                    "module": "Authentication",
                    "target_type": "User",
                    "target_id": "USR-0033",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Password reset requested.",
                    "timestamp": now - timedelta(days=1, hours=8)
                },
                {
                    "event_id": "AUD-2026-004266",
                    "actor_id": "INV-023",
                    "actor_role": "Investigator",
                    "action": "CASE_CLOSED",
                    "module": "Cases",
                    "target_type": "Case",
                    "target_id": "CASE-00410",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Case closed.",
                    "timestamp": now - timedelta(days=2)
                },
                {
                    "event_id": "AUD-2026-004265",
                    "actor_id": "ADM-001",
                    "actor_role": "Admin",
                    "action": "INVESTIGATOR_CREATED",
                    "module": "Investigator Management",
                    "target_type": "Investigator",
                    "target_id": "INV-045",
                    "severity": "INFO",
                    "status": "SUCCESS",
                    "description": "Investigator created.",
                    "timestamp": now - timedelta(days=2, hours=4)
                },
                {
                    "event_id": "AUD-2026-004264",
                    "actor_id": "SENTINEL_AI",
                    "actor_role": "Sentinel AI",
                    "action": "ACCOUNT_LOCKED",
                    "module": "Authentication",
                    "target_type": "User",
                    "target_id": "USR-0089",
                    "severity": "WARNING",
                    "status": "SUCCESS",
                    "description": "Account locked.",
                    "timestamp": now - timedelta(days=3)
                }
            ]

            for ev in synthetic_events:
                existing = db.query(AuditLog).filter(AuditLog.event_id == ev["event_id"]).first()
                if not existing:
                    log_item = AuditLog(
                        event_id=ev["event_id"],
                        actor_id=ev["actor_id"],
                        actor_role=ev["actor_role"],
                        action=ev["action"],
                        module=ev["module"],
                        target_type=ev["target_type"],
                        target_id=ev["target_id"],
                        severity=ev["severity"],
                        status=ev["status"],
                        description=ev["description"],
                        timestamp=ev["timestamp"]
                    )
                    db.add(log_item)
            db.commit()
    except Exception as e:
        print("Database audit logs seeding error:", e)
        db.rollback()
    finally:
        db.close()

# Run database configuration updates and seed initial roles/users/models
init_db_updates()
seed_roles_and_users()
seed_ai_models()
seed_investigation_cases()
seed_synthetic_audit_logs()

app = FastAPI(title="Sentinel AI API")

@app.on_event("startup")
def startup_load_sentinel_model():
    """
    Load Sentinel AI V1.7-A model once on startup and keep resident in memory.
    """
    try:
        from sentinel.inference import SentinelInferenceEngine
        engine = SentinelInferenceEngine.get_instance()
        print(f"[Startup] Sentinel AI V1.7-A model loaded successfully on device: {engine.device}")
    except Exception as e:
        print(f"[Startup Warning] Could not preload Sentinel AI model: {e}")

# Disabled public StaticFiles directory for uploads to secure evidence files.
# Evidence files are now served via authenticated /api/v1/user/evidence/{id}/download endpoints.
os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/analysis", exist_ok=True)
os.makedirs("uploads/reports", exist_ok=True)
# app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Configure CORS so frontend can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.user import router as user_router

app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api")
app.include_router(user_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Sentinel AI Forensic Portal API"}