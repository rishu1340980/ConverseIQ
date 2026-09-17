import asyncio
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

        await session.commit()
        print("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
