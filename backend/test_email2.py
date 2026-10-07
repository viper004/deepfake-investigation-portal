import asyncio
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("SMTP_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("SMTP_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "no-reply@sentinel.ai"),
    MAIL_PORT=465,
    MAIL_SERVER=os.getenv("SMTP_HOST", "smtp.gmail.com"),
    MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "Sentinel AI"),
    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=True,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fm = FastMail(conf)

async def main():
    message = MessageSchema(
        subject="Test SSL Email",
        recipients=["jagannathsyam2000@gmail.com"],
        body="This is a test email.",
        subtype=MessageType.html
    )
    try:
        await fm.send_message(message)
        print("Success SSL")
    except Exception as e:
        print("Failed SSL:", e)

if __name__ == "__main__":
    asyncio.run(main())
