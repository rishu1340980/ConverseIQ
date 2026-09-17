from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    check_login_rate_limit,
    record_failed_login,
    clear_failed_logins,
    get_current_user
)
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.schemas.user import UserLogin, UserCreate, UserResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate faculty/HOD/admin.
    Rate limiting: Locks out on 6th failed attempt (HTTP 429).
    Token expiration: 8 hours.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{login_data.email}"

    # 1. Check rate limit
    check_login_rate_limit(rate_limit_key)

    # 2. Fetch user
    stmt = select(User).where(User.email == login_data.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # 3. Verify user and password
    if not user or not verify_password(login_data.password, user.hashed_password):
        record_failed_login(rate_limit_key)
        await log_audit_event(
            db=db,
            action="Failed Login Attempt",
            details=f"Failed login attempt for {login_data.email} from IP {client_ip}",
            severity="Warn",
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact your institution administrator."
        )

    # 4. Successful login
    clear_failed_logins(rate_limit_key)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )

    await log_audit_event(
        db=db,
        action="User Login",
        details=f"User {user.email} ({user.role}) logged in successfully",
        severity="OK",
        user_id=user.id,
        ip_address=client_ip
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Return currently logged-in user profile."""
    return current_user

@router.post("/register", response_model=UserResponse)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user account."""
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
        
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed_pwd,
        role=user_in.role,
        department_id=user_in.department_id,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user
