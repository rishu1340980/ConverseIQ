from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend_v2.app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_name = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    details = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="Info", index=True)  # Info, OK, Warn, Alert
    ip_address = Column(String(50), nullable=True)
    resource_type = Column(String(50), nullable=True)  # user, meeting, settings, auth
    resource_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])
