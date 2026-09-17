from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.action_item import ActionItemResponse
from app.schemas.meeting import MeetingResponse

class DashboardMetrics(BaseModel):
    total_meetings: int
    pending_action_items: int
    upcoming_deadlines_count: int
    upcoming_sessions_count: int

class FacultyDashboardResponse(BaseModel):
    greeting: str
    user_name: str
    role: str
    metrics: DashboardMetrics
    recent_meetings: List[MeetingResponse]
    upcoming_this_week: List[MeetingResponse]
    priority_action_items: List[ActionItemResponse]

class AdminDashboardResponse(BaseModel):
    total_faculty: int
    total_meetings: int
    action_items_tracked: int
    active_departments: int
    completion_percentage: float
    department_activity: List[dict]
    system_alerts: List[dict]
