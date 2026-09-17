from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class MinutesOfMeeting(Base):
    __tablename__ = "minutes_of_meeting"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)
    summary = Column(Text, nullable=False)
    decisions = Column(JSON, default=list, nullable=False)  # List of decision strings
    topics_discussed = Column(JSON, default=list, nullable=False)  # List of dicts: {"topic": str, "points": []}
    raw_transcript = Column(Text, nullable=True)
    utterances = Column(JSON, default=list, nullable=True)
    is_finalized = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    meeting = relationship("Meeting", back_populates="mom")
