from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend_v2.app.core.database import Base

class MinutesOfMeeting(Base):
    __tablename__ = "minutes_of_meeting"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), unique=True, nullable=False)
    summary = Column(Text, nullable=True)
    decisions = Column(JSON, default=list)  # List of strings
    agenda_topics = Column(JSON, default=list)  # List of {topic, notes}
    is_finalized = Column(Boolean, default=False)
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    meeting = relationship("Meeting", back_populates="mom")
