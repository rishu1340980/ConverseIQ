from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend_v2.app.core.database import Base

class Utterance(Base):
    __tablename__ = "utterances"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    speaker_label = Column(String(50), default="Speaker A")
    speaker_name = Column(String(100), default="Auto-Identified Faculty")
    timestamp = Column(String(20), default="00:00")
    language = Column(String(20), default="English")  # English, Hindi, Hinglish
    text = Column(Text, nullable=False)
    english_translation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    meeting = relationship("Meeting", back_populates="utterances")
