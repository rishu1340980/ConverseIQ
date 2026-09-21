from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.core.security import get_password_hash
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.services.audit import log_audit_event

router = APIRouter(prefix="/users", tags=["Users"])


class CreateFacultyRequest(BaseModel):
    name: str
    email: str
    password: str
    designation: Optional[str] = "Assistant Professor"
    phone: Optional[str] = ""


class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    designation: Optional[str] = None
    phone: Optional[str] = None


@router.get("")
async def list_users(
    role: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List users.
    - HOD: sees only faculty in their own department
    - Admin: sees all users system-wide
    """
    stmt = select(User)

    if current_user.role == "HOD":
        # HOD sees only their dept's faculty
        stmt = stmt.filter(
            User.department_id == current_user.department_id,
            User.role == "Faculty",
        )
    elif current_user.role == "Admin":
        # Admin can filter by role if specified
        if role:
            stmt = stmt.filter(User.role == role)
    else:
        # Faculty can only see themselves
        stmt = stmt.filter(User.id == current_user.id)

    stmt = stmt.order_by(User.name.asc())
    result = await db.execute(stmt)
    users = result.scalars().all()

    # Enrich with meeting_count and completion_rate
    enriched = []
    for u in users:
        # Meetings hosted by this user
        m_stmt = select(func.count(Meeting.id)).filter(Meeting.user_id == u.id)
        m_res = await db.execute(m_stmt)
        meeting_count = m_res.scalar() or 0

        # Get meeting ids for this user
        mid_stmt = select(Meeting.id).filter(Meeting.user_id == u.id)
        mid_res = await db.execute(mid_stmt)
        meeting_ids = [r[0] for r in mid_res.all()]

        actions_done = 0
        actions_total = 0
        if meeting_ids:
            at_stmt = select(func.count(ActionItem.id)).filter(
                ActionItem.meeting_id.in_(meeting_ids)
            )
            at_res = await db.execute(at_stmt)
            actions_total = at_res.scalar() or 0

            ad_stmt = select(func.count(ActionItem.id)).filter(
                ActionItem.meeting_id.in_(meeting_ids),
                ActionItem.status == "Completed",
            )
            ad_res = await db.execute(ad_stmt)
            actions_done = ad_res.scalar() or 0

        completion_rate = round((actions_done / actions_total) * 100) if actions_total > 0 else 0

        enriched.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "designation": u.designation,
            "phone": u.phone,
            "is_active": u.is_active,
            "department_id": u.department_id,
            "department_name": u.department.name if u.department else None,
            "meeting_count": meeting_count,
            "actions_done": actions_done,
            "actions_total": actions_total,
            "completion_rate": completion_rate,
        })

    return enriched


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_faculty(
    payload: CreateFacultyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new faculty member.
    ONLY HOD can create faculty — restricted by role.
    The new faculty is automatically assigned to the HOD's department.
    """
    if current_user.role != "HOD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HOD can create faculty members."
        )

    # Check email uniqueness
    existing_stmt = select(User).filter(User.email == payload.email.strip())
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists."
        )

    new_faculty = User(
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        hashed_password=get_password_hash(payload.password),
        role="Faculty",
        designation=payload.designation or "Assistant Professor",
        phone=payload.phone or "",
        department_id=current_user.department_id,  # Same dept as HOD
        is_active=True,
    )
    db.add(new_faculty)
    await db.commit()
    await db.refresh(new_faculty)

    await log_audit_event(
        db=db,
        action="USER_CREATED",
        details=f"{current_user.role} {current_user.name} created faculty account for {new_faculty.name} ({new_faculty.email})",
        severity="Info",
        user_id=current_user.id,
        user_name=current_user.name,
        resource_type="user",
        resource_id=new_faculty.id,
    )

    return {
        "id": new_faculty.id,
        "name": new_faculty.name,
        "email": new_faculty.email,
        "role": new_faculty.role,
        "designation": new_faculty.designation,
        "department_id": new_faculty.department_id,
        "is_active": new_faculty.is_active,
    }


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user (toggle active, update designation/phone).
    HOD can update faculty in their dept. Admin can update anyone.
    """
    if current_user.role not in ("HOD", "Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # HOD can only update users in their own department
    if current_user.role == "HOD" and target.department_id != current_user.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify faculty outside your department.")

    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.designation is not None:
        target.designation = payload.designation
    if payload.phone is not None:
        target.phone = payload.phone

    await db.commit()
    await db.refresh(target)

    status_str = "activated" if target.is_active else "suspended"
    await log_audit_event(
        db=db,
        action="USER_STATUS_UPDATED",
        details=f"{current_user.role} {current_user.name} {status_str} account for {target.name} ({target.email})",
        severity="Warn" if not target.is_active else "Info",
        user_id=current_user.id,
        user_name=current_user.name,
        resource_type="user",
        resource_id=target.id,
    )

    return {"id": target.id, "name": target.name, "is_active": target.is_active}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a user.
    HOD can delete faculty in their own department.
    Admin can delete any user except themselves.
    """
    if current_user.role not in ("HOD", "Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account.")

    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    target = result.scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if current_user.role == "HOD" and target.department_id != current_user.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete faculty outside your department.")

    deleted_user_name = target.name
    deleted_user_email = target.email
    deleted_user_id = target.id

    await db.delete(target)
    await db.commit()

    await log_audit_event(
        db=db,
        action="USER_DELETED",
        details=f"{current_user.role} {current_user.name} deleted user {deleted_user_name} ({deleted_user_email})",
        severity="Alert",
        user_id=current_user.id,
        user_name=current_user.name,
        resource_type="user",
        resource_id=deleted_user_id,
    )

    return None
