import asyncio
from app.services.email_service import send_otp_email, send_password_change_otp_email
import os
from dotenv import load_dotenv

# Ensure dotenv is loaded from the correct path
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

async def main():
    print("SMTP_USERNAME:", os.getenv("SMTP_USERNAME"))
    print("Testing send_otp_email...")
    res1 = await send_otp_email("jagannathsyam2000@gmail.com", "123456")
    print("res1:", res1)
    print("Testing send_password_change_otp_email...")
    res2 = await send_password_change_otp_email("jagannathsyam2000@gmail.com", "Test User", "123456")
    print("res2:", res2)

if __name__ == "__main__":
    asyncio.run(main())
