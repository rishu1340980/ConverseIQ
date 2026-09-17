from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend_v2.app.core.database import get_db
from backend_v2.app.core.security import decode_access_token
from backend_v2.app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
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

    if str(sub_val).isdigit():
        stmt = select(User).options(selectinload(User.department)).filter(User.id == int(sub_val))
    else:
        stmt = select(User).options(selectinload(User.department)).filter(User.email == str(sub_val))

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise credentials_exception
        
    return user
