from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.models.department import Department

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("")
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all departments with real faculty count, meeting count, pending actions, and completion rate.
    No dummy data — strictly real counts from active records.
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

        # Real department actions
        dept_m_ids_stmt = select(Meeting.id).filter(Meeting.department_id == dept.id)
        dept_m_ids_res = await db.execute(dept_m_ids_stmt)
        dept_m_ids = [r[0] for r in dept_m_ids_res.all()]

        pending_actions = 0
        completion_rate = 0.0
        if dept_m_ids:
            tot_act_stmt = select(func.count(ActionItem.id)).filter(ActionItem.meeting_id.in_(dept_m_ids))
            tot_act_res = await db.execute(tot_act_stmt)
            total_actions = tot_act_res.scalar() or 0

            pend_act_stmt = select(func.count(ActionItem.id)).filter(
                ActionItem.meeting_id.in_(dept_m_ids),
                ActionItem.status != "Completed"
            )
            pend_act_res = await db.execute(pend_act_stmt)
            pending_actions = pend_act_res.scalar() or 0

            comp_act = total_actions - pending_actions
            completion_rate = round((comp_act / total_actions) * 100, 1) if total_actions > 0 else 0.0

        enriched.append({
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "faculty_count": faculty_count,
            "meeting_count": meeting_count,
            "pending_actions": pending_actions,
            "completion_rate": completion_rate,
        })

    return enriched
