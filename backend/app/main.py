import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.department import Department
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.models.audit_log import AuditLog

# Import API routers
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.mom import router as mom_router
from app.api.v1.action_items import router as action_items_router
from app.api.v1.export import router as export_router
from app.api.v1.ai_assistant import router as ai_router
from app.api.v1.departments import router as departments_router
from app.api.v1.users import router as users_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.audit import router as audit_router

async def seed_initial_data():
    """Seeds default accounts, departments, and meetings for demo and testing idempotently."""
    async with AsyncSessionLocal() as session:
        # 1. Departments
        cs_res = await session.execute(select(Department).where(Department.name == "Computer Science & Engineering"))
        cs_dept = cs_res.scalar_one_or_none()
        if not cs_dept:
            cs_dept = Department(name="Computer Science & Engineering")
            session.add(cs_dept)
            await session.commit()
            await session.refresh(cs_dept)

        ece_res = await session.execute(select(Department).where(Department.name == "Electronics & Communication"))
        ece_dept = ece_res.scalar_one_or_none()
        if not ece_dept:
            ece_dept = Department(name="Electronics & Communication")
            session.add(ece_dept)
            await session.commit()
            await session.refresh(ece_dept)

        # 2. Users (Admin, HOD, Faculty)
        admin_res = await session.execute(select(User).where(User.email == "admin@converseiq.edu"))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                name="System Administrator",
                email="admin@converseiq.edu",
                hashed_password=get_password_hash("Admin@123"),
                role="Admin",
                is_active=True
            )
            session.add(admin_user)

        hod_res = await session.execute(select(User).where(User.email == "hod.cs@converseiq.edu"))
        hod_user = hod_res.scalar_one_or_none()
        if not hod_user:
            hod_user = User(
                name="Dr. Rajesh Gupta",
                email="hod.cs@converseiq.edu",
                hashed_password=get_password_hash("Hod@123"),
                role="HOD",
                department_id=cs_dept.id,
                is_active=True
            )
            session.add(hod_user)

        sharma_res = await session.execute(select(User).where(User.email == "prof.sharma@converseiq.edu"))
        faculty_sharma = sharma_res.scalar_one_or_none()
        if not faculty_sharma:
            faculty_sharma = User(
                name="Prof. Sharma",
                email="prof.sharma@converseiq.edu",
                hashed_password=get_password_hash("Faculty@123"),
                role="Faculty",
                department_id=cs_dept.id,
                is_active=True
            )
            session.add(faculty_sharma)

        mishra_res = await session.execute(select(User).where(User.email == "prof.mishra@converseiq.edu"))
        faculty_mishra = mishra_res.scalar_one_or_none()
        if not faculty_mishra:
            faculty_mishra = User(
                name="Prof. Mishra",
                email="prof.mishra@converseiq.edu",
                hashed_password=get_password_hash("Faculty@123"),
                role="Faculty",
                department_id=cs_dept.id,
                is_active=True
            )
            session.add(faculty_mishra)

        await session.commit()
        if admin_user:
            await session.refresh(admin_user)
        if hod_user:
            await session.refresh(hod_user)
            if not cs_dept.hod_id:
                cs_dept.hod_id = hod_user.id
                await session.commit()
        if faculty_sharma:
            await session.refresh(faculty_sharma)
        if faculty_mishra:
            await session.refresh(faculty_mishra)

        # 3. Seed Meeting
        meeting_res = await session.execute(select(Meeting).where(Meeting.title == "Curriculum & NAAC Review Committee"))
        meeting1 = meeting_res.scalar_one_or_none()
        if not meeting1 and faculty_sharma:
            meeting1 = Meeting(
                title="Curriculum & NAAC Review Committee",
                date=datetime.now(timezone.utc) - timedelta(days=1),
                duration_minutes=45,
                status="Completed",
                created_by_id=faculty_sharma.id,
                department_id=cs_dept.id
            )
            session.add(meeting1)
            await session.commit()
            await session.refresh(meeting1)

            # Attendees
            p1 = Participant(meeting_id=meeting1.id, name="Prof. Sharma", email="prof.sharma@converseiq.edu", speaker_label="Speaker A")
            p2 = Participant(meeting_id=meeting1.id, name="Prof. Mishra", email="prof.mishra@converseiq.edu", speaker_label="Speaker B")
            p3 = Participant(meeting_id=meeting1.id, name="Dr. Anita Rao", email="anita.rao@converseiq.edu", speaker_label="Speaker C")
            session.add_all([p1, p2, p3])

            # MoM
            mom1 = MinutesOfMeeting(
                meeting_id=meeting1.id,
                summary="The committee reviewed NAAC Criteria 3 metrics and approved the updated lab scheduling for mid-term assessments.",
                decisions=[
                    "Approved additional lab hours for Distributed Systems midterm.",
                    "Mandated journal publication verification by end of current week."
                ],
                topics_discussed=[
                    {"topic": "Midterm Lab Schedule", "points": ["Allocated Room 302 and 304 on Thursday afternoons."]},
                    {"topic": "NAAC Documentation", "points": ["Scrutiny of faculty publication files."]}
                ],
                is_finalized=True
            )
            session.add(mom1)

            # Action Items
            act1 = ActionItem(
                meeting_id=meeting1.id,
                task="Draft revised lab schedule for Computer Science midterm examinations",
                owner_name="Prof. Mishra",
                owner_id=faculty_mishra.id if faculty_mishra else None,
                priority="High",
                status="Pending",
                due_date=datetime.now(timezone.utc) + timedelta(days=2)
            )
            act2 = ActionItem(
                meeting_id=meeting1.id,
                task="Collect faculty research publication verification documents for NAAC",
                owner_name="Dr. Anita Rao",
                priority="High",
                status="Pending",
                due_date=datetime.now(timezone.utc) + timedelta(days=4)
            )
            act3 = ActionItem(
                meeting_id=meeting1.id,
                task="Notify academic cell regarding examination room allocations",
                owner_name="Prof. Sharma",
                owner_id=faculty_sharma.id,
                priority="Medium",
                status="Completed",
                due_date=datetime.now(timezone.utc) - timedelta(days=1)
            )
            session.add_all([act1, act2, act3])

            # Audit entry
            audit = AuditLog(
                action="System Seeded",
                details="Initial institutional demo data successfully populated.",
                severity="OK",
                user_id=admin_user.id if admin_user else None
            )
            session.add(audit)
            await session.commit()
            print("ConverseIQ database seeded successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await seed_initial_data()
    yield
    # Shutdown

app = FastAPI(
    title="ConverseIQ API",
    description="Academic Meeting Intelligence Platform - Phase 2 Production System",
    version=settings.VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory for static audio playback
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers
v1 = settings.API_V1_STR
app.include_router(auth_router, prefix=v1)
app.include_router(dashboard_router, prefix=v1)
app.include_router(meetings_router, prefix=v1)
app.include_router(mom_router, prefix=v1)
app.include_router(action_items_router, prefix=v1)
app.include_router(export_router, prefix=v1)
app.include_router(ai_router, prefix=v1)
app.include_router(departments_router, prefix=v1)
app.include_router(users_router, prefix=v1)
app.include_router(analytics_router, prefix=v1)
app.include_router(audit_router, prefix=v1)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
