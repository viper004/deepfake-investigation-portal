import os
import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from dotenv import load_dotenv
from datetime import datetime, timezone
from app.database.database import SessionLocal
from app.models.user import InvestigatorInvitation, InvitationLog

logger = logging.getLogger(__name__)

# Ensure .env is loaded from project backend or root
env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.exists(env_file):
    load_dotenv(env_file)
load_dotenv()

def get_mail_conf() -> ConnectionConfig:
    port = int(os.getenv("SMTP_PORT", "587"))
    smtp_tls = os.getenv("SMTP_TLS", "True").lower() == "true"
    smtp_ssl = os.getenv("SMTP_SSL", "False").lower() == "true"

    if port == 465 and not smtp_ssl:
        smtp_ssl = True
        smtp_tls = False
    elif port == 587 and not smtp_tls:
        smtp_tls = True
        smtp_ssl = False

    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    mail_from = os.getenv("MAIL_FROM") or username or "no-reply@sentinel.ai"
    mail_from_name = os.getenv("MAIL_FROM_NAME", "Aurora Investigation Platform")

    return ConnectionConfig(
        MAIL_USERNAME=username,
        MAIL_PASSWORD=password,
        MAIL_FROM=mail_from,
        MAIL_PORT=port,
        MAIL_SERVER=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        MAIL_FROM_NAME=mail_from_name,
        MAIL_STARTTLS=smtp_tls,
        MAIL_SSL_TLS=smtp_ssl,
        USE_CREDENTIALS=bool(username),
        VALIDATE_CERTS=True,
        TIMEOUT=15
    )

def get_fastmail() -> FastMail:
    return FastMail(get_mail_conf())


async def send_investigator_invitation_email(email: EmailStr, full_name: str, token: str, invitation_id: int):
    """
    Sends an invitation email to a new investigator and logs it in the database.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    registration_link = f"{frontend_url}/register?token={token}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #0a0a0a; border-bottom: 2px solid #CC2200; padding-bottom: 10px;">Sentinel AI Investigation Platform</h2>
        <p>Dear {full_name},</p>
        <p>You have been invited to join the <strong>Sentinel AI Investigation Platform</strong> as an Investigator.</p>
        <p>Please click the button below to complete your secure registration and set up your credentials:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{registration_link}" style="background-color: #CC2200; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Complete Registration</a>
        </div>
        <p style="font-size: 12px; color: #666;">If the button above does not work, copy and paste the following link into your browser:</p>
        <p style="font-size: 12px; word-break: break-all; color: #CC2200;">{registration_link}</p>
        <hr style="border: 0; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
        <p style="font-size: 11px; color: #999;">This invitation link will expire in 7 days. This is an automated message; please do not reply.</p>
    </div>
    """
    
    message = MessageSchema(
        subject="Invitation to Sentinel AI Investigation Platform",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    
    fm = get_fastmail()
    try:
        await fm.send_message(message)
        logger.info("[Email Service] Successfully sent invitation to %s", email)
        
        # Log success to DB
        with SessionLocal() as db:
            inv = db.query(InvestigatorInvitation).filter_by(id=invitation_id).first()
            if inv:
                inv.delivery_status = "Delivered"
                inv.send_attempts += 1
                inv.last_attempt_at = datetime.now(timezone.utc)
                
                log = InvitationLog(
                    invitation_id=inv.id,
                    event_type="Email Sent",
                    status="SUCCESS",
                    recipient_email=email,
                    message="Invitation email successfully delivered."
                )
                db.add(log)
                db.commit()
    except Exception as e:
        logger.error("[Email Service] Failed to send email to %s: %s", email, str(e))
        
        # Log failure to DB
        with SessionLocal() as db:
            inv = db.query(InvestigatorInvitation).filter_by(id=invitation_id).first()
            if inv:
                inv.delivery_status = "Failed"
                inv.send_attempts += 1
                inv.last_attempt_at = datetime.now(timezone.utc)
                
                log = InvitationLog(
                    invitation_id=inv.id,
                    event_type="Email Failed",
                    status="FAILED",
                    recipient_email=email,
                    message=f"Delivery failed: {str(e)[:450]}"
                )
                db.add(log)
                db.commit()

async def send_otp_email(email: str, otp: str):
    """
    Sends a 6-digit OTP verification code to the specified email address.
    Does not log the OTP value to prevent credential leaking.
    """
    logger.info("[OTP SERVICE] Preparing OTP verification email for %s", email)

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0a0a0a; margin: 0; font-size: 20px; font-weight: 700;">Sentinel AI Investigation Platform</h2>
            <p style="color: #666; font-size: 13px; margin-top: 4px;">Email Identity Verification</p>
        </div>
        <div style="background-color: #fafafa; border: 1px solid #eaeaea; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #444; margin-bottom: 12px; font-weight: 500;">Your 6-digit verification code is:</p>
            <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #CC2200; font-family: monospace; padding: 8px 0;">{otp}</div>
            <p style="font-size: 12px; color: #888; margin-top: 12px;">This code will expire in <strong>5 minutes</strong>.</p>
        </div>
        <p style="font-size: 12px; color: #666; line-height: 1.5;">If you did not request this verification code, please ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #aaaaaa; text-align: center;">Sentinel AI Security System &bull; Automated System Message</p>
    </div>
    """

    message = MessageSchema(
        subject="Your Sentinel AI Verification Code",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    fm = get_fastmail()
    try:
        await fm.send_message(message)
        logger.info("[Email Service] Successfully sent OTP email to %s", email)
        return True
    except Exception as e:
        logger.error("[Email Service] SMTP send failed for %s: %s", email, str(e))
        return False

async def send_password_change_otp_email(email: str, user_name: str, otp: str):
    """
    Sends a 6-digit OTP verification code for password change.
    """
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #0a0a0a;">Sentinel AI - Password Change Verification Code</h2>
        <p>Hello {user_name},</p>
        <p>Your Sentinel AI password change verification code is:</p>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #CC2200; font-family: monospace; padding: 8px 0; text-align: center;">{otp}</div>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not request a password change, you can safely ignore this email.</p>
        <p>Regards,<br>Sentinel AI Security Team</p>
    </div>
    """

    message = MessageSchema(
        subject="Sentinel AI - Password Change Verification Code",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    fm = get_fastmail()
    try:
        await fm.send_message(message)
        logger.info("[Email Service] Successfully sent password change OTP to %s", email)
        return True
    except Exception as e:
        logger.error("[Email Service] Password Change OTP send failed for %s: %s", email, str(e))
        return False


