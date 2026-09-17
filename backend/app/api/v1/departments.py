from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User
from app.models.department import Department
from app.models.meeting import Meeting
from app.models.action_item import ActionItem
from app.schemas.department import DepartmentCreate, DepartmentResponse

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("", response_model=List[DepartmentResponse])
async def list_departments(
    current_user: User = Depends(require_roles(["Admin", "HOD", "Faculty"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 15: List all departments with computed live metrics:
    Faculty count, meeting count, pending action items, completion percentage.
    """
    stmt = (
        select(Department)
        .options(
            selectinload(Department.faculty_members),
            selectinload(Department.meetings).selectinload(Meeting.action_items)
        )
    )
    res = await db.execute(stmt)
    depts = res.scalars().all()

    output = []
    for d in depts:
        all_actions = [a for m in d.meetings for a in m.action_items]
        pending = sum(1 for a in all_actions if a.status == "Pending")
        completed = sum(1 for a in all_actions if a.status == "Completed")
        rate = (completed / len(all_actions) * 100.0) if all_actions else 0.0

        item = DepartmentResponse(
            id=d.id,
            name=d.name,
            hod_id=d.hod_id,
            created_at=d.created_at,
            faculty_count=len(d.faculty_members),
            meeting_count=len(d.meetings),
            pending_actions=pending,
            completion_rate=round(rate, 1)
        )
        output.append(item)

    return output

@router.post("", response_model=DepartmentResponse)
async def create_department(
    dept_in: DepartmentCreate,
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: Create a new department."""
    existing = await db.execute(select(Department).where(Department.name == dept_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department already exists")

    new_dept = Department(
        name=dept_in.name,
        hod_id=dept_in.hod_id
    )
    db.add(new_dept)
    await db.commit()
    await db.refresh(new_dept)

    return DepartmentResponse(
        id=new_dept.id,
        name=new_dept.name,
        hod_id=new_dept.hod_id,
        created_at=new_dept.created_at,
        faculty_count=0,
        meeting_count=0,
        pending_actions=0,
        completion_rate=0.0
    )
