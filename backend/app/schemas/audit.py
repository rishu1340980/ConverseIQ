from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class AuditLogResponse(BaseModel):
    id: int
    action: str
    details: str
    severity: str  # 'Info', 'OK', 'Warn', 'Alert'
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class AuditLogCreate(BaseModel):
    action: str
    details: str
    severity: str = "Info"
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
