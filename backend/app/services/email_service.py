import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from dotenv import load_dotenv

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "no-reply@deepguard.com"),
    MAIL_PORT=int(os.getenv("SMTP_PORT", 587)),
    MAIL_SERVER=os.getenv("SMTP_HOST", "smtp.mailtrap.io"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "DeepGuard Investigation Platform"),
    MAIL_STARTTLS=os.getenv("SMTP_TLS", "True").lower() == "true",
    MAIL_SSL_TLS=os.getenv("SMTP_SSL", "False").lower() == "true",
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fm = FastMail(conf)

async def send_investigator_invitation_email(email: EmailStr, full_name: str, token: str):
    """
    Sends an invitation email to a new investigator.
    """
    registration_link = f"http://localhost:3000/register?token={token}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
        <h2 style="color: #0a0a0a; border-bottom: 2px solid #CC2200; padding-bottom: 10px;">DeepGuard Investigation Platform</h2>
        <p>Dear {full_name},</p>
        <p>You have been invited to join the <strong>DeepGuard Investigation Platform</strong> as an Investigator.</p>
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
        subject="Invitation to DeepGuard Investigation Platform",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    
    try:
        await fm.send_message(message)
        print(f"[Email Service] Successfully sent invitation to {email}")
    except Exception as e:
        print(f"[Email Service] Failed to send email to {email}: {str(e)}")
