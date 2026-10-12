import os
import shutil
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, BackgroundTasks
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
from app.services.email_service import email_service, resolve_faculty_email
from app.services.rag_service import hybrid_search_meetings

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
    token = secrets.token_urlsafe(24)

    new_meeting = Meeting(
        title=meeting_in.title,
        date=meeting_in.date,
        duration_minutes=meeting_in.duration_minutes,
        status=meeting_in.status,
        created_by_id=current_user.id,
        department_id=dept_id,
        meeting_link_token=token
    )
    db.add(new_meeting)
    await db.commit()
    await db.refresh(new_meeting)

    # Seed participants if provided
    join_url = f"https://converseiq.apsit.edu.in/studio?meeting_id={new_meeting.id}&token={token}"
    date_str = new_meeting.date.strftime("%B %d, %Y at %I:%M %p")

    if meeting_in.participants:
        for idx, name in enumerate(meeting_in.participants):
            p_name = name.strip()
            label = f"Speaker {chr(65 + idx)}"  # Speaker A, Speaker B, etc.
            # Resolve to exact institutional college email
            p_email = resolve_faculty_email(p_name)
            
            part = Participant(
                meeting_id=new_meeting.id,
                name=p_name,
                email=p_email,
                speaker_label=label,
                attended=False,
                speaking_time_seconds=0
            )
            db.add(part)
            # Dispatch email invite
            email_service.send_meeting_invite(
                to_email=p_email,
                faculty_name=p_name,
                meeting_title=new_meeting.title,
                meeting_date=date_str,
                join_url=join_url,
                organizer_name=current_user.name
            )
        await db.commit()

    # Re-fetch with relationships
    stmt = select(Meeting).options(selectinload(Meeting.participants)).where(Meeting.id == new_meeting.id)
    res = await db.execute(stmt)
    saved_meeting = res.scalar_one()

    await log_audit_event(
        db=db,
        action="Meeting Created",
        details=f"Meeting '{saved_meeting.title}' created by {current_user.email}. Live token generated.",
        severity="Info",
        user_id=current_user.id,
        resource_type="Meeting",
        resource_id=saved_meeting.id
    )

    resp = MeetingResponse.model_validate(saved_meeting)
    resp.participant_count = len(saved_meeting.participants)
    resp.meeting_link_token = saved_meeting.meeting_link_token
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
        participant_objs = []
        p_list = [p.strip() for p in participants.split(",") if p.strip()]
        for idx, name in enumerate(p_list):
            label = f"Speaker {chr(65 + idx)}"
            part = Participant(
                meeting_id=new_meeting.id,
                name=name,
                speaker_label=label
            )
            db.add(part)
            participant_objs.append(part)
            mapping[label] = name
            participant_names.append(name)

    # If no participants were explicitly passed in the form, seed default faculty roster
    if not participant_names:
        default_roster = [current_user.name or "Dr. Faculty", "Prof. Vedant", "Prof. Unnati", "Prof. Manthan"]
        for idx, name in enumerate(default_roster):
            label = f"Speaker {chr(65 + idx)}"
            part = Participant(
                meeting_id=new_meeting.id,
                name=name,
                speaker_label=label
            )
            db.add(part)
            participant_objs.append(part)
            mapping[label] = name
            participant_names.append(name)

    # Save audio file
    meeting_dir = os.path.join(settings.UPLOAD_DIR, f"meeting_{new_meeting.id}")
    os.makedirs(meeting_dir, exist_ok=True)
    filename = os.path.basename(file.filename or "recording.mp3")
    file_path = os.path.join(meeting_dir, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_meeting.audio_file_path = file_path

    # Query enrolled faculty voiceprints for automatic acoustic speaker identification
    enrolled_stmt = select(User).where(User.voice_enrolled == True, User.voice_embedding.isnot(None))
    enrolled_res = await db.execute(enrolled_stmt)
    enrolled_roster = [
        {"name": u.name, "voice_embedding": u.voice_embedding}
        for u in enrolled_res.scalars().all()
    ]

    # Diarize and transcribe with Gemini 3.6 Flash bilingual multimodal engine + voiceprint matching
    transcription_data = await transcribe_audio_with_diarization(
        file_path, mapping, participants=participant_names, enrolled_users=enrolled_roster
    )
    transcript_text = transcription_data.get("text", "")
    utterances = transcription_data.get("utterances", [])

    # Calculate speaking time and attendance per participant from utterances
    speaker_durations: Dict[str, float] = {}
    for u in utterances:
        spk = u.get("speaker")
        start_ms = u.get("start", 0) or 0
        end_ms = u.get("end", 0) or 0
        dur_sec = max(0.0, (end_ms - start_ms) / 1000.0)
        if spk:
            speaker_durations[spk] = speaker_durations.get(spk, 0.0) + dur_sec

    # Update participant attendance and speaking durations
    for p in participant_objs:
        spk_time = 0
        for s_name, s_dur in speaker_durations.items():
            if s_name.lower() in p.name.lower() or p.name.lower() in s_name.lower():
                spk_time += int(s_dur)
        if spk_time > 0:
            p.speaking_time_seconds = spk_time
            p.attended = True
            if not p.joined_at:
                p.joined_at = datetime.now(timezone.utc)

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
    cached_participants = list(meeting.participants)
    await db.commit()

    # Build speaker mapping dictionary from participants
    mapping = {}
    participant_names = []
    for p in cached_participants:
        participant_names.append(p.name)
        if p.speaker_label:
            mapping[p.speaker_label] = p.name

    if not participant_names:
        participant_names = [current_user.name or "Dr. Faculty", "Prof. Vedant", "Prof. Unnati", "Prof. Manthan"]

    # Query enrolled faculty voiceprints for automatic acoustic speaker identification
    enrolled_stmt = select(User).where(User.voice_enrolled == True, User.voice_embedding.isnot(None))
    enrolled_res = await db.execute(enrolled_stmt)
    enrolled_roster = [
        {"name": u.name, "voice_embedding": u.voice_embedding}
        for u in enrolled_res.scalars().all()
    ]

    # 1. Transcribe audio with Gemini 3.6 Flash bilingual diarization + voiceprint matching
    transcription_data = await transcribe_audio_with_diarization(
        file_path, mapping, participants=participant_names, enrolled_users=enrolled_roster
    )
    transcript_text = transcription_data.get("text", "")
    utterances = transcription_data.get("utterances", [])

    # Calculate speaking time and attendance per participant from utterances
    speaker_durations: Dict[str, float] = {}
    for u in utterances:
        spk = u.get("speaker")
        start_ms = u.get("start", 0) or 0
        end_ms = u.get("end", 0) or 0
        dur_sec = max(0.0, (end_ms - start_ms) / 1000.0)
        if spk:
            speaker_durations[spk] = speaker_durations.get(spk, 0.0) + dur_sec

    # Update participant attendance and speaking durations
    for p in cached_participants:
        spk_time = 0
        for s_name, s_dur in speaker_durations.items():
            if s_name.lower() in p.name.lower() or p.name.lower() in s_name.lower():
                spk_time += int(s_dur)
        if spk_time > 0:
            p.speaking_time_seconds = spk_time
            p.attended = True
            if not p.joined_at:
                p.joined_at = datetime.now(timezone.utc)

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

@router.get("/search/hybrid")
async def search_meetings_hybrid(
    q: str = Query("", description="Natural language semantic search query or keyword"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    date_from: Optional[datetime] = Query(None, description="Start date filter"),
    date_to: Optional[datetime] = Query(None, description="End date filter"),
    speaker: Optional[str] = Query(None, description="Filter by faculty speaker name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by meeting status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Hybrid Search API:
    Executes semantic context retrieval combined with multi-faceted metadata filtering
    (department, date range, speaker, status).
    """
    results = await hybrid_search_meetings(
        db=db,
        user_id=current_user.id,
        query=q,
        department_id=department_id,
        date_from=date_from,
        date_to=date_to,
        speaker=speaker,
        status=status_filter
    )
    return {
        "query": q,
        "total_matches": len(results),
        "results": results
    }

@router.post("/{meeting_id}/join")
async def join_live_meeting_and_record_attendance(
    meeting_id: int,
    token: Optional[str] = Query(None, description="Meeting join token"),
    faculty_name: Optional[str] = Query(None, description="Name of joining faculty"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Join live meeting studio and mark attendance timestamp.
    Verifies meeting token or authenticated faculty account.
    """
    stmt = select(Meeting).options(selectinload(Meeting.participants)).where(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if token and meeting.meeting_link_token and token != meeting.meeting_link_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid meeting join token")

    # Match participant by user email or name
    target_name = faculty_name or current_user.name
    now_utc = datetime.now(timezone.utc)
    matched_p = None

    for p in meeting.participants:
        if p.email and current_user.email and p.email.lower() == current_user.email.lower():
            matched_p = p
            break
        elif target_name and target_name.lower() in p.name.lower():
            matched_p = p
            break

    if matched_p:
        matched_p.attended = True
        matched_p.joined_at = now_utc
    else:
        # Create attendee participant record if not previously in the roster
        label = f"Speaker {chr(65 + len(meeting.participants))}"
        matched_p = Participant(
            meeting_id=meeting.id,
            name=target_name or current_user.name or "Attending Faculty",
            email=current_user.email,
            speaker_label=label,
            attended=True,
            joined_at=now_utc,
            speaking_time_seconds=0
        )
        db.add(matched_p)

    await db.commit()

    return {
        "success": True,
        "message": f"Attendance successfully recorded for {matched_p.name}",
        "meeting_id": meeting.id,
        "participant_id": matched_p.id,
        "joined_at": now_utc.isoformat(),
        "attended": True
    }

@router.get("/{meeting_id}/attendance")
async def get_meeting_attendance_report(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns verified meeting attendance report including attendees, absentees,
    join timestamps, and calculated speaking participation.
    """
    stmt = (
        select(Meeting)
        .options(selectinload(Meeting.participants))
        .where(Meeting.id == meeting_id)
    )
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if current_user.role != "Admin" and meeting.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")

    total = len(meeting.participants)
    present_list = []
    absent_list = []
    total_speaking = sum(p.speaking_time_seconds for p in meeting.participants) or 1

    for p in meeting.participants:
        pct = round((p.speaking_time_seconds / total_speaking) * 100, 1)
        record = {
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "speaker_label": p.speaker_label,
            "attended": p.attended,
            "joined_at": p.joined_at.isoformat() if p.joined_at else None,
            "speaking_time_seconds": p.speaking_time_seconds,
            "speaking_percentage": pct
        }
        if p.attended or p.speaking_time_seconds > 0:
            present_list.append(record)
        else:
            absent_list.append(record)

    attendance_rate = round((len(present_list) / max(1, total)) * 100, 1)

    return {
        "meeting_id": meeting.id,
        "title": meeting.title,
        "date": meeting.date.isoformat(),
        "total_invitees": total,
        "present_count": len(present_list),
        "absent_count": len(absent_list),
        "attendance_rate_percentage": attendance_rate,
        "attendees": present_list,
        "absentees": absent_list
    }
