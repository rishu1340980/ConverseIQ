from typing import List, Dict, Any
from pydantic import BaseModel

class UsageStats(BaseModel):
    avg_meeting_duration_mins: float
    actions_per_meeting: float
    action_completion_rate: float
    ai_queries_this_month: int

class AnalyticsSummaryResponse(BaseModel):
    stats: UsageStats
    meetings_vs_actions_trend: List[Dict[str, Any]]
    department_engagement: List[Dict[str, Any]]
    feature_usage_breakdown: Dict[str, int]
