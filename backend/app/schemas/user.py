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
    email: Optional[str] = None
    role: str = "Faculty"
    designation: Optional[str] = "Assistant Professor"
    phone: Optional[str] = None
    department_id: Optional[int] = None
    is_email_configured: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
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
    designation: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None

class FacultyEmailUpdate(BaseModel):
    email: str

class FacultyDirectoryItem(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    designation: str = "Assistant Professor"
    phone: Optional[str] = None
    is_email_configured: bool = False
    is_active: bool = True
    department_name: Optional[str] = "Information Technology"

    class Config:
        from_attributes = True

class FacultyCreate(BaseModel):
    name: str
    email: Optional[str] = None
    designation: str = "Assistant Professor"
    phone: Optional[str] = None

class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

class OTPRequestResponse(BaseModel):
    success: bool
    message: str
    email: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
