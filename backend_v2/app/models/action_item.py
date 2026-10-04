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
    academic_year = Column(String(50), nullable=True)  # 1st Year, 2nd Year, 3rd Year, 4th Year, M.Tech/PG
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_by_name = Column(String(100), nullable=True)
    assigned_by_role = Column(String(50), default="HOD")
    reminder_sent = Column(Integer, default=0)
    reminder_sent_at = Column(DateTime, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    department = relationship("Department")
    meeting = relationship("Meeting", back_populates="action_items")
