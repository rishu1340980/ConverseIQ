from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend_v2.app.core.database import Base

class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Academic metadata
    academic_year = Column(String(50), nullable=False, default="3rd Year")  # e.g., 1st Year, 2nd Year, 3rd Year, 4th Year, M.Tech/PG, All Years
    target_batch = Column(String(100), nullable=True)  # e.g., "Batch A & B", "CSE-301", "Final Year IT"
    domain = Column(String(100), nullable=False, default="General")  # e.g., AI & Machine Learning, Cloud & DevOps, Cyber Security, etc.
    event_type = Column(String(50), nullable=False, default="Lecture")  # Lecture, Workshop, Lab Session, Project Review, Department Meeting, Seminar
    delivery_mode = Column(String(20), nullable=False, default="Offline")  # Online, Offline, Hybrid
    venue_or_link = Column(String(255), nullable=True)
    
    # Timing
    start_time = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=60)
    
    # Faculty in charge / Organizer
    faculty_name = Column(String(150), nullable=False)
    faculty_email = Column(String(255), nullable=False)
    
    # Assignment & Delegation
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_role = Column(String(50), default="Faculty")  # HOD, Faculty, Admin
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # Reminder & Notifications
    reminder_sent = Column(Integer, default=0)
    reminder_sent_at = Column(DateTime, nullable=True)
    reminder_24h_sent = Column(Boolean, default=False)
    reminder_4h_sent = Column(Boolean, default=False)
    status = Column(String(50), default="Scheduled")  # Scheduled, In Progress, Completed, Cancelled
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    creator = relationship("User", foreign_keys=[created_by_id])
    department = relationship("Department")
