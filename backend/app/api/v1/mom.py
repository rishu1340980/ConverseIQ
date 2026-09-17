from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.schemas.mom import MinutesOfMeetingUpdate, MinutesOfMeetingResponse

router = APIRouter(prefix="/mom", tags=["Minutes of Meeting"])

@router.put("/{meeting_id}", response_model=MinutesOfMeetingResponse)
async def update_minutes_of_meeting(
    meeting_id: int,
    mom_update: MinutesOfMeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 10: Allows faculty to edit meeting summary, decisions, and discussion topics.
    """
    stmt = select(Meeting).options(selectinload(Meeting.mom)).where(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    if not meeting.mom:
        # Create empty if not exists yet
        meeting.mom = MinutesOfMeeting(
            meeting_id=meeting.id,
            summary="",
            decisions=[],
            topics_discussed=[]
        )
        db.add(meeting.mom)

    if mom_update.summary is not None:
        meeting.mom.summary = mom_update.summary
    if mom_update.decisions is not None:
        meeting.mom.decisions = mom_update.decisions
    if mom_update.topics_discussed is not None:
        meeting.mom.topics_discussed = mom_update.topics_discussed
    if mom_update.is_finalized is not None:
        meeting.mom.is_finalized = mom_update.is_finalized

    meeting.mom.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(meeting.mom)

    await log_audit_event(
        db=db,
        action="MoM Updated",
        details=f"Minutes of Meeting updated for '{meeting.title}' by {current_user.email}",
        severity="Info",
        user_id=current_user.id,
        resource_type="MinutesOfMeeting",
        resource_id=meeting.mom.id
    )

    return meeting.mom

@router.post("/{meeting_id}/finalize", response_model=MinutesOfMeetingResponse)
async def finalize_minutes_of_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark MoM as officially reviewed and finalized for institutional record-keeping.
    """
    stmt = select(Meeting).options(selectinload(Meeting.mom)).where(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting or not meeting.mom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="MoM not found for this meeting")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    meeting.mom.is_finalized = True
    meeting.mom.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(meeting.mom)

    await log_audit_event(
        db=db,
        action="MoM Finalized",
        details=f"MoM for '{meeting.title}' officially finalized by {current_user.email}",
        severity="OK",
        user_id=current_user.id,
        resource_type="MinutesOfMeeting",
        resource_id=meeting.mom.id
    )

    return meeting.mom
