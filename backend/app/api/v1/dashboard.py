from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.meeting import Meeting
from app.models.action_item import ActionItem
from app.models.department import Department
from app.models.audit_log import AuditLog
from app.schemas.dashboard import FacultyDashboardResponse, DashboardMetrics, AdminDashboardResponse
from app.schemas.meeting import MeetingResponse
from app.schemas.action_item import ActionItemResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/faculty", response_model=FacultyDashboardResponse)
async def get_faculty_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns personalized live dashboard statistics for the logged in faculty member.
    """
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)

    # Time-based greeting
    hour = datetime.now().hour
    time_greeting = "Good morning" if hour < 12 else ("Good afternoon" if hour < 17 else "Good evening")
    greeting = f"{time_greeting}, {current_user.name}"

    # 1. Total meetings created by this user
    total_m_res = await db.execute(
        select(func.count(Meeting.id)).where(Meeting.created_by_id == current_user.id)
    )
    total_meetings = total_m_res.scalar() or 0

    # 2. Pending action items
    pending_items_res = await db.execute(
        select(ActionItem)
        .join(Meeting)
        .where(
            Meeting.created_by_id == current_user.id,
            ActionItem.status == "Pending"
        )
    )
    all_pending_items = pending_items_res.scalars().all()
    pending_count = len(all_pending_items)

    # 3. Upcoming deadlines (due within next 7 days)
    deadlines_res = await db.execute(
        select(func.count(ActionItem.id))
        .join(Meeting)
        .where(
            Meeting.created_by_id == current_user.id,
            ActionItem.status == "Pending",
            ActionItem.due_date >= now,
            ActionItem.due_date <= week_end
        )
    )
    upcoming_deadlines_count = deadlines_res.scalar() or 0

    # 4. Upcoming sessions this week
    sessions_res = await db.execute(
        select(func.count(Meeting.id)).where(
            Meeting.created_by_id == current_user.id,
            Meeting.date >= now,
            Meeting.date <= week_end
        )
    )
    upcoming_sessions_count = sessions_res.scalar() or 0

    # 5. Recent meetings
    recent_m_stmt = (
        select(Meeting)
        .options(selectinload(Meeting.participants))
        .where(Meeting.created_by_id == current_user.id)
        .order_by(Meeting.date.desc())
        .limit(5)
    )
    recent_m_res = await db.execute(recent_m_stmt)
    recent_meetings = recent_m_res.scalars().all()

    # 6. Upcoming this week
    upcoming_m_stmt = (
        select(Meeting)
        .options(selectinload(Meeting.participants))
        .where(
            Meeting.created_by_id == current_user.id,
            Meeting.date >= now
        )
        .order_by(Meeting.date.asc())
        .limit(5)
    )
    upcoming_m_res = await db.execute(upcoming_m_stmt)
    upcoming_meetings = upcoming_m_res.scalars().all()

    # 7. Priority Action Items (High & Medium)
    priority_items_stmt = (
        select(ActionItem)
        .join(Meeting)
        .where(
            Meeting.created_by_id == current_user.id,
            ActionItem.status == "Pending",
            ActionItem.priority.in_(["High", "Medium"])
        )
        .order_by(ActionItem.priority.asc(), ActionItem.due_date.asc().nullslast())
        .limit(6)
    )
    priority_res = await db.execute(priority_items_stmt)
    priority_items = priority_res.scalars().all()

    return FacultyDashboardResponse(
        greeting=greeting,
        user_name=current_user.name,
        role=current_user.role,
        metrics=DashboardMetrics(
            total_meetings=total_meetings,
            pending_action_items=pending_count,
            upcoming_deadlines_count=upcoming_deadlines_count,
            upcoming_sessions_count=upcoming_sessions_count
        ),
        recent_meetings=[MeetingResponse.model_validate(m) for m in recent_meetings],
        upcoming_this_week=[MeetingResponse.model_validate(m) for m in upcoming_meetings],
        priority_action_items=[ActionItemResponse.model_validate(a) for a in priority_items]
    )

@router.get("/admin", response_model=AdminDashboardResponse)
async def get_admin_dashboard(
    current_user: User = Depends(require_roles(["Admin", "HOD"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns organization-wide metrics and alerts for administrators and HODs.
    """
    total_faculty = (await db.execute(select(func.count(User.id)).where(User.role == "Faculty"))).scalar() or 0
    total_meetings = (await db.execute(select(func.count(Meeting.id)))).scalar() or 0
    total_actions = (await db.execute(select(func.count(ActionItem.id)))).scalar() or 0
    completed_actions = (await db.execute(select(func.count(ActionItem.id)).where(ActionItem.status == "Completed"))).scalar() or 0
    active_depts = (await db.execute(select(func.count(Department.id)))).scalar() or 0

    completion_rate = (completed_actions / total_actions * 100.0) if total_actions > 0 else 0.0

    # Department breakdown
    depts_res = await db.execute(select(Department).options(selectinload(Department.meetings), selectinload(Department.faculty_members)))
    depts = depts_res.scalars().all()
    dept_activity = []
    for d in depts:
        dept_activity.append({
            "department_id": d.id,
            "department_name": d.name,
            "faculty_count": len(d.faculty_members),
            "meeting_count": len(d.meetings)
        })

    # Recent Alerts feed
    alerts_stmt = (
        select(AuditLog)
        .where(AuditLog.severity.in_(["Warn", "Alert"]))
        .order_by(AuditLog.timestamp.desc())
        .limit(8)
    )
    alerts_res = await db.execute(alerts_stmt)
    alerts = alerts_res.scalars().all()

    return AdminDashboardResponse(
        total_faculty=total_faculty,
        total_meetings=total_meetings,
        action_items_tracked=total_actions,
        active_departments=active_depts,
        completion_percentage=round(completion_rate, 1),
        department_activity=dept_activity,
        system_alerts=[
            {
                "id": a.id,
                "action": a.action,
                "details": a.details,
                "severity": a.severity,
                "timestamp": a.timestamp.isoformat()
            }
            for a in alerts
        ]
    )
