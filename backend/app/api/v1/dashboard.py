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
from app.models.participant import Participant
from app.schemas.dashboard import (
    FacultyDashboardResponse, 
    DashboardMetrics, 
    AdminDashboardResponse,
    HodDashboardResponse,
    HodMetrics,
    FacultyPerformanceItem,
    WeeklyMeetingItem,
    UrgentActionItem
)
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

@router.get("/hod", response_model=HodDashboardResponse)
async def get_hod_dashboard(
    current_user: User = Depends(require_roles(["Admin", "HOD"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns authentic executive metrics, departmental action completion rates,
    weekly meeting trends, and urgent pending deliverables for HOD oversight.
    """
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)

    # 1. Resolve department
    dept = None
    if current_user.department_id:
        dept = await db.get(Department, current_user.department_id)
    if not dept:
        dept_res = await db.execute(select(Department).where(Department.hod_id == current_user.id))
        dept = dept_res.scalars().first()
    if not dept:
        dept_res = await db.execute(select(Department).where(Department.name.ilike("%Information Technology%")))
        dept = dept_res.scalars().first()
    if not dept:
        dept_res = await db.execute(select(Department))
        dept = dept_res.scalars().first()

    dept_id = dept.id if dept else 1

    # 2. Total faculty count in department
    total_faculty_res = await db.execute(
        select(func.count(User.id)).where(User.department_id == dept_id, User.role == "Faculty")
    )
    total_faculty = total_faculty_res.scalar() or 0
    if total_faculty == 0:
        fallback_fac = await db.execute(select(func.count(User.id)).where(User.role == "Faculty"))
        total_faculty = fallback_fac.scalar() or 0

    # 3. Department meetings
    meetings_stmt = (
        select(Meeting)
        .options(selectinload(Meeting.participants), selectinload(Meeting.action_items))
    )
    if dept:
        m_res = await db.execute(meetings_stmt.where(Meeting.department_id == dept.id))
        dept_meetings = m_res.scalars().all()
        if not dept_meetings:
            m_res = await db.execute(meetings_stmt)
            dept_meetings = m_res.scalars().all()
    else:
        m_res = await db.execute(meetings_stmt)
        dept_meetings = m_res.scalars().all()

    # Meetings this month
    meetings_this_month = sum(
        1 for m in dept_meetings 
        if m.date and (m.date.replace(tzinfo=timezone.utc) if m.date.tzinfo is None else m.date) >= month_start
    )

    # 4. Department action items
    dept_actions = []
    for m in dept_meetings:
        dept_actions.extend(m.action_items)

    total_actions_count = len(dept_actions)
    pending_actions = sum(1 for a in dept_actions if a.status == "Pending")
    completed_actions = sum(1 for a in dept_actions if a.status == "Completed")
    completion_rate = round((completed_actions / total_actions_count * 100.0), 1) if total_actions_count > 0 else 0.0

    # 5. Average duration & participants
    total_duration = sum(m.duration_minutes for m in dept_meetings if m.duration_minutes)
    avg_duration_val = (total_duration / len(dept_meetings)) if dept_meetings else 0
    avg_duration = f"{int(round(avg_duration_val))}m" if avg_duration_val > 0 else "0m"

    total_participants = sum(len(m.participants) for m in dept_meetings)
    avg_participants = int(round(total_participants / len(dept_meetings))) if dept_meetings else 0

    # 6. Faculty performance
    fac_res = await db.execute(select(User).where(User.department_id == dept_id, User.role == "Faculty"))
    faculty_users = fac_res.scalars().all()
    if not faculty_users:
        fac_res = await db.execute(select(User).where(User.role == "Faculty"))
        faculty_users = fac_res.scalars().all()

    perf_list = []
    for u in faculty_users:
        u_actions = [
            a for a in dept_actions 
            if a.owner_id == u.id or (a.owner_name and u.name.lower() in a.owner_name.lower())
        ]
        u_total = len(u_actions)
        u_completed = sum(1 for a in u_actions if a.status == "Completed")
        rate = round(u_completed / u_total * 100.0, 1) if u_total > 0 else 0.0
        perf_list.append(FacultyPerformanceItem(
            name=u.name,
            rate=rate,
            total_actions=u_total,
            completed_actions=u_completed
        ))

    perf_list.sort(key=lambda x: (x.total_actions or 0, x.rate), reverse=True)
    top_perf = perf_list[:6]

    # 7. Weekly meetings trend (past 4 weeks)
    weekly_meetings = []
    for w in range(3, -1, -1):
        w_start = now - timedelta(days=(w + 1) * 7)
        w_end = now - timedelta(days=w * 7)
        week_label = f"Wk {4 - w}" if w > 0 else "This Wk"
        count = sum(
            1 for m in dept_meetings 
            if m.date and w_start <= (m.date.replace(tzinfo=timezone.utc) if m.date.tzinfo is None else m.date) <= w_end
        )
        weekly_meetings.append(WeeklyMeetingItem(week=week_label, count=count))

    # 8. Urgent action items
    urgent_items = [a for a in dept_actions if a.status == "Pending" and a.priority in ["High", "Urgent"]]
    if not urgent_items:
        urgent_items = [a for a in dept_actions if a.status == "Pending"]
    urgent_items = urgent_items[:5]
    urgent_list = [
        UrgentActionItem(
            task=a.task,
            assignedTo=a.owner_name or "Faculty Member",
            deadline=a.due_date.strftime("%d %b %Y") if a.due_date else "ASAP",
            priority=a.priority or "High"
        )
        for a in urgent_items
    ]

    context_descriptions = {
        "faculty_performance": "Monitors individual faculty deliverable completion rates across departmental deliberations and academic audits.",
        "department_meetings_trend": "Visualizes weekly academic meeting frequency and time commitment across semester cycles for the Department of Information Technology."
    }

    has_sufficient_data = bool(len(dept_meetings) > 0 or total_actions_count > 0)

    return HodDashboardResponse(
        metrics=HodMetrics(
            total_faculty=total_faculty,
            meetings_this_month=meetings_this_month,
            pending_actions=pending_actions,
            completion_rate=completion_rate,
            avg_duration=avg_duration,
            avg_participants=avg_participants
        ),
        faculty_performance=top_perf,
        weekly_meetings=weekly_meetings,
        urgent_actions=urgent_list,
        has_sufficient_data=has_sufficient_data,
        context_descriptions=context_descriptions
    )

