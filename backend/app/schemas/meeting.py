from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.participant import ParticipantResponse, ParticipantCreate
from app.schemas.action_item import ActionItemResponse
from app.schemas.mom import MinutesOfMeetingResponse

class MeetingBase(BaseModel):
    title: str
    date: datetime
    duration_minutes: int = 0
    status: str = "Scheduled"  # Scheduled, Processing, Completed, Failed
    department_id: Optional[int] = None

class MeetingCreate(MeetingBase):
    participants: Optional[List[str]] = []  # List of participant names to seed

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    department_id: Optional[int] = None

class MeetingResponse(MeetingBase):
    id: int
    created_by_id: int
    created_at: datetime
    participant_count: Optional[int] = 0
    participants: List[ParticipantResponse] = []

    class Config:
        from_attributes = True

class MeetingDetailResponse(MeetingResponse):
    audio_file_path: Optional[str] = None
    participants: List[ParticipantResponse] = []
    mom: Optional[MinutesOfMeetingResponse] = None
    action_items: List[ActionItemResponse] = []

    class Config:
        from_attributes = True
