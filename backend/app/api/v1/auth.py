import re
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

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
from app.models.otp import EmailOTP
from app.services.email_service import email_service
from app.schemas.user import (
    UserLogin,
    UserCreate,
    UserResponse,
    TokenResponse,
    OTPRequest,
    OTPVerify,
    OTPRequestResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

APSIT_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@apsit\.edu\.in$", re.IGNORECASE)
INVALID_DOMAIN_MSG = "Not Applicable. Please use your official APSIT institutional email address."


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
    clean_email = login_data.email.strip().lower()

    # Enforce institutional domain (allow @apsit.edu.in and legacy @converseiq.edu system accounts)
    if not (clean_email.endswith("@converseiq.edu") or APSIT_EMAIL_REGEX.match(clean_email)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_DOMAIN_MSG
        )

    rate_limit_key = f"{client_ip}:{clean_email}"

    # 1. Check rate limit
    check_login_rate_limit(rate_limit_key)

    # 2. Fetch user
    stmt = select(User).where(User.email == clean_email)
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


@router.post("/request-otp", response_model=OTPRequestResponse)
async def request_otp(
    payload: OTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate and send a single-use 6-digit OTP to official APSIT email address.
    Enforces @apsit.edu.in domain, 60s cooldown, and 10-minute validity.
    """
    clean_email = payload.email.strip().lower()

    if not APSIT_EMAIL_REGEX.match(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_DOMAIN_MSG
        )

    now = datetime.now(timezone.utc)

    # Check cooldown: last unused active OTP created within 60 seconds
    stmt = (
        select(EmailOTP)
        .where(EmailOTP.email == clean_email, EmailOTP.is_used == False)
        .order_by(desc(EmailOTP.id))
        .limit(1)
    )
    result = await db.execute(stmt)
    latest_otp = result.scalar_one_or_none()

    if latest_otp and latest_otp.created_at:
        created_at_utc = latest_otp.created_at
        if created_at_utc.tzinfo is None:
            created_at_utc = created_at_utc.replace(tzinfo=timezone.utc)
        elapsed_seconds = (now - created_at_utc).total_seconds()
        if elapsed_seconds < 60:
            remaining = int(60 - elapsed_seconds)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting a new verification code."
            )

    # Invalidate previous unused OTPs for this email
    prev_otps_stmt = select(EmailOTP).where(EmailOTP.email == clean_email, EmailOTP.is_used == False)
    prev_otps = (await db.execute(prev_otps_stmt)).scalars().all()
    for prev in prev_otps:
        prev.is_used = True

    # Generate cryptographic 6-digit OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    hashed_otp = get_password_hash(otp_code)
    expires_at = now + timedelta(minutes=10)

    otp_record = EmailOTP(
        email=clean_email,
        otp_hash=hashed_otp,
        attempts=0,
        expires_at=expires_at,
        is_used=False,
        created_at=now
    )
    db.add(otp_record)
    await db.commit()

    # Dispatch email
    email_service.send_otp_email(clean_email, otp_code)

    return OTPRequestResponse(
        success=True,
        message="Verification code sent to your official APSIT institutional email.",
        email=clean_email
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    payload: OTPVerify,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify 6-digit OTP and authenticate user.
    Auto-provisions faculty profile if valid APSIT email not yet in directory.
    """
    clean_email = payload.email.strip().lower()
    otp_code = payload.otp.strip()
    client_ip = request.client.host if request.client else "unknown"

    if not APSIT_EMAIL_REGEX.match(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_DOMAIN_MSG
        )

    now = datetime.now(timezone.utc)

    # Fetch latest unused OTP record
    stmt = (
        select(EmailOTP)
        .where(EmailOTP.email == clean_email, EmailOTP.is_used == False)
        .order_by(desc(EmailOTP.id))
        .limit(1)
    )
    result = await db.execute(stmt)
    otp_record = result.scalar_one_or_none()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired or is invalid. Please request a new code."
        )

    # Check expiration
    exp_utc = otp_record.expires_at
    if exp_utc.tzinfo is None:
        exp_utc = exp_utc.replace(tzinfo=timezone.utc)

    if exp_utc < now:
        otp_record.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    # Check attempt limit (max 5)
    if otp_record.attempts >= 5:
        otp_record.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new code."
        )

    # Check code match
    is_valid = verify_password(otp_code, otp_record.otp_hash)
    otp_record.attempts += 1

    if not is_valid:
        await db.commit()
        attempts_left = 5 - otp_record.attempts
        detail = "Invalid verification code. Please check and try again."
        if attempts_left > 0:
            detail += f" ({attempts_left} attempts remaining)"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

    # Mark OTP as consumed
    otp_record.is_used = True
    await db.commit()

    # Find or provision user
    user_stmt = select(User).where(User.email == clean_email)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        # Check if there is an unconfigured faculty profile matching local part or create new
        local_part = clean_email.split("@")[0]
        name_parts = [p.capitalize() for p in local_part.replace(".", " ").replace("_", " ").split()]
        formatted_name = "Prof. " + " ".join(name_parts)

        user = User(
            name=formatted_name,
            email=clean_email,
            role="Faculty",
            designation="Assistant Professor",
            department_id=1,
            is_email_configured=True,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact your institution administrator."
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )

    await log_audit_event(
        db=db,
        action="Institutional OTP Login",
        details=f"User {user.email} authenticated successfully via OTP",
        severity="OK",
        user_id=user.id,
        ip_address=client_ip
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

