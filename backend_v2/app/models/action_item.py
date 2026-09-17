from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend_v2.app.core.database import Base

class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True, index=True)
    task = Column(Text, nullable=False)
    owner_name = Column(String(100), default="Assigned Faculty")
    priority = Column(String(20), default="Medium")  # High, Medium, Low
    status = Column(String(20), default="Pending")    # Pending, In Progress, Completed
    due_date = Column(DateTime, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    meeting = relationship("Meeting", back_populates="action_items")
