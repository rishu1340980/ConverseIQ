from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend_v2.app.core.database import get_db
from backend_v2.app.core.security import verify_password, get_password_hash, create_access_token
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(User)
        .options(selectinload(User.department))
        .filter(User.email == req.email.lower().strip())
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended. Please contact institutional administrator."
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )

    user_resp = UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_name=user.department.name if user.department else None,
        designation=user.designation,
        phone=user.phone,
        is_active=user.is_active,
    )

    return TokenResponse(access_token=access_token, token_type="bearer", user=user_resp)


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department_name=current_user.department.name if current_user.department else None,
        designation=current_user.designation,
        phone=current_user.phone,
        is_active=current_user.is_active,
    )


@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile details."""
    if payload.name is not None and payload.name.strip():
        current_user.name = payload.name.strip()
    if payload.designation is not None:
        current_user.designation = payload.designation.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()

    await db.commit()
    await db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department_name=current_user.department.name if current_user.department else None,
        designation=current_user.designation,
        phone=current_user.phone,
        is_active=current_user.is_active,
    )


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change current user's password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password does not match our records."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    return {"message": "Password updated successfully."}


@router.get("/export-data")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export all meetings, minutes, action items and transcripts for the logged in user."""
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items),
            selectinload(Meeting.utterances),
            selectinload(Meeting.participants),
        )
        .filter(Meeting.user_id == current_user.id)
        .order_by(Meeting.date.desc())
    )
    res = await db.execute(stmt)
    meetings = res.scalars().all()

    meetings_export = []
    for m in meetings:
        meetings_export.append({
            "id": m.id,
            "title": m.title,
            "date": m.date.isoformat() if m.date else None,
            "duration_minutes": m.duration_minutes,
            "status": m.status,
            "participants": [{"name": p.name, "speaker_label": p.speaker_label} for p in m.participants],
            "mom": {
                "summary": m.mom.summary if m.mom else None,
                "decisions": m.mom.decisions if (m.mom and m.mom.decisions) else [],
                "agenda_topics": m.mom.agenda_topics if (m.mom and m.mom.agenda_topics) else [],
            } if m.mom else None,
            "action_items": [
                {
                    "task": a.task,
                    "owner": a.owner_name,
                    "priority": a.priority,
                    "status": a.status,
                    "due_date": a.due_date.isoformat() if a.due_date else None,
                }
                for a in m.action_items
            ],
            "utterances": [
                {
                    "speaker": u.speaker_name or u.speaker_label,
                    "text": u.text,
                    "timestamp": u.timestamp,
                    "language": u.language,
                }
                for u in m.utterances
            ]
        })

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "platform": "ConverseIQ Academic Meeting Intelligence Platform",
        "user_profile": {
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "designation": current_user.designation,
            "phone": current_user.phone,
            "department": current_user.department.name if current_user.department else None,
        },
        "total_meetings_exported": len(meetings_export),
        "meetings": meetings_export,
    }
