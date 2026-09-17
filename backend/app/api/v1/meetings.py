import os
import shutil
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit_logger import log_audit_event
from app.models.user import User
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.schemas.meeting import MeetingCreate, MeetingResponse, MeetingDetailResponse, MeetingUpdate
from app.schemas.participant import SpeakerMappingUpdate
from app.services.transcription import transcribe_audio_with_diarization
from app.services.llm_analysis import generate_mom_and_actions

router = APIRouter(prefix="/meetings", tags=["Meetings"])

@router.get("", response_model=List[MeetingResponse])
async def list_meetings(
    search: Optional[str] = Query(None, description="Search by meeting title"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    sort_by: str = Query("date", description="Sort field: 'date', 'title', 'duration_minutes'"),
    sort_order: str = Query("desc", description="'asc' or 'desc'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List meetings.
    - Faculty/HOD sees their own meetings (or their department's meetings).
    - Admin sees all meetings across the institution.
    - Searchable by title and sortable.
    """
    stmt = select(Meeting).options(selectinload(Meeting.participants))

    if current_user.role != "Admin":
        stmt = stmt.where(Meeting.created_by_id == current_user.id)

    if search:
        stmt = stmt.where(Meeting.title.ilike(f"%{search}%"))

    if status_filter:
        stmt = stmt.where(Meeting.status == status_filter)

    # Sorting
    order_col = Meeting.date
    if sort_by == "title":
        order_col = Meeting.title
    elif sort_by == "duration_minutes":
        order_col = Meeting.duration_minutes

    stmt = stmt.order_by(order_col.asc() if sort_order == "asc" else order_col.desc())

    result = await db.execute(stmt)
    meetings = result.scalars().all()
    
    resp = []
    for m in meetings:
        item = MeetingResponse.model_validate(m)
        item.participant_count = len(m.participants)
        resp.append(item)
    return resp

@router.post("", response_model=MeetingResponse)
async def create_meeting(
    meeting_in: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new meeting with attendee names.
    """
    dept_id = meeting_in.department_id or current_user.department_id

    new_meeting = Meeting(
        title=meeting_in.title,
        date=meeting_in.date,
        duration_minutes=meeting_in.duration_minutes,
        status=meeting_in.status,
        created_by_id=current_user.id,
        department_id=dept_id
    )
    db.add(new_meeting)
    await db.commit()
    await db.refresh(new_meeting)

    # Seed participants if provided
    if meeting_in.participants:
        for idx, name in enumerate(meeting_in.participants):
            label = f"Speaker {chr(65 + idx)}"  # Speaker A, Speaker B, etc.
            part = Participant(
                meeting_id=new_meeting.id,
                name=name.strip(),
                speaker_label=label
            )
            db.add(part)
        await db.commit()

    # Re-fetch with relationships
    stmt = select(Meeting).options(selectinload(Meeting.participants)).where(Meeting.id == new_meeting.id)
    res = await db.execute(stmt)
    saved_meeting = res.scalar_one()

    await log_audit_event(
        db=db,
        action="Meeting Created",
        details=f"Meeting '{saved_meeting.title}' created by {current_user.email}",
        severity="Info",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=saved_meeting.id
    )

    resp = MeetingResponse.model_validate(saved_meeting)
    resp.participant_count = len(saved_meeting.participants)
    return resp

@router.post("/upload-and-analyze")
async def upload_and_analyze_meeting(
    title: str = Form("Faculty Meeting Recording"),
    participants: Optional[str] = Form(""),
    duration_minutes: Optional[int] = Form(45),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Direct 1-step upload & analyze.
    Creates meeting, stores audio recording, runs speaker diarization and LLM MoM extraction.
    """
    new_meeting = Meeting(
        title=title,
        date=datetime.now(timezone.utc),
        duration_minutes=duration_minutes or 45,
        status="Processing",
        created_by_id=current_user.id,
        department_id=current_user.department_id
    )
    db.add(new_meeting)
    await db.commit()
    await db.refresh(new_meeting)

    # Seed participants & speaker mapping
    mapping = {}
    participant_names = []
    if participants:
        p_list = [p.strip() for p in participants.split(",") if p.strip()]
        for idx, name in enumerate(p_list):
            label = f"Speaker {chr(65 + idx)}"
            part = Participant(
                meeting_id=new_meeting.id,
                name=name,
                speaker_label=label
            )
            db.add(part)
            mapping[label] = name
            participant_names.append(name)
        await db.commit()

    # If no participants were explicitly passed in the form, seed default faculty roster
    if not participant_names:
        default_roster = [current_user.name or "Dr. Faculty", "Prof. Mehta", "Dr. Ananya Sharma", "Prof. Kavya Rao"]
        for idx, name in enumerate(default_roster):
            label = f"Speaker {chr(65 + idx)}"
            part = Participant(
                meeting_id=new_meeting.id,
                name=name,
                speaker_label=label
            )
            db.add(part)
            mapping[label] = name
            participant_names.append(name)
        await db.commit()

    # Save audio file
    meeting_dir = os.path.join(settings.UPLOAD_DIR, f"meeting_{new_meeting.id}")
    os.makedirs(meeting_dir, exist_ok=True)
    filename = os.path.basename(file.filename or "recording.mp3")
    file_path = os.path.join(meeting_dir, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_meeting.audio_file_path = file_path

    # Diarize and transcribe with Gemini 3.6 Flash bilingual multimodal engine
    transcription_data = await transcribe_audio_with_diarization(file_path, mapping, participants=participant_names)
    transcript_text = transcription_data.get("text", "")
    utterances = transcription_data.get("utterances", [])

    # Extract MoM with exact faculty ownership
    mom_data = await generate_mom_and_actions(transcript_text, participant_names)

    # Save MoM including full bilingual utterances
    new_mom = MinutesOfMeeting(
        meeting_id=new_meeting.id,
        summary=mom_data.get("summary", ""),
        decisions=mom_data.get("decisions", []),
        topics_discussed=mom_data.get("topics_discussed", []),
        raw_transcript=transcript_text,
        utterances=utterances,
        is_finalized=False
    )
    db.add(new_mom)

    # Save Action Items with real faculty names and calculated deadlines
    for item in mom_data.get("action_items", []):
        days = item.get("days_until_due", 3)
        due = datetime.now(timezone.utc) + timedelta(days=days)
        act = ActionItem(
            meeting_id=new_meeting.id,
            task=item.get("task", ""),
            owner_name=item.get("owner_name", "Unassigned"),
            priority=item.get("priority", "Medium"),
            status="Pending",
            due_date=due
        )
        db.add(act)

    new_meeting.status = "Completed"
    new_meeting.duration_minutes = max(15, len(transcript_text) // 50)
    await db.commit()

    await log_audit_event(
        db=db,
        action="Recording Uploaded Directly",
        details=f"Audio recorded directly for '{new_meeting.title}'. MoM generated.",
        severity="OK",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=new_meeting.id
    )

    return {
        "message": "Meeting recording uploaded and analyzed successfully",
        "meeting_id": new_meeting.id,
        "title": new_meeting.title,
        "status": new_meeting.status
    }

@router.get("/{meeting_id}", response_model=MeetingDetailResponse)
async def get_meeting_detail(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get meeting detail, participants, MoM, and action items.
    Security: Faculty cannot access another faculty member's meeting (HTTP 403).
    Admin can access any meeting.
    """
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items)
        )
        .where(Meeting.id == meeting_id)
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    # Enforce RBAC: Non-admin cannot access another user's meeting
    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have permission to view this meeting."
        )

    return meeting

@router.post("/{meeting_id}/upload-recording")
async def upload_meeting_recording(
    meeting_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload an audio/video recording for a meeting.
    Initiates transcription with speaker diarization and automated Minutes of Meeting extraction.
    """
    stmt = (
        select(Meeting)
        .options(selectinload(Meeting.participants), selectinload(Meeting.mom), selectinload(Meeting.action_items))
        .where(Meeting.id == meeting_id)
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    # Save audio file
    meeting_dir = os.path.join(settings.UPLOAD_DIR, f"meeting_{meeting_id}")
    os.makedirs(meeting_dir, exist_ok=True)
    filename = os.path.basename(file.filename or "recording.mp3")
    file_path = os.path.join(meeting_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    meeting.audio_file_path = file_path
    meeting.status = "Processing"
    await db.commit()

    # Build speaker mapping dictionary from participants
    mapping = {}
    participant_names = []
    for p in meeting.participants:
        participant_names.append(p.name)
        if p.speaker_label:
            mapping[p.speaker_label] = p.name

    if not participant_names:
        participant_names = [current_user.name or "Dr. Faculty", "Prof. Mehta", "Dr. Ananya Sharma", "Prof. Kavya Rao"]

    # 1. Transcribe audio with Gemini 3.6 Flash bilingual diarization
    transcription_data = await transcribe_audio_with_diarization(file_path, mapping, participants=participant_names)
    transcript_text = transcription_data.get("text", "")
    utterances = transcription_data.get("utterances", [])

    # 2. Extract structured MoM and Action Items with LLM
    mom_data = await generate_mom_and_actions(transcript_text, participant_names)

    # 3. Create or update MinutesOfMeeting record with utterances
    if meeting.mom:
        meeting.mom.summary = mom_data.get("summary", "")
        meeting.mom.decisions = mom_data.get("decisions", [])
        meeting.mom.topics_discussed = mom_data.get("topics_discussed", [])
        meeting.mom.raw_transcript = transcript_text
        meeting.mom.utterances = utterances
        meeting.mom.updated_at = datetime.now(timezone.utc)
    else:
        new_mom = MinutesOfMeeting(
            meeting_id=meeting.id,
            summary=mom_data.get("summary", ""),
            decisions=mom_data.get("decisions", []),
            topics_discussed=mom_data.get("topics_discussed", []),
            raw_transcript=transcript_text,
            utterances=utterances,
            is_finalized=False
        )
        db.add(new_mom)

    # 4. Create Action Items with real faculty names and calculated deadlines
    for item in mom_data.get("action_items", []):
        days = item.get("days_until_due", 3)
        due = datetime.now(timezone.utc) + timedelta(days=days)
        act = ActionItem(
            meeting_id=meeting.id,
            task=item.get("task", ""),
            owner_name=item.get("owner_name", "Unassigned"),
            priority=item.get("priority", "Medium"),
            status="Pending",
            due_date=due
        )
        db.add(act)

    meeting.status = "Completed"
    meeting.duration_minutes = max(15, len(transcript_text) // 50)
    await db.commit()

    await log_audit_event(
        db=db,
        action="Recording Processed",
        details=f"Audio processed for meeting '{meeting.title}'. MoM generated.",
        severity="OK",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=meeting.id
    )

    return {"message": "Meeting recording processed successfully", "meeting_id": meeting.id}

@router.post("/{meeting_id}/map-attendees")
async def map_meeting_attendees(
    meeting_id: int,
    mapping_data: SpeakerMappingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Feature 8: Map diarization label (e.g. 'Speaker A') to a real person ('Prof. Sharma').
    Updates the participant record and associated action items.
    """
    stmt = select(Meeting).options(selectinload(Meeting.participants), selectinload(Meeting.action_items)).where(Meeting.id == meeting_id)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    # Update or add participant
    found = False
    for p in meeting.participants:
        if p.speaker_label == mapping_data.speaker_label:
            p.name = mapping_data.real_name
            found = True
            break

    if not found:
        new_p = Participant(
            meeting_id=meeting.id,
            name=mapping_data.real_name,
            speaker_label=mapping_data.speaker_label
        )
        db.add(new_p)

    # Update action items where owner matched speaker label
    for item in meeting.action_items:
        if item.owner_name == mapping_data.speaker_label:
            item.owner_name = mapping_data.real_name

    await db.commit()
    return {"message": f"Successfully mapped {mapping_data.speaker_label} to {mapping_data.real_name}"}

@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a meeting and associated artifacts."""
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    await db.delete(meeting)
    await db.commit()

    await log_audit_event(
        db=db,
        action="Meeting Deleted",
        details=f"Meeting '{meeting.title}' deleted by {current_user.email}",
        severity="Warn",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=meeting_id
    )

    return {"message": "Meeting deleted successfully"}
