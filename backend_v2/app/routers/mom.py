from datetime import datetime, timezone
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.mom import MinutesOfMeeting

router = APIRouter(prefix="/mom", tags=["Minutes of Meeting"])

class UpdateMoMRequest(BaseModel):
    summary: Optional[str] = None
    decisions: Optional[List[str]] = None
    topics_discussed: Optional[List[Any]] = None
    is_finalized: Optional[bool] = None

@router.put("/{meeting_id}")
async def update_mom(
    meeting_id: int,
    payload: UpdateMoMRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update meeting summary, decisions, and topics."""
    stmt = select(Meeting).options(selectinload(Meeting.mom)).filter(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if not meeting.mom:
        meeting.mom = MinutesOfMeeting(
            meeting_id=meeting.id,
            summary="",
            decisions=[],
            agenda_topics=[],
            is_finalized=False
        )
        db.add(meeting.mom)

    if payload.summary is not None:
        meeting.mom.summary = payload.summary
    if payload.decisions is not None:
        meeting.mom.decisions = payload.decisions
    if payload.topics_discussed is not None:
        meeting.mom.agenda_topics = payload.topics_discussed
    if payload.is_finalized is not None:
        meeting.mom.is_finalized = payload.is_finalized
        if payload.is_finalized:
            meeting.mom.finalized_at = datetime.now(timezone.utc)

    meeting.mom.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(meeting.mom)

    return {
        "status": "success",
        "message": "Minutes of Meeting updated successfully",
        "mom": {
            "id": meeting.mom.id,
            "meeting_id": meeting.id,
            "summary": meeting.mom.summary,
            "decisions": meeting.mom.decisions,
            "topics_discussed": meeting.mom.agenda_topics,
            "is_finalized": meeting.mom.is_finalized,
            "finalized_at": meeting.mom.finalized_at.isoformat() if meeting.mom.finalized_at else None
        }
    }

@router.post("/{meeting_id}/finalize")
async def finalize_mom(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark MoM as officially reviewed and finalized."""
    stmt = select(Meeting).options(selectinload(Meeting.mom)).filter(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting or not meeting.mom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Minutes of Meeting not found")

    meeting.mom.is_finalized = True
    meeting.mom.finalized_at = datetime.now(timezone.utc)
    meeting.mom.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(meeting.mom)

    return {
        "status": "success",
        "message": "Minutes of Meeting officially finalized",
        "mom": {
            "id": meeting.mom.id,
            "meeting_id": meeting.id,
            "summary": meeting.mom.summary,
            "decisions": meeting.mom.decisions,
            "topics_discussed": meeting.mom.agenda_topics,
            "is_finalized": meeting.mom.is_finalized,
            "finalized_at": meeting.mom.finalized_at.isoformat() if meeting.mom.finalized_at else None
        }
    }
