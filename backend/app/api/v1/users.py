import re
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_roles, get_password_hash, get_current_user
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.models.meeting import Meeting
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
    FacultyDirectoryItem,
    FacultyEmailUpdate,
    FacultyCreate
)

router = APIRouter(prefix="/users", tags=["User Management"])

@router.get("", response_model=List[dict])
async def list_users(
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 14: Admin view of all users including meeting count, join date, status.
    """
    stmt = select(User).options(selectinload(User.meetings), selectinload(User.department))
    res = await db.execute(stmt)
    users = res.scalars().all()

    output = []
    for u in users:
        output.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "department_id": u.department_id,
            "department_name": u.department.name if u.department else "Unassigned",
            "meeting_count": len(u.meetings),
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat()
        })
    return output

@router.post("/invite", response_model=UserResponse)
async def invite_user(
    user_in: UserCreate,
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Invite / create new user account."""
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        department_id=user_in.department_id,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await log_audit_event(
        db=db,
        action="User Created",
        details=f"Admin {current_user.email} created user {new_user.email} ({new_user.role})",
        severity="Info",
        user_id=current_user.id,
        resource_type="User",
        resource_id=new_user.id
    )

    return new_user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_up: UserUpdate,
    current_user: User = Depends(require_roles(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Update user role, status (active/suspended), or department."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_up.name is not None:
        target_user.name = user_up.name
    if user_up.role is not None:
        target_user.role = user_up.role
    if user_up.department_id is not None:
        target_user.department_id = user_up.department_id
    if user_up.is_active is not None:
        target_user.is_active = user_up.is_active

    await db.commit()
    await db.refresh(target_user)

    status_str = "Active" if target_user.is_active else "Suspended"
    await log_audit_event(
        db=db,
        action="User Updated",
        details=f"User {target_user.email} updated: Role={target_user.role}, Status={status_str}",
        severity="Warn" if not target_user.is_active else "Info",
        user_id=current_user.id,
        resource_type="User",
        resource_id=target_user.id
    )

    return target_user

import json
from fastapi import UploadFile, File
from app.core.security import get_current_user
from app.services.voice_service import voice_service

@router.post("/enroll-voice")
async def enroll_faculty_voice(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Enrolls faculty voiceprint sample. Extracts acoustic spectral signature
    and stores normalized embedding on the user profile for speaker identification.
    """
    audio_bytes = await file.read()
    if len(audio_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio sample is too short or empty. Please record at least 3 seconds of clear speech."
        )

    embedding = voice_service.extract_voice_embedding(audio_bytes)
    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.voice_embedding = json.dumps(embedding)
    user.voice_enrolled = True

    await db.commit()

    await log_audit_event(
        db=db,
        action="Voice Profile Enrolled",
        details=f"Faculty {current_user.email} enrolled voiceprint (64 dimensions)",
        severity="OK",
        user_id=current_user.id
    )

    return {
        "success": True,
        "message": f"Voice profile successfully enrolled for {current_user.name}",
        "voice_enrolled": True,
        "dimensions": len(embedding)
    }

@router.get("/voice-status")
async def get_voice_enrollment_status(
    current_user: User = Depends(get_current_user)
):
    """Returns current user voice enrollment status."""
    return {
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "voice_enrolled": bool(current_user.voice_enrolled)
    }

@router.delete("/enroll-voice")
async def delete_faculty_voice(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes enrolled voice signature."""
    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalar_one_or_none()
    if user:
        user.voice_enrolled = False
        user.voice_embedding = None
        await db.commit()
    return {"message": "Voice profile successfully removed"}

# ============================================================================
# FACULTY DIRECTORY & HOD-CONTROLLED EMAIL MANAGEMENT (SECTIONS 1A, 1B, 4)
# ============================================================================

@router.get("/faculty-directory", response_model=List[FacultyDirectoryItem])
async def get_faculty_directory(
    query: Optional[str] = Query(None, description="Search faculty by name"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Searchable Faculty Directory for meeting invitations and HOD management.
    Accessible to all authenticated users for meeting participant search.
    """
    stmt = (
        select(User)
        .options(selectinload(User.department))
        .where(User.role.in_(["Faculty", "HOD"]))
    )
    if query and query.strip():
        stmt = stmt.where(User.name.ilike(f"%{query.strip()}%"))

    stmt = stmt.order_by(User.name.asc())
    res = await db.execute(stmt)
    faculty_members = res.scalars().all()

    output = []
    for f in faculty_members:
        dept_name = f.department.name if f.department else "Information Technology"
        output.append(FacultyDirectoryItem(
            id=f.id,
            name=f.name,
            email=f.email,
            designation=f.designation or ("Head of Department (HOD)" if f.role == "HOD" else "Assistant Professor"),
            phone=f.phone,
            is_email_configured=bool(f.is_email_configured and f.email),
            is_active=f.is_active,
            department_name=dept_name
        ))
    return output

@router.put("/faculty/{faculty_id}/email", response_model=FacultyDirectoryItem)
async def update_faculty_email(
    faculty_id: int,
    payload: FacultyEmailUpdate,
    current_user: User = Depends(require_roles(["HOD", "Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    HOD-Controlled Faculty Email Configuration.
    Validates that the email belongs to @apsit.edu.in and prevents duplicates.
    """
    clean_email = payload.email.strip().lower()

    # Strict APSIT domain validation
    apsit_pattern = r"^[a-zA-Z0-9_.+-]+@apsit\.edu\.in$"
    if not re.match(apsit_pattern, clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid domain. Faculty email must belong to official @apsit.edu.in domain."
        )

    # Check for duplicate email across other users
    dup_stmt = select(User).where(User.email == clean_email, User.id != faculty_id)
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{clean_email}' is already registered with another faculty member."
        )

    # Fetch faculty user
    fac_stmt = select(User).options(selectinload(User.department)).where(User.id == faculty_id)
    fac_res = await db.execute(fac_stmt)
    target_faculty = fac_res.scalar_one_or_none()

    if not target_faculty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty member not found")

    old_email = target_faculty.email
    target_faculty.email = clean_email
    target_faculty.is_email_configured = True
    await db.commit()
    await db.refresh(target_faculty)

    await log_audit_event(
        db=db,
        action="Faculty Email Configured",
        details=f"HOD/Admin {current_user.email} configured email for {target_faculty.name}: '{old_email}' -> '{clean_email}'",
        severity="OK",
        user_id=current_user.id,
        resource_type="User",
        resource_id=target_faculty.id
    )

    dept_name = target_faculty.department.name if target_faculty.department else "Information Technology"
    return FacultyDirectoryItem(
        id=target_faculty.id,
        name=target_faculty.name,
        email=target_faculty.email,
        designation=target_faculty.designation,
        phone=target_faculty.phone,
        is_email_configured=True,
        is_active=target_faculty.is_active,
        department_name=dept_name
    )

@router.post("/faculty", response_model=FacultyDirectoryItem)
async def add_faculty_to_directory(
    payload: FacultyCreate,
    current_user: User = Depends(require_roles(["HOD", "Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    HOD/Admin: Add a new faculty member to the departmental directory.
    Email is optional; if provided, it must belong to @apsit.edu.in.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Faculty name is required.")

    # Check for duplicate name in directory
    existing_name_stmt = select(User).where(User.name.ilike(name))
    existing_name_res = await db.execute(existing_name_stmt)
    if existing_name_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faculty member '{name}' already exists in the directory."
        )

    clean_email = None
    is_configured = False
    if payload.email and payload.email.strip():
        clean_email = payload.email.strip().lower()
        apsit_pattern = r"^[a-zA-Z0-9_.+-]+@apsit\.edu\.in$"
        if not re.match(apsit_pattern, clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid domain. Faculty email must belong to official @apsit.edu.in domain."
            )
        dup_stmt = select(User).where(User.email == clean_email)
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' is already registered with another user."
            )
        is_configured = True

    new_faculty = User(
        name=name,
        email=clean_email,
        hashed_password=get_password_hash("Faculty@123"),
        role="Faculty",
        designation=payload.designation or "Assistant Professor",
        phone=payload.phone.strip() if payload.phone else None,
        department_id=current_user.department_id or 1,
        is_email_configured=is_configured,
        is_active=True
    )
    db.add(new_faculty)
    await db.commit()
    await db.refresh(new_faculty)

    await log_audit_event(
        db=db,
        action="Faculty Added to Directory",
        details=f"HOD/Admin {current_user.email} added '{new_faculty.name}' to directory.",
        severity="Info",
        user_id=current_user.id,
        resource_type="User",
        resource_id=new_faculty.id
    )

    return FacultyDirectoryItem(
        id=new_faculty.id,
        name=new_faculty.name,
        email=new_faculty.email,
        designation=new_faculty.designation,
        phone=new_faculty.phone,
        is_email_configured=new_faculty.is_email_configured,
        is_active=new_faculty.is_active,
        department_name="Information Technology"
    )
