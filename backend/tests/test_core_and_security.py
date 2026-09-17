import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    check_login_rate_limit,
    record_failed_login,
    clear_failed_logins,
    failed_login_attempts
)
from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.models.participant import Participant
from app.services.exporter import generate_mom_pdf, generate_mom_docx

def test_password_hashing():
    pwd = "SecurePassword123"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_generation_and_decode():
    payload = {"sub": "42", "role": "Faculty", "email": "test@converseiq.edu"}
    token = create_access_token(payload, expires_delta=timedelta(hours=8))
    decoded = decode_token(token)
    assert decoded["sub"] == "42"
    assert decoded["role"] == "Faculty"
    assert "exp" in decoded

def test_login_rate_limiting_lockout_on_6th_attempt():
    key = "test_client_ip:user@test.com"
    clear_failed_logins(key)

    # First 5 failed attempts are allowed (recorded)
    for _ in range(5):
        record_failed_login(key)

    # 6th consecutive attempt triggers HTTP 429
    with pytest.raises(HTTPException) as exc_info:
        check_login_rate_limit(key)
    assert exc_info.value.status_code == 429
    assert "temporarily locked" in exc_info.value.detail

    # Clearing resets the counter
    clear_failed_logins(key)
    # Should not raise now
    check_login_rate_limit(key)

def test_pdf_export_generation():
    meeting = Meeting(
        id=1,
        title="Faculty Board of Studies",
        date=datetime.now(timezone.utc),
        duration_minutes=60,
        status="Completed"
    )
    p = Participant(meeting_id=1, name="Prof. Sharma", speaker_label="Speaker A")
    meeting.participants = [p]
    mom = MinutesOfMeeting(
        meeting_id=1,
        summary="Executive summary of discussions.",
        decisions=["Adopt revised syllabus", "Approve lab budget"],
        topics_discussed=[{"topic": "Curriculum", "points": ["New AI elective"]}],
        is_finalized=True
    )
    action_item = ActionItem(
        meeting_id=1,
        task="Upload syllabus to portal",
        owner_name="Prof. Sharma",
        priority="High",
        status="Pending"
    )

    pdf_buffer = generate_mom_pdf(meeting, mom, [action_item])
    pdf_bytes = pdf_buffer.getvalue()
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF")

def test_docx_export_generation():
    meeting = Meeting(
        id=2,
        title="Department Council Meeting",
        date=datetime.now(timezone.utc),
        duration_minutes=45,
        status="Completed"
    )
    mom = MinutesOfMeeting(
        meeting_id=2,
        summary="Council reviewed semester plans.",
        decisions=["Set examination dates"],
        topics_discussed=[],
        is_finalized=False
    )
    action_item = ActionItem(
        meeting_id=2,
        task="Draft roster",
        owner_name="Prof. Mishra",
        priority="Medium",
        status="Pending"
    )

    docx_buffer = generate_mom_docx(meeting, mom, [action_item])
    docx_bytes = docx_buffer.getvalue()
    assert len(docx_bytes) > 500
    # docx files are zip archives starting with PK
    assert docx_bytes.startswith(b"PK")
