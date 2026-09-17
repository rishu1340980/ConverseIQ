from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_roles, get_password_hash
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.models.meeting import Meeting
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["User Management"])

@router.get("", response_model=List[dict])
async def list_users(
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 14: Admin view of all users including meeting count, join date, status.
    """
    stmt = select(User).options(selectinload(User.meetings), selectinload(User.department))
    res = await db.execute(stmt)
    users = res.scalars().all()

    output = []
    for u in users:
        output.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "department_id": u.department_id,
            "department_name": u.department.name if u.department else "Unassigned",
            "meeting_count": len(u.meetings),
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat()
        })
    return output

@router.post("/invite", response_model=UserResponse)
async def invite_user(
    user_in: UserCreate,
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Invite / create new user account."""
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        department_id=user_in.department_id,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await log_audit_event(
        db=db,
        action="User Created",
        details=f"Admin {current_user.email} created user {new_user.email} ({new_user.role})",
        severity="Info",
        user_id=current_user.id,
        resource_type="User",
        resource_id=new_user.id
    )

    return new_user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_up: UserUpdate,
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Update user role, status (active/suspended), or department."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_up.name is not None:
        target_user.name = user_up.name
    if user_up.role is not None:
        target_user.role = user_up.role
    if user_up.department_id is not None:
        target_user.department_id = user_up.department_id
    if user_up.is_active is not None:
        target_user.is_active = user_up.is_active

    await db.commit()
    await db.refresh(target_user)

    status_str = "Active" if target_user.is_active else "Suspended"
    await log_audit_event(
        db=db,
        action="User Updated",
        details=f"User {target_user.email} updated: Role={target_user.role}, Status={status_str}",
        severity="Warn" if not target_user.is_active else "Info",
        user_id=current_user.id,
        resource_type="User",
        resource_id=target_user.id
    )

    return target_user
