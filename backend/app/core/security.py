import time
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
from jose import jwt, JWTError
import bcrypt
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)

# In-memory tracking for login rate limiting: IP/email -> list of failed timestamps
failed_login_attempts: Dict[str, List[float]] = {}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password using native bcrypt."""
    try:
        plain_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash password using native bcrypt."""
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT session token with 8-hour expiration."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def check_login_rate_limit(key: str) -> None:
    """
    Enforce rate limiting on failed login attempts.
    If 5 failed attempts exist within the lockout window, the 6th attempt triggers a 429 Lockout.
    """
    now = time.time()
    window = settings.LOGIN_LOCKOUT_MINUTES * 60
    
    attempts = failed_login_attempts.get(key, [])
    # Filter out attempts older than lockout window
    recent_attempts = [t for t in attempts if now - t < window]
    failed_login_attempts[key] = recent_attempts
    
    if len(recent_attempts) >= settings.MAX_LOGIN_ATTEMPTS:
        retry_after = int(window - (now - recent_attempts[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked for {settings.LOGIN_LOCKOUT_MINUTES} minutes.",
            headers={"Retry-After": str(max(1, retry_after))}
        )

def record_failed_login(key: str) -> None:
    """Record a failed login attempt timestamp."""
    now = time.time()
    if key not in failed_login_attempts:
        failed_login_attempts[key] = []
    failed_login_attempts[key].append(now)

def clear_failed_logins(key: str) -> None:
    """Clear failed attempts upon successful login."""
    failed_login_attempts.pop(key, None)

# Lazy import helpers for user dependencies to avoid circular imports
async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(lambda: None) # overridden in route or api/deps
):
    from app.models.user import User
    from app.core.database import get_db
    
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(auth.credentials)
    user_id: Optional[int] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload",
        )
    
    # We will fetch user using an active db session
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated or suspended",
            )
        return user

def require_roles(allowed_roles: List[str]):
    """
    Enforces Role-Based Access Control (RBAC).
    Allowed roles can be any of ['Faculty', 'HOD', 'Admin'].
    """
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker
