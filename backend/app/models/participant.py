from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    speaker_label = Column(String(50), nullable=True)  # e.g., 'Speaker A', 'Speaker B'
    attended = Column(Boolean, default=False, nullable=False)
    joined_at = Column(DateTime, nullable=True)
    speaking_time_seconds = Column(Integer, default=0, nullable=False)
    invitation_status = Column(String(50), default="Pending", nullable=False)  # Pending, Sent, Accepted, Declined, Failed
    invitation_sent_at = Column(DateTime, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
