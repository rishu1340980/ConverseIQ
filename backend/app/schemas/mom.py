from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel

class TopicItem(BaseModel):
    topic: str
    points: List[str] = []

class MinutesOfMeetingBase(BaseModel):
    summary: str
    decisions: List[str] = []
    topics_discussed: List[Any] = []
    raw_transcript: Optional[str] = None
    utterances: Optional[List[Any]] = []
    is_finalized: bool = False

class MinutesOfMeetingCreate(MinutesOfMeetingBase):
    meeting_id: int

class MinutesOfMeetingUpdate(BaseModel):
    summary: Optional[str] = None
    decisions: Optional[List[str]] = None
    topics_discussed: Optional[List[Any]] = None
    raw_transcript: Optional[str] = None
    utterances: Optional[List[Any]] = None
    is_finalized: Optional[bool] = None

class MinutesOfMeetingResponse(MinutesOfMeetingBase):
    id: int
    meeting_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
