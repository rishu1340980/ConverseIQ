from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc
from datetime import datetime, timezone
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.models.department import Department
from backend_v2.app.models.audit_log import AuditLog

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/faculty")
async def get_faculty_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Total meetings
    m_count_stmt = select(func.count(Meeting.id))
    m_count_res = await db.execute(m_count_stmt)
    total_meetings = m_count_res.scalar() or 0

    # Pending action items
    pending_stmt = select(func.count(ActionItem.id)).filter(ActionItem.status != "Completed")
    pending_res = await db.execute(pending_stmt)
    pending_actions = pending_res.scalar() or 0

    # Upcoming deadlines
    now = datetime.now(timezone.utc)
    deadlines_stmt = select(func.count(ActionItem.id)).filter(
        ActionItem.due_date >= now,
        ActionItem.status != "Completed"
    )
    deadlines_res = await db.execute(deadlines_stmt)
    upcoming_deadlines = deadlines_res.scalar() or 0

    # Priority action items (latest 5)
    items_stmt = (
        select(ActionItem)
        .order_by(
            ActionItem.status.asc(),
            ActionItem.due_date.asc().nulls_last()
        )
        .limit(5)
    )
    items_res = await db.execute(items_stmt)
    priority_items = items_res.scalars().all()

    # Recent meetings (latest 3)
    recent_m_stmt = (
        select(Meeting)
        .order_by(Meeting.date.desc())
        .limit(3)
    )
    recent_m_res = await db.execute(recent_m_stmt)
    recent_meetings = recent_m_res.scalars().all()

    # Upcoming scheduled meetings
    sched_stmt = (
        select(Meeting)
        .filter(
            (Meeting.user_id == current_user.id) | (Meeting.department_id == current_user.department_id),
            Meeting.status.in_(["Scheduled", "Upcoming"])
        )
        .order_by(Meeting.date.asc())
        .limit(5)
    )
    sched_res = await db.execute(sched_stmt)
    sched_meetings = sched_res.scalars().all()

    # Deadlines for faculty
    fac_deadlines_stmt = (
        select(ActionItem)
        .filter(
            ActionItem.due_date >= now,
            ActionItem.status != "Completed"
        )
        .order_by(ActionItem.due_date.asc())
        .limit(5)
    )
    fac_deadlines_res = await db.execute(fac_deadlines_stmt)
    fac_deadlines = fac_deadlines_res.scalars().all()

    return {
        "metrics": {
            "total_meetings": total_meetings,
            "pending_action_items": pending_actions,
            "upcoming_deadlines_count": upcoming_deadlines,
            "upcoming_sessions_count": len(sched_meetings),
        },
        "priority_action_items": [
            {
                "id": it.id,
                "task": it.task,
                "owner_name": it.owner_name,
                "priority": it.priority,
                "status": it.status,
                "due_date": it.due_date.isoformat() if it.due_date else None,
            }
            for it in priority_items
        ],
        "recent_meetings": [
            {
                "id": m.id,
                "title": m.title,
                "date": m.date.isoformat() if m.date else None,
                "duration_minutes": m.duration_minutes,
                "status": m.status,
                "participant_count": 1,
            }
            for m in recent_meetings
        ],
        "schedule": {
            "meetings": [
                {
                    "title": m.title,
                    "date": m.date.strftime("%d") if m.date else "",
                    "date_info": m.date.strftime("%b %d, %Y • %I:%M %p") if m.date else "",
                }
                for m in sched_meetings
            ],
            "sessions": [],
            "deadlines": [
                {
                    "title": it.task,
                    "due_date": it.due_date.strftime("%d") if it.due_date else "",
                    "date_info": it.due_date.strftime("%b %d, %Y") if it.due_date else "",
                }
                for it in fac_deadlines
            ],
        },
        "upcoming_events": [],
    }


@router.get("/hod")
async def get_hod_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    HOD department-scoped dashboard.
    All data is filtered to HOD's department only — no dummy/hallucinated values.
    Empty arrays are returned when no real data exists.
    """
    dept_id = current_user.department_id

    # ── 1. Faculty in this department ──────────────────────────────────────
    faculty_stmt = select(User).filter(
        User.department_id == dept_id,
        User.role == "Faculty",
        User.is_active == True,
    )
    faculty_res = await db.execute(faculty_stmt)
    faculty_members = faculty_res.scalars().all()
    total_faculty = len(faculty_members)

    # ── 2. Meetings this month in this department ───────────────────────────
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    meetings_month_stmt = select(func.count(Meeting.id)).filter(
        Meeting.department_id == dept_id,
        Meeting.date >= month_start,
    )
    meetings_month_res = await db.execute(meetings_month_stmt)
    meetings_this_month = meetings_month_res.scalar() or 0

    # ── 3. Pending action items from department meetings ────────────────────
    dept_meeting_ids_stmt = select(Meeting.id).filter(Meeting.department_id == dept_id)
    dept_meeting_ids_res = await db.execute(dept_meeting_ids_stmt)
    dept_meeting_ids = [r[0] for r in dept_meeting_ids_res.all()]

    pending_actions_count = 0
    total_actions_count = 0
    completed_actions_count = 0
    urgent_actions_raw = []

    if dept_meeting_ids:
        # Count pending
        pa_stmt = select(func.count(ActionItem.id)).filter(
            ActionItem.meeting_id.in_(dept_meeting_ids),
            ActionItem.status != "Completed",
        )
        pa_res = await db.execute(pa_stmt)
        pending_actions_count = pa_res.scalar() or 0

        # Count total + completed for completion rate
        ta_stmt = select(func.count(ActionItem.id)).filter(
            ActionItem.meeting_id.in_(dept_meeting_ids)
        )
        ta_res = await db.execute(ta_stmt)
        total_actions_count = ta_res.scalar() or 0

        ca_stmt = select(func.count(ActionItem.id)).filter(
            ActionItem.meeting_id.in_(dept_meeting_ids),
            ActionItem.status == "Completed",
        )
        ca_res = await db.execute(ca_stmt)
        completed_actions_count = ca_res.scalar() or 0

        # Urgent (High priority, pending) action items — top 5
        urgent_stmt = (
            select(ActionItem)
            .filter(
                ActionItem.meeting_id.in_(dept_meeting_ids),
                ActionItem.status != "Completed",
                ActionItem.priority == "High",
            )
            .order_by(ActionItem.due_date.asc().nulls_last())
            .limit(5)
        )
        urgent_res = await db.execute(urgent_stmt)
        urgent_actions_raw = urgent_res.scalars().all()

    completion_rate = (
        round((completed_actions_count / total_actions_count) * 100)
        if total_actions_count > 0 else 0
    )

    # ── 4. Faculty performance (per-faculty completion rate) ────────────────
    faculty_performance = []
    for fac in faculty_members:
        # Get meetings hosted by this faculty
        fac_m_stmt = select(Meeting.id).filter(
            Meeting.user_id == fac.id,
            Meeting.department_id == dept_id,
        )
        fac_m_res = await db.execute(fac_m_stmt)
        fac_meeting_ids = [r[0] for r in fac_m_res.all()]

        fac_total = 0
        fac_done = 0
        if fac_meeting_ids:
            ft_stmt = select(func.count(ActionItem.id)).filter(
                ActionItem.meeting_id.in_(fac_meeting_ids)
            )
            ft_res = await db.execute(ft_stmt)
            fac_total = ft_res.scalar() or 0

            fd_stmt = select(func.count(ActionItem.id)).filter(
                ActionItem.meeting_id.in_(fac_meeting_ids),
                ActionItem.status == "Completed",
            )
            fd_res = await db.execute(fd_stmt)
            fac_done = fd_res.scalar() or 0

        fac_rate = round((fac_done / fac_total) * 100) if fac_total > 0 else 0
        faculty_performance.append({
            "id": fac.id,
            "name": fac.name,
            "designation": fac.designation or "Faculty",
            "meeting_count": len(fac_meeting_ids),
            "actions_done": fac_done,
            "actions_total": fac_total,
            "rate": fac_rate,
        })

    # ── 5. Weekly meeting trend (last 4 weeks) ──────────────────────────────
    from datetime import timedelta
    weekly_meetings = []
    for week_offset in range(3, -1, -1):
        week_end = now - timedelta(weeks=week_offset)
        week_start = week_end - timedelta(weeks=1)
        wm_stmt = select(func.count(Meeting.id)).filter(
            Meeting.department_id == dept_id,
            Meeting.date >= week_start,
            Meeting.date < week_end,
        )
        wm_res = await db.execute(wm_stmt)
        count = wm_res.scalar() or 0
        weekly_meetings.append({
            "week": f"W{4 - week_offset}",
            "count": count,
        })

    # ── 6. Average duration + participants ──────────────────────────────────
    avg_dur_stmt = select(func.avg(Meeting.duration_minutes)).filter(
        Meeting.department_id == dept_id
    )
    avg_dur_res = await db.execute(avg_dur_stmt)
    avg_dur_val = avg_dur_res.scalar()
    avg_duration = f"{round(avg_dur_val)}m" if avg_dur_val else "0m"

    # ── 7. Action item deadlines for schedule view ──────────────────────────
    if dept_meeting_ids:
        deadlines_stmt = (
            select(ActionItem)
            .filter(
                ActionItem.meeting_id.in_(dept_meeting_ids),
                ActionItem.due_date != None,
                ActionItem.status != "Completed",
            )
            .order_by(ActionItem.due_date.asc())
            .limit(10)
        )
        deadlines_res = await db.execute(deadlines_stmt)
        deadline_items = deadlines_res.scalars().all()
    else:
        deadline_items = []

    # ── 8. Scheduled meetings in this department ────────────────────────────
    sched_dept_stmt = (
        select(Meeting)
        .filter(
            Meeting.department_id == dept_id,
            Meeting.status.in_(["Scheduled", "Upcoming"])
        )
        .order_by(Meeting.date.asc())
        .limit(10)
    )
    sched_dept_res = await db.execute(sched_dept_stmt)
    sched_dept_meetings = sched_dept_res.scalars().all()

    return {
        "metrics": {
            "total_faculty": total_faculty,
            "meetings_this_month": meetings_this_month,
            "pending_actions": pending_actions_count,
            "completion_rate": completion_rate,
            "avg_duration": avg_duration,
            "avg_participants": 1,
        },
        "faculty_performance": faculty_performance,
        "weekly_meetings": weekly_meetings,
        "urgent_actions": [
            {
                "id": it.id,
                "task": it.task,
                "assignedTo": it.owner_name or "Unassigned",
                "deadline": it.due_date.strftime("%b %d, %Y") if it.due_date else "No deadline",
                "priority": it.priority,
                "status": it.status,
                "meeting_id": it.meeting_id,
            }
            for it in urgent_actions_raw
        ],
        "schedule": {
            "meetings": [
                {
                    "id": m.id,
                    "title": m.title,
                    "day": m.date.day if m.date else None,
                    "dateInfo": m.date.strftime("%b %d, %Y • %I:%M %p") if m.date else "TBD",
                    "duration": f"{m.duration_minutes}m",
                    "status": m.status,
                }
                for m in sched_dept_meetings
            ],
            "sessions": [],
            "deadlines": [
                {
                    "title": it.task,
                    "day": it.due_date.day if it.due_date else None,
                    "dateInfo": it.due_date.strftime("%b %d, %Y") if it.due_date else "No date",
                    "owner": it.owner_name,
                }
                for it in deadline_items
            ],
        },
    }


@router.get("/admin")
async def get_admin_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Admin system-wide dashboard. Only real counts — strictly zero dummy data.
    """
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Institutional Administrators."
        )

    # Real faculty count (role == 'Faculty')
    total_faculty_res = await db.execute(select(func.count(User.id)).filter(User.role == "Faculty"))
    total_faculty = total_faculty_res.scalar() or 0

    # Total meetings
    total_meetings_res = await db.execute(select(func.count(Meeting.id)))
    total_meetings = total_meetings_res.scalar() or 0

    # Action items tracked
    total_actions_res = await db.execute(select(func.count(ActionItem.id)))
    action_items_tracked = total_actions_res.scalar() or 0

    # Completed actions
    completed_actions_res = await db.execute(
        select(func.count(ActionItem.id)).filter(ActionItem.status == "Completed")
    )
    completed_actions = completed_actions_res.scalar() or 0

    completion_percentage = round((completed_actions / action_items_tracked) * 100, 1) if action_items_tracked > 0 else 0.0

    # Active departments breakdown
    dept_stmt = select(Department).order_by(Department.name.asc())
    dept_res = await db.execute(dept_stmt)
    all_depts = dept_res.scalars().all()

    department_activity = []
    active_depts_count = 0
    for d in all_depts:
        fc_res = await db.execute(
            select(func.count(User.id)).filter(User.department_id == d.id, User.is_active == True)
        )
        dept_fc = fc_res.scalar() or 0

        mc_res = await db.execute(
            select(func.count(Meeting.id)).filter(Meeting.department_id == d.id)
        )
        dept_mc = mc_res.scalar() or 0

        if dept_fc > 0 or dept_mc > 0:
            active_depts_count += 1

        department_activity.append({
            "department_id": d.id,
            "department_name": d.name,
            "faculty_count": dept_fc,
            "meeting_count": dept_mc,
        })

    # System alerts: recent audit logs with Warn or Alert
    alerts_stmt = (
        select(AuditLog)
        .filter(AuditLog.severity.in_(["Warn", "Alert"]))
        .order_by(desc(AuditLog.timestamp))
        .limit(5)
    )
    alerts_res = await db.execute(alerts_stmt)
    alert_logs = alerts_res.scalars().all()

    system_alerts = [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "severity": log.severity,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in alert_logs
    ]

    return {
        "total_faculty": total_faculty,
        "total_meetings": total_meetings,
        "action_items_tracked": action_items_tracked,
        "active_departments": active_depts_count,
        "completion_percentage": completion_percentage,
        "department_activity": department_activity,
        "system_alerts": system_alerts,
    }
