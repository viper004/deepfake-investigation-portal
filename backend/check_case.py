from app.database.database import SessionLocal
from app.models.models import InvestigationCase
db = SessionLocal()
c = db.query(InvestigationCase).filter_by(case_number="CASE-260807192232-61F3").first()
if c:
    print(f"Status: {c.status}")
    print(f"Assigned Expert: {c.assigned_expert}")
else:
    print("Case not found")
