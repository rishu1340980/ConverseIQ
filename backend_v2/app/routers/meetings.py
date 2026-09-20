import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import datetime, timezone, timedelta
from backend_v2.app.core.config import settings
from backend_v2.app.core.database import get_db
from backend_v2.app.core.dependencies import get_current_user
from backend_v2.app.models.user import User
from backend_v2.app.models.meeting import Meeting
from backend_v2.app.models.mom import MinutesOfMeeting
from backend_v2.app.models.transcript import Utterance
from backend_v2.app.models.action_item import ActionItem
from backend_v2.app.models.participant import MeetingParticipant
from backend_v2.app.services.ai_pipeline import transcribe_audio_with_diarization, generate_mom_and_actions

router = APIRouter(prefix="/meetings", tags=["Meetings"])

class CreateMeetingRequest(BaseModel):
    title: str
    duration_minutes: Optional[int] = 45
    participants: Optional[str] = None  # Comma-separated names
    date: Optional[datetime] = None
    status: Optional[str] = "Analysis Complete"

class MapAttendeeRequest(BaseModel):
    speaker_label: str
    real_name: str

def format_meeting_response(m: Meeting) -> dict:
    # Format utterances
    utterances_list = []
    if m.utterances:
        for u in m.utterances:
            utterances_list.append({
                "id": u.id,
                "speaker": u.speaker_name or u.speaker_label or "Speaker A",
                "raw_speaker": u.speaker_label or "Speaker A",
                "text": u.text,
                "translation": u.english_translation,
                "language": u.language or "English",
                "timestamp": u.timestamp or "00:00",
            })

    # Format MoM
    mom_dict = None
    if m.mom:
        topics = m.mom.agenda_topics or []
        # Support both topics_discussed format
        mom_dict = {
            "id": m.mom.id,
            "meeting_id": m.id,
            "summary": m.mom.summary or "",
            "decisions": m.mom.decisions or [],
            "topics_discussed": topics,
            "is_finalized": m.mom.is_finalized or False,
            "finalized_at": m.mom.finalized_at.isoformat() if m.mom.finalized_at else None,
            "utterances": utterances_list,
        }

    # Format Action Items
    actions_list = []
    if m.action_items:
        for it in m.action_items:
            actions_list.append({
                "id": it.id,
                "meeting_id": m.id,
                "task": it.task,
                "owner_name": it.owner_name or "Assigned Faculty",
                "priority": it.priority or "Medium",
                "status": it.status or "Pending",
                "due_date": it.due_date.isoformat() if it.due_date else None,
            })

    # Format Participants
    participants_list = []
    if m.participants:
        for p in m.participants:
            participants_list.append({
                "id": p.id,
                "name": p.name,
                "speaker_label": p.speaker_label,
            })
    elif m.user:
        participants_list.append({
            "id": 1,
            "name": m.user.name,
            "speaker_label": "Host",
        })

    return {
        "id": m.id,
        "title": m.title,
        "date": m.date.isoformat() if m.date else datetime.now(timezone.utc).isoformat(),
        "duration_minutes": m.duration_minutes or 45,
        "status": m.status or "Analysis Complete",
        "created_by_id": m.user_id,
        "participant_count": len(participants_list) if participants_list else 1,
        "participants": participants_list,
        "mom": mom_dict,
        "action_items": actions_list,
    }

@router.get("")
async def list_meetings(
    search: Optional[str] = None,
    sort: Optional[str] = "newest",
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items),
            selectinload(Meeting.utterances),
            selectinload(Meeting.user),
        )
    )

    # HOD sees all meetings in their department (all faculty)
    # Faculty sees only their own meetings
    if current_user.role == "HOD":
        stmt = stmt.filter(Meeting.department_id == current_user.department_id)
    elif current_user.role == "Faculty":
        stmt = stmt.filter(Meeting.user_id == current_user.id)
    # Admin sees all — no filter

    if search:
        stmt = stmt.filter(Meeting.title.ilike(f"%{search.strip()}%"))

    # Month/year filter
    if month and year:
        from sqlalchemy import extract
        stmt = stmt.filter(
            extract("month", Meeting.date) == month,
            extract("year", Meeting.date) == year,
        )
    elif year:
        from sqlalchemy import extract
        stmt = stmt.filter(extract("year", Meeting.date) == year)

    if sort == "oldest":
        stmt = stmt.order_by(Meeting.date.asc())
    else:
        stmt = stmt.order_by(Meeting.date.desc())

    result = await db.execute(stmt)
    meetings = result.scalars().all()

    return [format_meeting_response(m) for m in meetings]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_meeting(
    payload: CreateMeetingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_meeting = Meeting(
        title=payload.title.strip(),
        duration_minutes=payload.duration_minutes or 45,
        status=payload.status or "Analysis Complete",
        user_id=current_user.id,
        department_id=current_user.department_id,
        date=payload.date if payload.date else datetime.now(timezone.utc)
    )
    db.add(new_meeting)
    await db.flush()

    # Add participants if provided
    if payload.participants:
        names = [n.strip() for n in payload.participants.split(",") if n.strip()]
        for idx, name in enumerate(names):
            label = f"Speaker {chr(65 + idx)}"
            p = MeetingParticipant(meeting_id=new_meeting.id, name=name, speaker_label=label)
            db.add(p)
    else:
        db.add(MeetingParticipant(meeting_id=new_meeting.id, name=current_user.name, speaker_label="Speaker A"))

    # Add blank MoM entry
    mom = MinutesOfMeeting(
        meeting_id=new_meeting.id,
        summary="Live meeting recorded. Review summary and action items below.",
        decisions=[],
        agenda_topics=[],
        is_finalized=False
    )
    db.add(mom)

    await db.commit()
    await db.refresh(new_meeting)

    # Reload with relationships
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items),
            selectinload(Meeting.utterances),
            selectinload(Meeting.user),
        )
        .filter(Meeting.id == new_meeting.id)
    )
    res = await db.execute(stmt)
    full_meeting = res.scalar_one()

    return format_meeting_response(full_meeting)

@router.post("/upload-and-analyze")
async def upload_and_analyze_meeting(
    file: UploadFile = File(...),
    title: str = Form("Faculty Meeting Recording"),
    participants: Optional[str] = Form(""),
    duration_minutes: Optional[int] = Form(45),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Direct 1-step audio upload & AI analysis.
    Transcribes audio with AssemblyAI / multi-speaker diarization,
    and extracts structured MoM & action items with Google Gemini Pro.
    """
    meeting_title = title.strip() if title else "Faculty Meeting Recording"

    # 1. Create meeting record
    new_meeting = Meeting(
        title=meeting_title,
        duration_minutes=duration_minutes or 45,
        status="Completed",
        user_id=current_user.id,
        department_id=current_user.department_id,
        date=datetime.now(timezone.utc)
    )
    db.add(new_meeting)
    await db.flush()

    # 2. Save uploaded audio file locally
    meeting_dir = os.path.join(settings.UPLOAD_DIR, f"meeting_{new_meeting.id}")
    os.makedirs(meeting_dir, exist_ok=True)
    filename = os.path.basename(file.filename or "recording.mp3")
    file_path = os.path.join(meeting_dir, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Build participant roster and speaker mapping (only if provided by user)
    mapping = {}
    participant_names = []
    if participants and participants.strip():
        parsed = [p.strip() for p in participants.split(",") if p.strip()]
        for idx, name in enumerate(parsed):
            label = f"Speaker {chr(65 + idx)}"
            mapping[label] = name
            participant_names.append(name)

    # 4. Transcribe audio with multi-speaker diarization
    transcription_data = await transcribe_audio_with_diarization(
        file_path,
        speaker_mapping=mapping,
        participants=participant_names,
        meeting_title=meeting_title
    )
    transcript_text = transcription_data.get("text", "")
    utterances_list = transcription_data.get("utterances", [])

    # Collect actual speakers from speech/transcription
    distinct_speakers = {}
    for u in utterances_list:
        raw_spk = u.get("raw_speaker") or "Speaker A"
        spk_name = u.get("speaker") or raw_spk
        if raw_spk not in distinct_speakers:
            distinct_speakers[raw_spk] = spk_name

        utt = Utterance(
            meeting_id=new_meeting.id,
            speaker_label=raw_spk,
            speaker_name=spk_name,
            timestamp=u.get("timestamp") or "00:00",
            language=u.get("language") or "English",
            text=u.get("text") or "",
            english_translation=u.get("translation") or u.get("text") or ""
        )
        db.add(utt)

    # Register real participants
    if participant_names:
        for idx, name in enumerate(participant_names):
            label = f"Speaker {chr(65 + idx)}"
            db.add(MeetingParticipant(meeting_id=new_meeting.id, name=name, speaker_label=label))
    elif distinct_speakers:
        for label, name in distinct_speakers.items():
            db.add(MeetingParticipant(meeting_id=new_meeting.id, name=name, speaker_label=label))
    else:
        db.add(MeetingParticipant(meeting_id=new_meeting.id, name=current_user.name or "Host", speaker_label="Host"))

    # 5. Extract strictly grounded MoM (no hallucinations, no extra fake actions/decisions)
    mom_data = await generate_mom_and_actions(
        transcript_text=transcript_text,
        participants=participant_names or list(distinct_speakers.values()),
        meeting_title=meeting_title
    )

    new_mom = MinutesOfMeeting(
        meeting_id=new_meeting.id,
        summary=mom_data.get("summary", ""),
        decisions=mom_data.get("decisions", []),
        agenda_topics=mom_data.get("topics_discussed", []),
        is_finalized=False
    )
    db.add(new_mom)

    # 6. Save Action Items with calculated deadlines and faculty ownership
    for it in mom_data.get("action_items", []):
        days = it.get("days_until_due", 3)
        due = datetime.now(timezone.utc) + timedelta(days=days)
        action_item = ActionItem(
            meeting_id=new_meeting.id,
            task=it.get("task") or "Institutional Follow-up",
            owner_name=it.get("owner_name") or "Assigned Faculty",
            priority=it.get("priority") or "Medium",
            status="Pending",
            due_date=due,
            user_id=current_user.id
        )
        db.add(action_item)

    await db.commit()
    await db.refresh(new_meeting)

    return {
        "status": "success",
        "message": "Meeting recording analyzed successfully",
        "meeting_id": new_meeting.id,
        "title": new_meeting.title
    }

@router.get("/{meeting_id}")
async def get_meeting_detail(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.participants),
            selectinload(Meeting.mom),
            selectinload(Meeting.action_items),
            selectinload(Meeting.utterances),
            selectinload(Meeting.user),
        )
        .filter(Meeting.id == meeting_id)
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )

    return format_meeting_response(meeting)

@router.post("/{meeting_id}/map-attendees")
async def map_attendee(
    meeting_id: int,
    payload: MapAttendeeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.utterances),
            selectinload(Meeting.participants),
        )
        .filter(Meeting.id == meeting_id)
    )
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Update utterances
    label = payload.speaker_label.strip()
    real_name = payload.real_name.strip()

    updated_count = 0
    for u in meeting.utterances:
        if u.speaker_label == label or u.speaker_name == label:
            u.speaker_name = real_name
            updated_count += 1

    # Update or add participant
    participant = next((p for p in meeting.participants if p.speaker_label == label), None)
    if participant:
        participant.name = real_name
    else:
        new_p = MeetingParticipant(
            meeting_id=meeting.id,
            name=real_name,
            speaker_label=label
        )
        db.add(new_p)

    await db.commit()

    return {
        "status": "success",
        "message": f"Successfully mapped '{label}' to '{real_name}'. {updated_count} utterances updated.",
        "speaker_label": label,
        "real_name": real_name
    }
