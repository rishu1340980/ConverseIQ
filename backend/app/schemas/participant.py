from typing import Optional
from pydantic import BaseModel

class ParticipantBase(BaseModel):
    name: str
    email: Optional[str] = None
    speaker_label: Optional[str] = None

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantResponse(ParticipantBase):
    id: int
    meeting_id: int

    class Config:
        from_attributes = True

class SpeakerMappingUpdate(BaseModel):
    speaker_label: str  # e.g., 'Speaker A'
    real_name: str      # e.g., 'Prof. Sharma'
