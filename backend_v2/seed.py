import asyncio
import os
import json
from datetime import datetime, timezone
from sqlalchemy.future import select
from backend_v2.app.core.database import engine, AsyncSessionLocal, Base
from backend_v2.app.core.security import get_password_hash
from backend_v2.app.models import (
    Department, User, Meeting, ActionItem, MinutesOfMeeting, Utterance, MeetingParticipant
)

async def seed():
    print("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Seed Departments
        dept_names = [
            {"name": "Computer Science", "code": "CS"},
            {"name": "Information Technology", "code": "IT"},
            {"name": "Electronics & Communication", "code": "ECE"},
            {"name": "Civil Engineering", "code": "CIVIL"},
            {"name": "Mechanical Engineering", "code": "MECH"},
        ]

        departments_map = {}
        for d in dept_names:
            stmt = select(Department).filter(Department.code == d["code"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                new_dept = Department(name=d["name"], code=d["code"])
                session.add(new_dept)
                await session.flush()
                departments_map[d["code"]] = new_dept
                print(f"Created department: {d['name']}")
            else:
                departments_map[d["code"]] = existing

        # 2. Seed Users
        users_to_seed = [
            {
                "name": "Prof. Sharma",
                "email": "prof.sharma@converseiq.edu",
                "password": "Faculty@123",
                "role": "Faculty",
                "dept_code": "CS",
                "designation": "Assistant Professor",
                "phone": "+91 98765 43210"
            },
            {
                "name": "Prof. Mehta",
                "email": "hod.cs@converseiq.edu",
                "password": "Hod@123",
                "role": "HOD",
                "dept_code": "CS",
                "designation": "Head of Department & Professor",
                "phone": "+91 98765 43211"
            },
            {
                "name": "Admin User",
                "email": "admin@converseiq.edu",
                "password": "Admin@123",
                "role": "Admin",
                "dept_code": "CS",
                "designation": "System Administrator",
                "phone": "+91 98765 43212"
            },
            {
                "name": "Dr. Priya Kapoor",
                "email": "priya.kapoor@converseiq.edu",
                "password": "Faculty@123",
                "role": "Faculty",
                "dept_code": "CS",
                "designation": "Assistant Professor",
                "phone": "+91 98765 43213"
            },
            {
                "name": "Prof. Kavya Rao",
                "email": "kavya.rao@converseiq.edu",
                "password": "Faculty@123",
                "role": "Faculty",
                "dept_code": "CS",
                "designation": "Associate Professor",
                "phone": "+91 98765 43214"
            },
            {
                "name": "Dr. Amit Joshi",
                "email": "amit.joshi@converseiq.edu",
                "password": "Faculty@123",
                "role": "Faculty",
                "dept_code": "CS",
                "designation": "Assistant Professor",
                "phone": "+91 98765 43215"
            },
            {
                "name": "Prof. Rahul Verma",
                "email": "rahul.verma@converseiq.edu",
                "password": "Faculty@123",
                "role": "Faculty",
                "dept_code": "CS",
                "designation": "Professor",
                "phone": "+91 98765 43216"
            },
        ]

        for u in users_to_seed:
            stmt = select(User).filter(User.email == u["email"])
            res = await session.execute(stmt)
            existing_user = res.scalar_one_or_none()
            if not existing_user:
                dept = departments_map.get(u["dept_code"])
                new_user = User(
                    name=u["name"],
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                    department_id=dept.id if dept else None,
                    designation=u["designation"],
                    phone=u["phone"],
                    is_active=True,
                )
                session.add(new_user)
                print(f"Created user: {u['name']} ({u['role']}) - {u['email']}")

        # 3. Seed Past / Historical Meetings (if not already present)
        json_path = os.path.join(os.path.dirname(__file__), "app", "core", "initial_meetings.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                initial_meetings = json.load(f)

            prof_stmt = select(User).filter(User.email == "prof.sharma@converseiq.edu")
            prof_res = await session.execute(prof_stmt)
            default_host = prof_res.scalar_one_or_none()
            cs_dept = departments_map.get("CS")

            for m_data in initial_meetings:
                m_stmt = select(Meeting).filter(Meeting.title == m_data["title"])
                m_res = await session.execute(m_stmt)
                if not m_res.scalar_one_or_none():
                    try:
                        dt = datetime.fromisoformat(m_data["date"]) if m_data.get("date") else datetime.now(timezone.utc)
                    except Exception:
                        dt = datetime.now(timezone.utc)

                    new_meeting = Meeting(
                        title=m_data["title"],
                        date=dt,
                        duration_minutes=m_data.get("duration_minutes", 45),
                        status=m_data.get("status", "Completed"),
                        user_id=default_host.id if default_host else 1,
                        department_id=cs_dept.id if cs_dept else None,
                    )
                    session.add(new_meeting)
                    await session.flush()

                    for p in m_data.get("participants", []):
                        part = MeetingParticipant(
                            meeting_id=new_meeting.id,
                            name=p.get("name", "Speaker"),
                            speaker_label=p.get("speaker_label", "Speaker"),
                        )
                        session.add(part)

                    if m_data.get("mom"):
                        mom_d = m_data["mom"]
                        mom = MinutesOfMeeting(
                            meeting_id=new_meeting.id,
                            summary=mom_d.get("summary", ""),
                            decisions=mom_d.get("decisions", []),
                            agenda_topics=mom_d.get("agenda_topics", []),
                            is_finalized=mom_d.get("is_finalized", True),
                        )
                        session.add(mom)

                    for it in m_data.get("action_items", []):
                        try:
                            due = datetime.fromisoformat(it["due_date"]) if it.get("due_date") else None
                        except Exception:
                            due = None
                        action = ActionItem(
                            meeting_id=new_meeting.id,
                            task=it.get("task", ""),
                            owner_name=it.get("owner_name", "Faculty"),
                            priority=it.get("priority", "Medium"),
                            status=it.get("status", "Pending"),
                            due_date=due,
                        )
                        session.add(action)

                    for u in m_data.get("utterances", []):
                        utt = Utterance(
                            meeting_id=new_meeting.id,
                            speaker_name=u.get("speaker_name"),
                            speaker_label=u.get("speaker_label"),
                            text=u.get("text", ""),
                            english_translation=u.get("english_translation"),
                            language=u.get("language", "English"),
                            timestamp=u.get("timestamp", "00:00"),
                        )
                        session.add(utt)

                    print(f"Seeded historical meeting: {m_data['title']}")

        await session.commit()
        print("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
