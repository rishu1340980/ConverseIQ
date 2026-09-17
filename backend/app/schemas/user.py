from datetime import datetime
from typing import Optional
from pydantic import BaseModel

try:
    import email_validator
    from pydantic import EmailStr
except ImportError:
    EmailStr = str

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "Faculty"
    department_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
