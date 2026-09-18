from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.department import Department

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("")
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all departments with real faculty count and meeting count.
    No dummy data — counts are 0 if nothing exists.
    """
    stmt = select(Department).order_by(Department.name.asc())
    result = await db.execute(stmt)
    depts = result.scalars().all()

    enriched = []
    for dept in depts:
        # Real faculty count
        fc_stmt = select(func.count(User.id)).filter(
            User.department_id == dept.id,
            User.role == "Faculty",
            User.is_active == True,
        )
        fc_res = await db.execute(fc_stmt)
        faculty_count = fc_res.scalar() or 0

        # Real meeting count
        mc_stmt = select(func.count(Meeting.id)).filter(Meeting.department_id == dept.id)
        mc_res = await db.execute(mc_stmt)
        meeting_count = mc_res.scalar() or 0

        enriched.append({
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "faculty_count": faculty_count,
            "meeting_count": meeting_count,
        })

    return enriched
