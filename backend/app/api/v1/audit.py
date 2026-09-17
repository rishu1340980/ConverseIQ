from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit Log"])

@router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    severity: Optional[str] = Query(None, description="'Info', 'OK', 'Warn', 'Alert'"),
    search: Optional[str] = Query(None, description="Search in action or details"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 18: Admin view of system audit logs. Timestamped, searchable, and filterable.
    """
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc())

    if severity:
        stmt = stmt.where(AuditLog.severity == severity)

    if search:
        stmt = stmt.where(
            (AuditLog.action.ilike(f"%{search}%")) | (AuditLog.details.ilike(f"%{search}%"))
        )

    stmt = stmt.limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()
