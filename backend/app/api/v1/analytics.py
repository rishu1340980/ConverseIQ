import calendar
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.models.meeting import Meeting
from app.models.action_item import ActionItem
from app.models.department import Department
from app.models.analytics import AnalyticsEvent
from app.models.audit_log import AuditLog
from app.schemas.analytics import AnalyticsSummaryResponse, UsageStats

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    current_user: User = Depends(require_roles(["Admin", "HOD"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns authentic, real-time institutional usage statistics and chart trends
    calculated directly from operational database records.
    """
    now = datetime.now(timezone.utc)

    # 1. Total meetings & duration
    meetings_res = await db.execute(select(Meeting))
    meetings = meetings_res.scalars().all()
    total_meetings = len(meetings)
    avg_duration = (sum(m.duration_minutes for m in meetings) / total_meetings) if total_meetings else 0.0

    # 2. Action items metrics
    actions_res = await db.execute(select(ActionItem))
    actions = actions_res.scalars().all()
    total_actions = len(actions)
    completed_actions = sum(1 for a in actions if a.status == "Completed")

    actions_per_meeting = round(total_actions / total_meetings, 1) if total_meetings else 0.0
    completion_rate = round((completed_actions / total_actions * 100.0), 1) if total_actions else 0.0

    # 3. AI Queries from real AnalyticsEvent
    ai_queries_res = await db.execute(
        select(func.count(AnalyticsEvent.id)).where(AnalyticsEvent.event_name == "ai_assistant_queried")
    )
    ai_queries_count = ai_queries_res.scalar() or 0

    # 4. Real Monthly Trend Data (Calculated dynamically for the past 6 calendar months)
    trend_data = []
    has_trend_activity = False

    for i in range(5, -1, -1):
        # Calculate month year offset
        target_year = now.year
        target_month = now.month - i
        while target_month <= 0:
            target_month += 12
            target_year -= 1

        month_name = calendar.month_abbr[target_month]
        _, last_day = calendar.monthrange(target_year, target_month)
        start_dt = datetime(target_year, target_month, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_dt = datetime(target_year, target_month, last_day, 23, 59, 59, tzinfo=timezone.utc)

        # Count meetings in month
        m_count = sum(1 for m in meetings if m.date and start_dt <= (m.date.replace(tzinfo=timezone.utc) if m.date.tzinfo is None else m.date) <= end_dt)
        # Count action items created in month
        a_count = sum(1 for a in actions if a.created_at and start_dt <= (a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at) <= end_dt)
        # Count completed action items
        c_count = sum(1 for a in actions if a.status == "Completed" and a.created_at and start_dt <= (a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at) <= end_dt)

        if m_count > 0 or a_count > 0:
            has_trend_activity = True

        trend_data.append({
            "month": month_name,
            "meetings": m_count,
            "actions": a_count,
            "completion": c_count
        })

    # 5. Department engagement from real database records
    depts_res = await db.execute(select(Department).options(selectinload(Department.meetings)))
    depts = depts_res.scalars().all()
    dept_engagement = []

    for d in depts:
        d_meetings = len(d.meetings)
        score = round((d_meetings / max(1, total_meetings)) * 100, 1) if total_meetings else 0.0
        dept_engagement.append({
            "department": d.name,
            "meetings": d_meetings,
            "score": score
        })

    # 6. Feature usage breakdown from real operational tables and audit logs
    audio_uploaded_res = await db.execute(
        select(func.count(Meeting.id)).where(Meeting.audio_file_path.isnot(None))
    )
    audio_uploaded = audio_uploaded_res.scalar() or 0

    mom_edits_res = await db.execute(
        select(func.count(AuditLog.id)).where(
            or_(AuditLog.action.ilike("%MoM%"), AuditLog.action.ilike("%Edit%"))
        )
    )
    mom_edits = mom_edits_res.scalar() or 0

    mom_exports_res = await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.action.ilike("%Export%"))
    )
    mom_exports = mom_exports_res.scalar() or 0

    feature_breakdown = {
        "audio_recordings_uploaded": audio_uploaded,
        "mom_edits_performed": mom_edits,
        "mom_pdf_docx_exports": mom_exports,
        "ai_assistant_queries": ai_queries_count,
        "action_items_resolved": completed_actions
    }

    context_descriptions = {
        "meetings_vs_actions_trend": "Tracks monthly academic session cadence alongside assigned faculty action items and task closures across the Department of Information Technology.",
        "department_engagement": "Evaluates departmental deliberation density and governance participation metrics based on recorded meetings in the system.",
        "feature_usage_breakdown": "Monitors utilization of ConverseIQ AI intelligence modules, transcription services, and institutional MoM generation."
    }

    has_sufficient_data = bool(total_meetings > 0 or total_actions > 0)

    return AnalyticsSummaryResponse(
        stats=UsageStats(
            avg_meeting_duration_mins=round(avg_duration, 1),
            actions_per_meeting=actions_per_meeting,
            action_completion_rate=completion_rate,
            ai_queries_this_month=ai_queries_count
        ),
        meetings_vs_actions_trend=trend_data,
        department_engagement=dept_engagement,
        feature_usage_breakdown=feature_breakdown,
        has_sufficient_data=has_sufficient_data,
        context_descriptions=context_descriptions
    )

