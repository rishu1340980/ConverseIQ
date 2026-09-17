import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.meeting import Meeting
from app.models.action_item import ActionItem

class NotificationService:
    def __init__(self):
        self.in_app_notifications: Dict[int, List[Dict[str, Any]]] = {}

    def push_in_app_notification(self, user_id: int, title: str, message: str, severity: str = "Info"):
        if user_id not in self.in_app_notifications:
            self.in_app_notifications[user_id] = []
        self.in_app_notifications[user_id].append({
            "title": title,
            "message": message,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False
        })

    def get_user_notifications(self, user_id: int) -> List[Dict[str, Any]]:
        return self.in_app_notifications.get(user_id, [])

notification_service = NotificationService()

async def check_and_dispatch_reminders(db: AsyncSession):
    """
    Checks upcoming meetings and action item deadlines within the next 24 hours
    and dispatches automated reminder notifications.
    """
    now = datetime.now(timezone.utc)
    next_24h = now + timedelta(hours=24)

    # 1. Upcoming meetings reminder
    m_stmt = select(Meeting).where(Meeting.date >= now, Meeting.date <= next_24h)
    m_res = await db.execute(m_stmt)
    upcoming_meetings = m_res.scalars().all()

    for m in upcoming_meetings:
        notification_service.push_in_app_notification(
            user_id=m.created_by_id,
            title="Upcoming Meeting Reminder",
            message=f"Meeting '{m.title}' is scheduled for {m.date.strftime('%I:%M %p')}.",
            severity="Info"
        )

    # 2. Upcoming action item deadlines
    a_stmt = select(ActionItem).where(
        ActionItem.status == "Pending",
        ActionItem.due_date >= now,
        ActionItem.due_date <= next_24h,
        ActionItem.owner_id.isnot(None)
    )
    a_res = await db.execute(a_stmt)
    impending_actions = a_res.scalars().all()

    for item in impending_actions:
        if item.owner_id:
            notification_service.push_in_app_notification(
                user_id=item.owner_id,
                title="Action Item Due Soon",
                message=f"Action item '{item.task}' is due in less than 24 hours.",
                severity="Warn"
            )
