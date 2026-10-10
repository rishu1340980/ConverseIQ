from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend_v2.app.core.config import settings
from backend_v2.app.core.database import engine, Base
from backend_v2.app.models import (
    Department, User, Meeting, ActionItem, MinutesOfMeeting, Utterance, MeetingParticipant,
    AuditLog, SystemSetting
)
import asyncio
from sqlalchemy import text
from backend_v2.app.routers import auth, dashboard, action_items, meetings, mom, users, departments, ai, admin, reports, schedule
from backend_v2.app.services.reminder_scheduler import reminder_scheduler_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Verify and add columns dynamically for SQLite
        cols = [
            ("meetings", "processing_status", "VARCHAR(50) DEFAULT 'COMPLETED'"),
            ("meetings", "recording_path", "VARCHAR(500)"),
            ("meetings", "recording_duration_seconds", "INTEGER DEFAULT 0"),
            ("meetings", "error_message", "TEXT"),
            ("meetings", "jitsi_room", "VARCHAR(255)"),
            ("action_items", "academic_year", "VARCHAR(50)"),
            ("action_items", "department_id", "INTEGER"),
            ("action_items", "assigned_by_id", "INTEGER"),
            ("action_items", "assigned_by_name", "VARCHAR(150)"),
            ("action_items", "assigned_by_role", "VARCHAR(50)"),
            ("action_items", "owner_email", "VARCHAR(255)"),
            ("action_items", "reminder_sent", "INTEGER DEFAULT 0"),
            ("action_items", "reminder_sent_at", "DATETIME"),
            ("schedule_events", "reminder_24h_sent", "BOOLEAN DEFAULT 0"),
            ("schedule_events", "reminder_4h_sent", "BOOLEAN DEFAULT 0"),
            ("users", "failed_login_attempts", "INTEGER DEFAULT 0"),
            ("users", "locked_until", "DATETIME"),
            ("users", "token_version", "INTEGER DEFAULT 1"),
        ]
        for tbl, col, col_t in cols:
            try:
                await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_t};"))
            except Exception:
                pass

    # Automatically seed initial departments and users if table is fresh
    try:
        from backend_v2.seed import seed
        await seed()
    except Exception as e:
        print(f"Seed startup notice: {e}")

    # Start automated background reminder scheduler worker (runs every 5 mins)
    scheduler_task = asyncio.create_task(reminder_scheduler_loop(interval_seconds=300))

    yield

    # Clean shutdown of scheduler task
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass

    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(action_items.router, prefix=settings.API_V1_STR)
app.include_router(meetings.router, prefix=settings.API_V1_STR)
app.include_router(mom.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(departments.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(schedule.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    return {"status": "healthy", "service": "converseiq-backend-v2"}
