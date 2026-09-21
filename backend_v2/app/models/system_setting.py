from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend_v2.app.core.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    institution_name = Column(String(200), nullable=False, default="National Institute of Engineering & Technology")
    ai_model = Column(String(100), nullable=False, default="meta-llama/llama-3.3-70b-instruct")
    retention_days = Column(Integer, nullable=False, default=180)
    enable_email_alerts = Column(Boolean, nullable=False, default=True)
    enable_auto_transcription = Column(Boolean, nullable=False, default=True)
    enable_2fa = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_id])
