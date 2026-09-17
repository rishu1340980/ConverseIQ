from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ActionItemBase(BaseModel):
    task: str
    owner_name: str
    owner_id: Optional[int] = None
    priority: str = "Medium"  # 'High', 'Medium', 'Low'
    status: str = "Pending"   # 'Pending', 'Completed'
    due_date: Optional[datetime] = None

class ActionItemCreate(ActionItemBase):
    meeting_id: int

class ActionItemUpdate(BaseModel):
    task: Optional[str] = None
    owner_name: Optional[str] = None
    owner_id: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None

class ActionItemResponse(ActionItemBase):
    id: int
    meeting_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
