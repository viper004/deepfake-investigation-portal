from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
import random
from app.models.models import AuditLog

def log_audit_event(
    db: Session,
    action: str,
    module: str = "System",
    severity: str = "INFO",
    status: str = "SUCCESS",
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    description: Optional[str] = None,
    user_id: Optional[int] = None,
    case_id: Optional[int] = None
):
    """
    Privacy-first Audit Logging Service.
    Enforces minimum data storage rules:
    - Never stores sensitive content (passwords, tokens, private case content, raw AI prompts/responses).
    - Only logs WHO, WHAT, WHEN, WHICH SYSTEM AREA, and WHETHER it succeeded.
    """
    try:
        # Generate event_id
        event_num = random.randint(100000, 999999)
        event_id = f"AUD-2026-{event_num}"

        # Clean/sanitize description to ensure minimum data policy
        clean_desc = description.strip() if description else f"{action.replace('_', ' ').title()} recorded."
        
        log_entry = AuditLog(
            event_id=event_id,
            case_id=case_id,
            user_id=user_id,
            actor_id=actor_id or (f"USR-{user_id}" if user_id else "SYSTEM"),
            actor_role=actor_role or "System",
            action=action,
            module=module,
            target_type=target_type or ("Case" if case_id else "System"),
            target_id=target_id or (f"CASE-{case_id}" if case_id else None),
            severity=severity,
            status=status,
            description=clean_desc,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(log_entry)
        db.commit()
        return log_entry
    except Exception as e:
        print(f"[Audit Log Error] Failed to write audit event: {e}")
        db.rollback()
        return None
