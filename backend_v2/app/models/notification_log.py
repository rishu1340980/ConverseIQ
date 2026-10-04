from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime, timezone
from backend_v2.app.core.database import Base

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String(255), nullable=False)
    recipient_name = Column(String(150), nullable=True)
    subject = Column(String(255), nullable=False)
    notification_type = Column(String(50), nullable=False)  # Event_Invitation, HOD_Task_Assignment, Deadline_Reminder
    status = Column(String(50), default="Delivered")  # Delivered, Simulated, Failed
    event_id = Column(Integer, ForeignKey("schedule_events.id"), nullable=True)
    action_item_id = Column(Integer, ForeignKey("action_items.id"), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
