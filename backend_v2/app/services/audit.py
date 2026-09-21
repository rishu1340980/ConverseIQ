from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend_v2.app.models.audit_log import AuditLog


async def log_audit_event(
    db: AsyncSession,
    action: str,
    details: str,
    severity: str = "Info",  # Info, OK, Warn, Alert
    user_id: Optional[int] = None,
    user_name: Optional[str] = None,
    ip_address: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
) -> AuditLog:
    """
    Log an operational or security event to the audit_logs table.
    """
    log_entry = AuditLog(
        action=action,
        details=details,
        severity=severity,
        user_id=user_id,
        user_name=user_name,
        ip_address=ip_address,
        resource_type=resource_type,
        resource_id=resource_id,
        timestamp=datetime.utcnow(),
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry
