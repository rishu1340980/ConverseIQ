import pytest
import pytest_asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from backend_v2.app.main import app
from backend_v2.app.core.database import Base, get_db
from backend_v2.app.models import (
    Department, User, Meeting, ActionItem, MinutesOfMeeting, Utterance, MeetingParticipant
)
from backend_v2.app.core.security import get_password_hash

TEST_DB_FILE = "./test_isolated_suite.db"
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        dept_cs = Department(id=1, name="Computer Science", code="CS")
        dept_ece = Department(id=2, name="Electronics & Communication", code="ECE")
        session.add_all([dept_cs, dept_ece])
        await session.flush()

        faculty_pwd = get_password_hash("Faculty@123")
        hod_pwd = get_password_hash("Hod@123")
        admin_pwd = get_password_hash("Admin@123")

        u1 = User(
            id=1,
            email="prof.sharma@converseiq.edu",
            hashed_password=faculty_pwd,
            name="Prof. Sharma",
            role="Faculty",
            department_id=1,
            designation="Assistant Professor",
            phone="+91 98765 43210",
            is_active=True
        )
        u2 = User(
            id=2,
            email="hod.cs@converseiq.edu",
            hashed_password=hod_pwd,
            name="Dr. Mehta",
            role="HOD",
            department_id=1,
            designation="Professor & HOD",
            phone="+91 98765 43211",
            is_active=True
        )
        u3 = User(
            id=3,
            email="admin@converseiq.edu",
            hashed_password=admin_pwd,
            name="Admin User",
            role="Admin",
            department_id=None,
            designation="System Administrator",
            phone="+91 98765 43212",
            is_active=True
        )
        session.add_all([u1, u2, u3])
        await session.commit()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    await test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

