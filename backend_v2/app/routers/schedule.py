import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import extract, and_, or_
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import datetime, timezone, timedelta
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.schedule_event import ScheduleEvent
from backend_v2.app.models.notification_log import NotificationLog
from backend_v2.app.services.email_service import send_event_invitation, format_ist_datetime
from backend_v2.app.services.audit import log_audit_event

router = APIRouter(prefix="/schedule", tags=["Schedule"])

ACADEMIC_YEARS = [
    "1st Year (B.Tech)",
    "2nd Year (B.Tech)",
    "3rd Year (B.Tech)",
    "4th Year (B.Tech)",
    "M.Tech / Research",
    "All Academic Years",
]

DOMAINS = [
    "AI & Machine Learning",
    "Cloud & DevOps",
    "Cyber Security",
    "Full Stack Web Development",
    "Data Science & Analytics",
    "Core Systems & IoT",
    "Mobile App Development",
    "Departmental & Administrative",
]

EVENT_TYPES = [
    "Lecture",
    "Workshop",
    "Lab Session",
    "Project Review",
    "Department Meeting",
    "Guest Seminar",
    "Exam / Viva",
]

class CreateEventRequest(BaseModel):
    title: str
    description: Optional[str] = None
    academic_year: str = "3rd Year (B.Tech)"
    target_batch: Optional[str] = None
    domain: str = "AI & Machine Learning"
    event_type: Optional[str] = "Lecture"
    delivery_mode: Optional[str] = "Offline"  # Online, Offline, Hybrid
    venue_or_link: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = 60
    faculty_name: Optional[str] = None
    faculty_email: Optional[str] = None
    send_email_invitation: Optional[bool] = True

class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    academic_year: Optional[str] = None
    target_batch: Optional[str] = None
    domain: Optional[str] = None
    event_type: Optional[str] = None
    delivery_mode: Optional[str] = None
    venue_or_link: Optional[str] = None
    start_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    faculty_name: Optional[str] = None
    faculty_email: Optional[str] = None
    status: Optional[str] = None

def format_event_response(e: ScheduleEvent) -> dict:
    return {
        "id": e.id,
        "title": e.title,
        "description": e.description or "",
        "academic_year": e.academic_year,
        "target_batch": e.target_batch or "All Department Students",
        "domain": e.domain,
        "event_type": e.event_type,
        "delivery_mode": e.delivery_mode,
        "venue_or_link": e.venue_or_link or ("Online Studio" if e.delivery_mode == "Online" else "Campus Hall"),
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "date_formatted": format_ist_datetime(e.start_time),
        "duration_minutes": e.duration_minutes or 60,
        "faculty_name": e.faculty_name,
        "faculty_email": e.faculty_email,
        "created_by_role": e.created_by_role or "Faculty",
        "created_by_id": e.created_by_id,
        "reminder_sent": e.reminder_sent > 0,
        "reminder_sent_count": e.reminder_sent,
        "reminder_sent_at": e.reminder_sent_at.isoformat() if e.reminder_sent_at else None,
        "status": e.status or "Scheduled",
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }

@router.get("/domains-and-years")
async def get_domains_and_years():
    return {
        "academic_years": ACADEMIC_YEARS,
        "domains": DOMAINS,
        "event_types": EVENT_TYPES,
        "delivery_modes": ["Offline", "Online", "Hybrid"],
    }

@router.get("/events")
async def list_schedule_events(
    academic_year: Optional[str] = None,
    domain: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    faculty_email: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ScheduleEvent)

    # Department filter
    if current_user.department_id:
        stmt = stmt.filter(
            or_(
                ScheduleEvent.department_id == current_user.department_id,
                ScheduleEvent.department_id.is_(None)
            )
        )

    if academic_year and academic_year != "All" and academic_year != "All Academic Years":
        stmt = stmt.filter(ScheduleEvent.academic_year == academic_year)

    if domain and domain != "All":
        stmt = stmt.filter(ScheduleEvent.domain == domain)

    if faculty_email:
        stmt = stmt.filter(ScheduleEvent.faculty_email.ilike(f"%{faculty_email.strip()}%"))

    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.filter(
            or_(
                ScheduleEvent.title.ilike(s),
                ScheduleEvent.faculty_name.ilike(s),
                ScheduleEvent.description.ilike(s),
                ScheduleEvent.target_batch.ilike(s),
            )
        )

    if month and year:
        stmt = stmt.filter(
            extract("month", ScheduleEvent.start_time) == month,
            extract("year", ScheduleEvent.start_time) == year
        )
    elif year:
        stmt = stmt.filter(extract("year", ScheduleEvent.start_time) == year)

    stmt = stmt.order_by(ScheduleEvent.start_time.asc())
    result = await db.execute(stmt)
    events = result.scalars().all()
    return [format_event_response(e) for e in events]

@router.post("/events", status_code=status.HTTP_201_CREATED)
async def create_schedule_event(
    payload: CreateEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Auto-generate virtual Jitsi link if online and none provided
    venue_or_link = payload.venue_or_link
    if payload.delivery_mode == "Online" and (not venue_or_link or not venue_or_link.strip()):
        clean_title = "".join(c for c in payload.title if c.isalnum())[:16]
        venue_or_link = f"https://meet.jit.si/ConverseIQ-{clean_title}-{int(datetime.now().timestamp())}"

    assigned_faculty_name = payload.faculty_name or current_user.name
    assigned_faculty_email = payload.faculty_email or current_user.email

    event = ScheduleEvent(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        academic_year=payload.academic_year,
        target_batch=payload.target_batch.strip() if payload.target_batch else None,
        domain=payload.domain,
        event_type=payload.event_type or "Lecture",
        delivery_mode=payload.delivery_mode or "Offline",
        venue_or_link=venue_or_link,
        start_time=payload.start_time,
        end_time=payload.end_time or (payload.start_time + timedelta(minutes=payload.duration_minutes or 60)),
        duration_minutes=payload.duration_minutes or 60,
        faculty_name=assigned_faculty_name,
        faculty_email=assigned_faculty_email,
        created_by_id=current_user.id,
        created_by_role=current_user.role or "Faculty",
        department_id=current_user.department_id,
        status="Scheduled",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Dispatch email if requested or if assigned by HOD
    email_result = None
    if payload.send_email_invitation or current_user.role == "HOD":
        email_result = await send_event_invitation(event, db)
        event.reminder_sent = 1
        event.reminder_sent_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(event)

    await log_audit_event(
        db=db,
        user_id=current_user.id,
        action="Schedule Event Created",
        details=f"Created '{event.title}' for {event.academic_year} ({event.domain}) - Assigned to {event.faculty_name}"
    )

    return {
        "status": "success",
        "message": "Academic session event scheduled successfully",
        "event": format_event_response(event),
        "email_dispatch": email_result,
    }

@router.post("/events/{event_id}/send-reminder")
async def send_event_reminder(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ScheduleEvent).filter(ScheduleEvent.id == event_id)
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Authorize: HOD of dept, creator, or admin
    if current_user.role not in ("HOD", "Admin") and event.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only HOD or the organizer can dispatch reminders.")

    email_result = await send_event_invitation(event, db)
    event.reminder_sent = (event.reminder_sent or 0) + 1
    event.reminder_sent_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "status": "success",
        "message": f"Email reminder successfully sent to {event.faculty_name} ({event.faculty_email})",
        "delivery": email_result,
        "reminder_sent_count": event.reminder_sent,
        "reminder_sent_at": event.reminder_sent_at.isoformat(),
    }

@router.delete("/events/{event_id}", status_code=status.HTTP_200_OK)
async def delete_schedule_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ScheduleEvent).filter(ScheduleEvent.id == event_id)
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if current_user.role not in ("HOD", "Admin") and event.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to cancel this event.")

    await db.delete(event)
    await db.commit()
    return {"status": "success", "message": "Event cancelled and removed from calendar."}
