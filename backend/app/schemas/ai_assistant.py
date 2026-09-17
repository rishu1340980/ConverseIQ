from typing import List, Optional
from pydantic import BaseModel

class AIChatRequest(BaseModel):
    query: str
    meeting_id: Optional[int] = None  # None for across-all-meetings search

class MeetingSourceReference(BaseModel):
    meeting_id: int
    meeting_title: str
    date: str
    relevant_snippet: str

class AIChatResponse(BaseModel):
    query: str
    answer: str
    sources: List[MeetingSourceReference] = []
    suggested_questions: List[str] = []
