from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timezone
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.action_item import ActionItem

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

    return {
        "metrics": {
            "total_meetings": total_meetings,
            "pending_action_items": pending_actions,
            "upcoming_deadlines_count": upcoming_deadlines,
            "upcoming_sessions_count": 0,
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
        "upcoming_events": [],
    }
