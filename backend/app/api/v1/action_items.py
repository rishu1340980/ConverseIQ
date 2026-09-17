from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.models.meeting import Meeting
from app.models.action_item import ActionItem
from app.schemas.action_item import ActionItemCreate, ActionItemUpdate, ActionItemResponse

router = APIRouter(prefix="/action-items", tags=["Action Items"])

@router.get("", response_model=List[ActionItemResponse])
async def list_action_items(
    status_filter: Optional[str] = Query(None, description="'Pending' or 'Completed'"),
    category: Optional[str] = Query(None, description="'urgent', 'upcoming', or 'completed'"),
    priority: Optional[str] = Query(None, description="'High', 'Medium', 'Low'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List action items.
    Can be filtered by status or grouped into 'urgent', 'upcoming', 'completed'.
    """
    now = datetime.now(timezone.utc)
    week_end = now + timedelta(days=7)

    stmt = (
        select(ActionItem)
        .join(Meeting)
        .where(Meeting.created_by_id == current_user.id)
    )

    if category == "completed" or status_filter == "Completed":
        stmt = stmt.where(ActionItem.status == "Completed")
    elif category == "urgent":
        # High priority or due within 48 hours
        stmt = stmt.where(
            ActionItem.status == "Pending",
            (ActionItem.priority == "High") | (ActionItem.due_date <= now + timedelta(days=2))
        )
    elif category == "upcoming":
        stmt = stmt.where(
            ActionItem.status == "Pending",
            ActionItem.priority != "High"
        )
    elif status_filter:
        stmt = stmt.where(ActionItem.status == status_filter)

    if priority:
        stmt = stmt.where(ActionItem.priority == priority)

    stmt = stmt.order_by(ActionItem.status.desc(), ActionItem.due_date.asc().nullslast())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=ActionItemResponse)
async def create_action_item(
    item_in: ActionItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually add an action item to a meeting."""
    stmt = select(Meeting).where(Meeting.id == item_in.meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    new_item = ActionItem(
        meeting_id=item_in.meeting_id,
        task=item_in.task,
        owner_name=item_in.owner_name,
        owner_id=item_in.owner_id,
        priority=item_in.priority,
        status=item_in.status,
        due_date=item_in.due_date
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item

@router.put("/{item_id}", response_model=ActionItemResponse)
async def update_action_item(
    item_id: int,
    item_update: ActionItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 6: Edit task, owner, priority (High/Medium/Low), or status (Pending/Completed).
    """
    stmt = select(ActionItem).join(Meeting).where(ActionItem.id == item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")

    if item_update.task is not None:
        item.task = item_update.task
    if item_update.owner_name is not None:
        item.owner_name = item_update.owner_name
    if item_update.owner_id is not None:
        item.owner_id = item_update.owner_id
    if item_update.priority is not None:
        item.priority = item_update.priority
    if item_update.status is not None:
        item.status = item_update.status
    if item_update.due_date is not None:
        item.due_date = item_update.due_date

    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(item)
    return item

@router.patch("/{item_id}/toggle", response_model=ActionItemResponse)
async def toggle_action_item_status(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Quick toggle action item between 'Pending' and 'Completed'.
    """
    stmt = select(ActionItem).where(ActionItem.id == item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")

    item.status = "Completed" if item.status == "Pending" else "Pending"
    item.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(item)

    await log_audit_event(
        db=db,
        action="Action Item Toggled",
        details=f"Item '{item.task[:30]}' marked {item.status}",
        severity="OK",
        user_id=current_user.id,
        resource_type="ActionItem",
        resource_id=item.id
    )

    return item

@router.delete("/{item_id}")
async def delete_action_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an action item."""
    stmt = select(ActionItem).where(ActionItem.id == item_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Action item deleted successfully"}
