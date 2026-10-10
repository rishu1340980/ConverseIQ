from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend_v2.app.core.database import get_db
from backend_v2.app.core.security import (
    verify_password,
    verify_dummy_password,
    get_password_hash,
    create_access_token,
    validate_password_strength,
)
from backend_v2.app.core.dependencies import get_current_user, get_current_user_and_token
from backend_v2.app.core.rate_limiter import login_ip_limiter
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.token_blacklist import TokenBlacklist
from backend_v2.app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from backend_v2.app.services.audit import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

def get_client_ip(request: Request) -> str:
    """
    Extract client IP safely.
    Note: For production behind reverse proxies (e.g. Cloudflare, Render),
    ensure the reverse proxy strips spoofed headers and sets trusted client IP.
    """
    client_host = request.client.host if request.client else "127.0.0.1"
    return client_host

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    client_ip = get_client_ip(request)

    # 1. IP Rate Limiting Check (5 requests per minute)
    if login_ip_limiter.is_rate_limited(client_ip):
        await log_audit_event(
            db=db,
            action="RATE_LIMIT_EXCEEDED",
            details=f"Excessive login attempts from IP: {client_ip}",
            severity="Warn",
            ip_address=client_ip,
            resource_type="auth"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication requests from your IP address. Please wait a minute before trying again."
        )

    clean_email = req.email.lower().strip()
    now_utc = datetime.now(timezone.utc)

    # 2. Query target user
    stmt = (
        select(User)
        .options(selectinload(User.department))
        .filter(User.email == clean_email)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # User does NOT exist: Perform dummy bcrypt verification to prevent timing attack enumeration
    if not user:
        verify_dummy_password(req.password)
        await log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            details=f"Failed login attempt for nonexistent identifier: {clean_email}",
            severity="Warn",
            ip_address=client_ip,
            resource_type="auth",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # 3. Check Account Lockout State
    if user.locked_until:
        # Normalize timezone if needed
        locked_until_utc = user.locked_until
        if locked_until_utc.tzinfo is None:
            locked_until_utc = locked_until_utc.replace(tzinfo=timezone.utc)

        if locked_until_utc > now_utc:
            remaining_seconds = int((locked_until_utc - now_utc).total_seconds())
            remaining_mins = max(1, (remaining_seconds + 59) // 60)
            await log_audit_event(
                db=db,
                action="LOCKED_LOGIN_ATTEMPT",
                details=f"Login attempt on locked account {clean_email} ({remaining_mins}m remaining)",
                severity="Alert",
                user_id=user.id,
                user_name=user.name,
                ip_address=client_ip,
                resource_type="auth",
                resource_id=user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked due to consecutive failed attempts. Please retry after {remaining_mins} minutes or contact support."
            )
        else:
            # Lockout expired, reset lockout counter
            user.locked_until = None
            user.failed_login_attempts = 0

    # 4. Check Password
    if not verify_password(req.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now_utc + timedelta(minutes=LOCKOUT_MINUTES)
            await db.commit()
            await log_audit_event(
                db=db,
                action="ACCOUNT_LOCKED",
                details=f"Account {clean_email} locked for {LOCKOUT_MINUTES} minutes after {user.failed_login_attempts} failed attempts",
                severity="Alert",
                user_id=user.id,
                user_name=user.name,
                ip_address=client_ip,
                resource_type="auth",
                resource_id=user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account temporarily locked for {LOCKOUT_MINUTES} minutes due to multiple failed login attempts."
            )

        await db.commit()
        await log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            details=f"Failed login attempt for {clean_email} (Attempt {user.failed_login_attempts}/{MAX_FAILED_ATTEMPTS})",
            severity="Warn",
            user_id=user.id,
            user_name=user.name,
            ip_address=client_ip,
            resource_type="auth",
            resource_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # 5. Check if user is active
    if not user.is_active:
        await log_audit_event(
            db=db,
            action="SUSPENDED_LOGIN_ATTEMPT",
            details=f"Suspended user {user.email} attempted to log in",
            severity="Alert",
            user_id=user.id,
            user_name=user.name,
            ip_address=client_ip,
            resource_type="auth",
            resource_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended. Please contact institutional administrator."
        )

    # 6. Authentication Successful -> Reset failed attempts and lockout
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    await log_audit_event(
        db=db,
        action="USER_LOGIN",
        details=f"{user.name} ({user.role}) logged in successfully",
        severity="OK",
        user_id=user.id,
        user_name=user.name,
        ip_address=client_ip,
        resource_type="auth",
        resource_id=user.id,
    )

    token_ver = getattr(user, "token_version", 1) or 1
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        token_version=token_ver
    )

    user_resp = UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        department_name=user.department.name if user.department else None,
        designation=user.designation,
        phone=user.phone,
        is_active=user.is_active,
    )

    return TokenResponse(access_token=access_token, token_type="bearer", user=user_resp)

@router.post("/logout")
async def logout(
    request: Request,
    current_data: tuple[User, dict, str] = Depends(get_current_user_and_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Revoke authenticated JWT by blacklisting its jti until its expiry timestamp.
    """
    current_user, payload, raw_token = current_data
    client_ip = get_client_ip(request)
    jti = payload.get("jti")
    exp_ts = payload.get("exp")

    if jti and exp_ts:
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        # Avoid duplicate blacklist insertion
        stmt = select(TokenBlacklist).filter(TokenBlacklist.jti == jti)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            blacklist_entry = TokenBlacklist(
                jti=jti,
                user_id=current_user.id,
                expires_at=expires_at
            )
            db.add(blacklist_entry)
            await db.commit()

    await log_audit_event(
        db=db,
        action="USER_LOGOUT",
        details=f"{current_user.name} logged out; session token revoked",
        severity="Info",
        user_id=current_user.id,
        user_name=current_user.name,
        ip_address=client_ip,
        resource_type="auth",
        resource_id=current_user.id,
    )

    return {"status": "success", "message": "Successfully logged out and session revoked."}

@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department_name=current_user.department.name if current_user.department else None,
        designation=current_user.designation,
        phone=current_user.phone,
        is_active=current_user.is_active,
    )

@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile details."""
    if payload.name is not None and payload.name.strip():
        current_user.name = payload.name.strip()
    if payload.designation is not None:
        current_user.designation = payload.designation.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()

    await db.commit()
    await db.refresh(current_user)

    await log_audit_event(
        db=db,
        action="PROFILE_UPDATED",
        details=f"User {current_user.name} ({current_user.email}) updated profile details",
        severity="Info",
        user_id=current_user.id,
        user_name=current_user.name,
        ip_address=get_client_ip(request),
        resource_type="user",
        resource_id=current_user.id,
    )

    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        department_name=current_user.department.name if current_user.department else None,
        designation=current_user.designation,
        phone=current_user.phone,
        is_active=current_user.is_active,
    )

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Change current user's password with password strength enforcement
    and invalidate all existing active JWTs across all devices by incrementing token_version.
    """
    client_ip = get_client_ip(request)

    # 1. Verify current password
    if not verify_password(payload.current_password, current_user.hashed_password):
        await log_audit_event(
            db=db,
            action="PASSWORD_CHANGE_FAILED",
            details=f"Failed password change attempt for {current_user.email} (incorrect current password)",
            severity="Warn",
            user_id=current_user.id,
            user_name=current_user.name,
            ip_address=client_ip,
            resource_type="auth",
            resource_id=current_user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password does not match our records."
        )

    # 2. Prevent password reuse
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your current password."
        )

    # 3. Validate password complexity
    pwd_err = validate_password_strength(payload.new_password)
    if pwd_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pwd_err
        )

    # 4. Update password and atomically increment token_version (revokes all existing sessions)
    current_user.hashed_password = get_password_hash(payload.new_password)
    current_user.token_version = (getattr(current_user, "token_version", 1) or 1) + 1
    await db.commit()

    await log_audit_event(
        db=db,
        action="PASSWORD_CHANGED",
        details=f"User {current_user.name} ({current_user.email}) changed password. All previous sessions revoked.",
        severity="Info",
        user_id=current_user.id,
        user_name=current_user.name,
        ip_address=client_ip,
        resource_type="auth",
        resource_id=current_user.id,
    )

    # Generate a fresh access token with the incremented token_version for the current caller
    fresh_token = create_access_token(
        data={"sub": str(current_user.id), "email": current_user.email, "role": current_user.role},
        token_version=current_user.token_version
    )

    return {
        "message": "Password updated successfully. All existing sessions have been revoked.",
        "access_token": fresh_token,
        "token_type": "bearer"
    }

@router.get("/export-data")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export all meetings, minutes, action items and transcripts for the logged in user."""
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items),
            selectinload(Meeting.utterances),
            selectinload(Meeting.participants),
        )
        .filter(Meeting.user_id == current_user.id)
        .order_by(Meeting.date.desc())
    )
    res = await db.execute(stmt)
    meetings = res.scalars().all()

    meetings_export = []
    for m in meetings:
        meetings_export.append({
            "id": m.id,
            "title": m.title,
            "date": m.date.isoformat() if m.date else None,
            "duration_minutes": m.duration_minutes,
            "status": m.status,
            "participants": [{"name": p.name, "speaker_label": p.speaker_label} for p in m.participants],
            "mom": {
                "summary": m.mom.summary if m.mom else None,
                "decisions": m.mom.decisions if (m.mom and m.mom.decisions) else [],
                "agenda_topics": m.mom.agenda_topics if (m.mom and m.mom.agenda_topics) else [],
            } if m.mom else None,
            "action_items": [
                {
                    "task": a.task,
                    "owner": a.owner_name,
                    "priority": a.priority,
                    "status": a.status,
                    "due_date": a.due_date.isoformat() if a.due_date else None,
                }
                for a in m.action_items
            ],
            "utterances": [
                {
                    "speaker": u.speaker_name or u.speaker_label,
                    "text": u.text,
                    "timestamp": u.timestamp,
                    "language": u.language,
                }
                for u in m.utterances
            ]
        })

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "platform": "ConverseIQ Academic Meeting Intelligence Platform",
        "user_profile": {
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "designation": current_user.designation,
            "phone": current_user.phone,
            "department": current_user.department.name if current_user.department else None,
        },
        "total_meetings_exported": len(meetings_export),
        "meetings": meetings_export,
    }
