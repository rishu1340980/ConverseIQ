from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend_v2.app.core.database import Base

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    duration_minutes = Column(Integer, default=45)
    status = Column(String(50), default="Analysis Complete")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    department = relationship("Department")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")
    mom = relationship("MinutesOfMeeting", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    utterances = relationship("Utterance", back_populates="meeting", cascade="all, delete-orphan")
    participants = relationship("MeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")
