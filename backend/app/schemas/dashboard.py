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

class HodMetrics(BaseModel):
    total_faculty: int
    meetings_this_month: int
    pending_actions: int
    completion_rate: float
    avg_duration: str
    avg_participants: int

class FacultyPerformanceItem(BaseModel):
    name: str
    rate: float
    total_actions: Optional[int] = 0
    completed_actions: Optional[int] = 0

class WeeklyMeetingItem(BaseModel):
    week: str
    count: int

class UrgentActionItem(BaseModel):
    task: str
    assignedTo: str
    deadline: str
    priority: str

class HodDashboardResponse(BaseModel):
    metrics: HodMetrics
    faculty_performance: List[FacultyPerformanceItem]
    weekly_meetings: List[WeeklyMeetingItem]
    urgent_actions: List[UrgentActionItem]
    has_sufficient_data: bool = True
    context_descriptions: Optional[dict] = None

