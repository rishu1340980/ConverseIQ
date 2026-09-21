from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, or_

from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.models.audit_log import AuditLog
from backend_v2.app.models.system_setting import SystemSetting
from backend_v2.app.services.audit import log_audit_event

router = APIRouter(tags=["Admin & Governance"])


class UpdateSettingsRequest(BaseModel):
    institution_name: Optional[str] = None
    ai_model: Optional[str] = None
    retention_days: Optional[int] = None
    enable_email_alerts: Optional[bool] = None
    enable_auto_transcription: Optional[bool] = None
    enable_2fa: Optional[bool] = None


@router.get("/audit")
async def get_audit_logs(
    severity: Optional[str] = Query(None, description="Filter by severity: Info, OK, Warn, Alert"),
    search: Optional[str] = Query(None, description="Search keyword in action or details"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve real-time operational and security audit logs.
    Strictly restricted to Admin role.
    """
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Institutional Administrators."
        )

    stmt = select(AuditLog)

    if severity:
        stmt = stmt.filter(AuditLog.severity == severity)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.filter(
            or_(
                AuditLog.action.ilike(pattern),
                AuditLog.details.ilike(pattern),
                AuditLog.user_name.ilike(pattern),
            )
        )

    stmt = stmt.order_by(desc(AuditLog.timestamp)).limit(limit).offset(offset)
    res = await db.execute(stmt)
    logs = res.scalars().all()

    return [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "severity": log.severity,
            "user_id": log.user_id,
            "user_name": log.user_name,
            "ip_address": log.ip_address,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]


@router.get("/analytics")
async def get_system_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Compute real aggregated system analytics and 6-month historical trends.
    Strictly real data computed from active database records.
    """
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Institutional Administrators."
        )

    # 1. Avg meeting duration
    avg_dur_res = await db.execute(select(func.avg(Meeting.duration_minutes)))
    avg_dur = avg_dur_res.scalar()
    avg_meeting_duration = round(float(avg_dur)) if avg_dur is not None else 0

    # 2. Total meetings
    total_meetings_res = await db.execute(select(func.count(Meeting.id)))
    total_meetings = total_meetings_res.scalar() or 0

    # 3. Actions tracked
    total_actions_res = await db.execute(select(func.count(ActionItem.id)))
    total_actions = total_actions_res.scalar() or 0

    # 4. Completed actions
    completed_actions_res = await db.execute(
        select(func.count(ActionItem.id)).filter(ActionItem.status == "Completed")
    )
    completed_actions = completed_actions_res.scalar() or 0

    # 5. Actions per meeting
    actions_per_meeting = round(total_actions / total_meetings, 1) if total_meetings > 0 else 0.0

    # 6. Action completion rate
    action_completion_rate = round((completed_actions / total_actions) * 100, 1) if total_actions > 0 else 0.0

    # 7. AI Queries logged this month
    now = datetime.utcnow()
    first_of_this_month = datetime(now.year, now.month, 1)
    ai_queries_res = await db.execute(
        select(func.count(AuditLog.id)).filter(
            AuditLog.action == "AI_QUERY",
            AuditLog.timestamp >= first_of_this_month
        )
    )
    ai_queries_this_month = ai_queries_res.scalar() or 0

    # 8. 6-Month Meeting & Action Item Historical Trends
    # Compute the past 6 calendar months (including current month)
    trends = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    for i in range(5, -1, -1):
        # Calculate year and month for (now - i months)
        target_year = now.year
        target_month = now.month - i
        while target_month <= 0:
            target_month += 12
            target_year -= 1

        start_of_month = datetime(target_year, target_month, 1)
        if target_month == 12:
            end_of_month = datetime(target_year + 1, 1, 1)
        else:
            end_of_month = datetime(target_year, target_month + 1, 1)

        # Count meetings in this month
        m_count_res = await db.execute(
            select(func.count(Meeting.id)).filter(
                Meeting.created_at >= start_of_month,
                Meeting.created_at < end_of_month
            )
        )
        m_count = m_count_res.scalar() or 0

        # Count actions in this month
        a_count_res = await db.execute(
            select(func.count(ActionItem.id)).filter(
                ActionItem.created_at >= start_of_month,
                ActionItem.created_at < end_of_month
            )
        )
        a_count = a_count_res.scalar() or 0

        month_label = month_names[target_month - 1]
        trends.append({
            "month": month_label,
            "meetings": m_count,
            "actions": a_count
        })

    return {
        "stats": {
            "avg_meeting_duration_mins": avg_meeting_duration,
            "actions_per_meeting": actions_per_meeting,
            "action_completion_rate": action_completion_rate,
            "ai_queries_this_month": ai_queries_this_month,
        },
        "meetings_vs_actions_trend": trends,
    }


@router.get("/admin/settings")
async def get_system_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current institutional configuration and feature toggles.
    Restricted to Admin.
    """
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Institutional Administrators."
        )

    stmt = select(SystemSetting).limit(1)
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()

    if not setting:
        # Create initial default record
        setting = SystemSetting()
        db.add(setting)
        await db.commit()
        await db.refresh(setting)

    return {
        "institution_name": setting.institution_name,
        "ai_model": setting.ai_model,
        "retention_days": setting.retention_days,
        "enable_email_alerts": setting.enable_email_alerts,
        "enable_auto_transcription": setting.enable_auto_transcription,
        "enable_2fa": setting.enable_2fa,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
    }


@router.put("/admin/settings")
async def update_system_settings(
    payload: UpdateSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update institutional configuration.
    Logs audit event and persists changes to database.
    """
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Institutional Administrators."
        )

    stmt = select(SystemSetting).limit(1)
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()

    if not setting:
        setting = SystemSetting()
        db.add(setting)

    changes = []
    if payload.institution_name is not None and payload.institution_name != setting.institution_name:
        setting.institution_name = payload.institution_name
        changes.append("institution_name")
    if payload.ai_model is not None and payload.ai_model != setting.ai_model:
        setting.ai_model = payload.ai_model
        changes.append("ai_model")
    if payload.retention_days is not None and payload.retention_days != setting.retention_days:
        setting.retention_days = payload.retention_days
        changes.append("retention_days")
    if payload.enable_email_alerts is not None and payload.enable_email_alerts != setting.enable_email_alerts:
        setting.enable_email_alerts = payload.enable_email_alerts
        changes.append("enable_email_alerts")
    if payload.enable_auto_transcription is not None and payload.enable_auto_transcription != setting.enable_auto_transcription:
        setting.enable_auto_transcription = payload.enable_auto_transcription
        changes.append("enable_auto_transcription")
    if payload.enable_2fa is not None and payload.enable_2fa != setting.enable_2fa:
        setting.enable_2fa = payload.enable_2fa
        changes.append("enable_2fa")

    setting.updated_at = datetime.utcnow()
    setting.updated_by_id = current_user.id

    await db.commit()
    await db.refresh(setting)

    # Log audit event
    details = f"Admin {current_user.name} updated settings: {', '.join(changes)}" if changes else f"Admin {current_user.name} reviewed system settings without changes."
    await log_audit_event(
        db=db,
        action="SYSTEM_SETTINGS_UPDATED",
        details=details,
        severity="Warn" if changes else "Info",
        user_id=current_user.id,
        user_name=current_user.name,
        resource_type="settings",
        resource_id=setting.id,
    )

    return {
        "institution_name": setting.institution_name,
        "ai_model": setting.ai_model,
        "retention_days": setting.retention_days,
        "enable_email_alerts": setting.enable_email_alerts,
        "enable_auto_transcription": setting.enable_auto_transcription,
        "enable_2fa": setting.enable_2fa,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
    }
