import smtplib
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

user = os.getenv("SMTP_USERNAME")
pwd = os.getenv("SMTP_PASSWORD")
server = os.getenv("SMTP_HOST")

print(f"Connecting to {server}:587 with {user}")

try:
    s = smtplib.SMTP(server, 587)
    s.set_debuglevel(1)
    s.ehlo()
    s.starttls()
    s.ehlo()
    s.login(user, pwd)
    print("Login successful")
    s.quit()
except Exception as e:
    print("Error:", e)
