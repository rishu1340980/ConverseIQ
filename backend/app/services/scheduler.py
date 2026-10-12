import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.meeting import Meeting
from app.models.action_item import ActionItem
from app.models.user import User
from app.services.email_service import email_service

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
    3-Tier Multi-Stage Deadline Alert Daemon:
    1. Tier 1 (T-24h): 24 hours before deadline reminder
    2. Tier 2 (Day-Of): Urgent day-of deadline reminder (<= 6h)
    3. Tier 3 (Overdue): Escalation notification if deadline expired & task still Pending
    """
    now = datetime.now(timezone.utc)
    in_24h = now + timedelta(hours=24)
    in_6h = now + timedelta(hours=6)

    # 1. Upcoming meetings reminder (within 24 hours)
    m_stmt = select(Meeting).where(Meeting.date >= now, Meeting.date <= in_24h)
    m_res = await db.execute(m_stmt)
    upcoming_meetings = m_res.scalars().all()

    for m in upcoming_meetings:
        notification_service.push_in_app_notification(
            user_id=m.created_by_id,
            title="Upcoming Meeting Reminder",
            message=f"Meeting '{m.title}' is scheduled for {m.date.strftime('%I:%M %p')}.",
            severity="Info"
        )

    # 2. Fetch all pending action items with relationships
    a_stmt = (
        select(ActionItem)
        .options(selectinload(ActionItem.meeting), selectinload(ActionItem.owner_user))
        .where(ActionItem.status == "Pending", ActionItem.due_date.isnot(None))
    )
    a_res = await db.execute(a_stmt)
    pending_items = a_res.scalars().all()

    stats = {
        "upcoming_24h_reminders": 0,
        "due_today_reminders": 0,
        "overdue_alerts": 0
    }

    for item in pending_items:
        due = item.due_date
        # Ensure due is timezone-aware
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)

        due_str = due.strftime("%b %d, %Y at %I:%M %p")
        owner_email = item.owner_user.email if item.owner_user else None
        owner_name = item.owner_name or (item.owner_user.name if item.owner_user else "Faculty Member")
        meeting_title = item.meeting.title if item.meeting else "Academic Session"

        if not owner_email and owner_name:
            from app.services.email_service import resolve_faculty_email
            owner_email = resolve_faculty_email(owner_name)

        # Tier 3: Overdue Escalation (Due date passed)
        if due < now:
            if not getattr(item, "alert_overdue_sent", False):
                if item.owner_id:
                    notification_service.push_in_app_notification(
                        user_id=item.owner_id,
                        title="OVERDUE: Action Item Deadline Passed",
                        message=f"Action item '{item.task}' was due on {due_str}. Please finalize immediately.",
                        severity="Error"
                    )
                if owner_email:
                    email_service.send_deadline_alert(
                        to_email=owner_email,
                        faculty_name=owner_name,
                        task=item.task,
                        meeting_title=meeting_title,
                        due_date_str=due_str,
                        tier="OVERDUE"
                    )
                item.alert_overdue_sent = True
                stats["overdue_alerts"] += 1

        # Tier 2: Day-Of Deadline Reminder (<= 6 hours remaining)
        elif due <= in_6h:
            if not getattr(item, "alert_due_day_sent", False):
                if item.owner_id:
                    notification_service.push_in_app_notification(
                        user_id=item.owner_id,
                        title="URGENT: Action Item Due Today",
                        message=f"Action item '{item.task}' is due today ({due_str}).",
                        severity="Warn"
                    )
                if owner_email:
                    email_service.send_deadline_alert(
                        to_email=owner_email,
                        faculty_name=owner_name,
                        task=item.task,
                        meeting_title=meeting_title,
                        due_date_str=due_str,
                        tier="DAY_OF"
                    )
                item.alert_due_day_sent = True
                stats["due_today_reminders"] += 1

        # Tier 1: 24-Hour Advance Reminder (<= 24 hours remaining)
        elif due <= in_24h:
            if not getattr(item, "alert_before_sent", False):
                if item.owner_id:
                    notification_service.push_in_app_notification(
                        user_id=item.owner_id,
                        title="24h Reminder: Action Item Due Soon",
                        message=f"Action item '{item.task}' is due in 24 hours on {due_str}.",
                        severity="Info"
                    )
                if owner_email:
                    email_service.send_deadline_alert(
                        to_email=owner_email,
                        faculty_name=owner_name,
                        task=item.task,
                        meeting_title=meeting_title,
                        due_date_str=due_str,
                        tier="T-24H"
                    )
                item.alert_before_sent = True
                stats["upcoming_24h_reminders"] += 1

    await db.commit()
    return stats
