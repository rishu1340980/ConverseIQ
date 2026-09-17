from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.action_item import ActionItem

router = APIRouter(prefix="/action-items", tags=["Action Items"])

class ActionItemCreate(BaseModel):
    task: str
    owner_name: Optional[str] = "Assigned Faculty"
    priority: Optional[str] = "Medium"
    due_date: Optional[datetime] = None
    meeting_id: Optional[int] = None

class ActionItemResponse(BaseModel):
    id: int
    task: str
    owner_name: str
    priority: str
    status: str
    due_date: Optional[datetime] = None
    meeting_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[ActionItemResponse])
async def list_action_items(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ActionItem)
    if status_filter:
        stmt = stmt.filter(ActionItem.status == status_filter)
    stmt = stmt.order_by(ActionItem.status.asc(), ActionItem.due_date.asc().nulls_last())
    result = await db.execute(stmt)
    items = result.scalars().all()
    return items

@router.post("", response_model=ActionItemResponse, status_code=status.HTTP_201_CREATED)
async def create_action_item(
    payload: ActionItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    item = ActionItem(
        task=payload.task,
        owner_name=payload.owner_name or current_user.name,
        priority=payload.priority or "Medium",
        due_date=payload.due_date,
        meeting_id=payload.meeting_id,
        user_id=current_user.id,
        status="Pending"
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.patch("/{item_id}/toggle", response_model=ActionItemResponse)
async def toggle_action_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ActionItem).filter(ActionItem.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found"
        )

    item.status = "Completed" if item.status != "Completed" else "Pending"
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ActionItem).filter(ActionItem.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action item not found"
        )

    await db.delete(item)
    await db.commit()
    return None
