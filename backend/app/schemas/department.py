from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class DepartmentBase(BaseModel):
    name: str
    hod_id: Optional[int] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    faculty_count: Optional[int] = 0
    meeting_count: Optional[int] = 0
    pending_actions: Optional[int] = 0
    completion_rate: Optional[float] = 0.0

    class Config:
        from_attributes = True
