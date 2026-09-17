from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

async def log_audit_event(
    db: AsyncSession,
    action: str,
    details: str,
    severity: str = "Info",
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None
) -> AuditLog:
    """
    Writes a structured audit log entry for sensitive backend events.
    Severity levels: 'Info', 'OK', 'Warn', 'Alert'
    """
    valid_severities = {"Info", "OK", "Warn", "Alert"}
    if severity not in valid_severities:
        severity = "Info"
        
    audit_entry = AuditLog(
        action=action,
        details=details,
        severity=severity,
        user_id=user_id,
        ip_address=ip_address,
        resource_type=resource_type,
        resource_id=resource_id
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(audit_entry)
    return audit_entry
