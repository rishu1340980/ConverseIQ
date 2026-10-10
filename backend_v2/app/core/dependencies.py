from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend_v2.app.core.database import get_db
from backend_v2.app.core.security import decode_access_token
from backend_v2.app.models.user import User
from backend_v2.app.models.token_blacklist import TokenBlacklist

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user_and_token(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> tuple[User, dict, str]:
    """
    Validate JWT, check token blacklist, verify token_version, and return (User, payload, raw_token).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    sub_val = payload.get("sub")
    if sub_val is None:
        raise credentials_exception

    # 1. Check if token jti is revoked/blacklisted
    jti = payload.get("jti")
    if jti:
        blacklist_stmt = select(TokenBlacklist).filter(TokenBlacklist.jti == jti)
        blacklist_res = await db.execute(blacklist_stmt)
        if blacklist_res.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked/logged out. Please authenticate again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Fetch user
    if str(sub_val).isdigit():
        stmt = select(User).options(selectinload(User.department)).filter(User.id == int(sub_val))
    else:
        stmt = select(User).options(selectinload(User.department)).filter(User.email == str(sub_val))

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise credentials_exception

    # 3. Verify token_version against current user token_version (invalidates all sessions on password change)
    token_ver = payload.get("token_version")
    user_ver = getattr(user, "token_version", 1) or 1
    if token_ver is not None and int(token_ver) != user_ver:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been invalidated due to password or credential update. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return user, payload, token

async def get_current_user(
    current_data: tuple[User, dict, str] = Depends(get_current_user_and_token)
) -> User:
    """Central dependency for extracting the authenticated User."""
    user, _, _ = current_data
    return user

def require_role(*allowed_roles: str):
    """Factory dependency for role-based authorization."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden. Requires one of roles: {', '.join(allowed_roles)}."
            )
        return current_user
    return role_checker
