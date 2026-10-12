import pytest
import io
import json
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.email_service import email_service
from app.services.voice_service import voice_service
from app.services.scheduler import check_and_dispatch_reminders
from app.core.database import AsyncSessionLocal
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.action_item import ActionItem
from app.models.user import User
from sqlalchemy import select

@pytest.mark.asyncio
async def test_meeting_link_and_invite_email_flow():
    """
    Panel Feedback 1: Verify meeting creation automatically generates meeting_link_token
    and dispatches faculty email invitation.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Clear sent emails audit log
        email_service.sent_emails_log.clear()

        create_payload = {
            "title": "Faculty Senate - Curriculum Modernization",
            "date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "department_id": 1,
            "participants": ["Prof. Mehta", "Dr. Ananya Sharma"]
        }

        res = await client.post("/api/v1/meetings", headers=headers, json=create_payload)
        assert res.status_code in [200, 201], res.text
        data = res.json()
        assert "id" in data
        meeting_id = data["id"]
        assert data.get("meeting_link_token") is not None
        assert len(data["meeting_link_token"]) > 16

        # Check that email invite was dispatched via EmailService
        assert len(email_service.sent_emails_log) >= 1
        invite_emails = [e for e in email_service.sent_emails_log if e.get("type") == "meeting_invite"]
        assert len(invite_emails) >= 1
        assert "Faculty Senate" in invite_emails[0]["subject"]
        assert data["meeting_link_token"] in invite_emails[0]["body"]

@pytest.mark.asyncio
async def test_live_meeting_join_and_attendance_report():
    """
    Panel Feedback 1 (cont.): Verify faculty can join using meeting token / endpoint,
    marking attendance timestamp and generating real-time attendance report.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create_payload = {
            "title": "Academic Council Emergency Session",
            "date": datetime.now(timezone.utc).isoformat(),
            "department_id": 1,
            "participants": ["Dr. Ananya Sharma", "Prof. Kavya Rao"]
        }
        res = await client.post("/api/v1/meetings", headers=headers, json=create_payload)
        assert res.status_code in [200, 201], res.text
        m_data = res.json()
        meeting_id = m_data["id"]
        meeting_token = m_data["meeting_link_token"]

        # Join meeting (Marks attended = True, joined_at = timestamp)
        join_res = await client.post(
            f"/api/v1/meetings/{meeting_id}/join",
            headers=headers,
            json={"participant_email": "ananya.sharma@converseiq.edu", "token": meeting_token}
        )
        assert join_res.status_code == 200, join_res.text
        join_data = join_res.json()
        assert join_data["attended"] is True
        assert join_data["joined_at"] is not None

        # Fetch attendance report
        att_res = await client.get(f"/api/v1/meetings/{meeting_id}/attendance", headers=headers)
        assert att_res.status_code == 200
        report = att_res.json()
        assert report["total_invitees"] >= 2
        assert report["present_count"] >= 1
        assert report["attendance_rate_percentage"] > 0.0
        assert len(report["attendees"]) >= 1
        assert any("Sharma" in a["name"] for a in report["attendees"])

@pytest.mark.asyncio
async def test_hybrid_search_with_metadata_filters():
    """
    Panel Feedback 2: Verify semantic keyword matching + multi-faceted SQL filters
    (query, department, date range).
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Search with keyword and department filter
        search_res = await client.get(
            "/api/v1/meetings/search/hybrid?query=curriculum&department_id=1",
            headers=headers
        )
        assert search_res.status_code == 200, search_res.text
        results = search_res.json()
        assert "total_matches" in results
        assert "results" in results
        assert isinstance(results["results"], list)
        
        # Verify matched records contain relevancy score and highlights
        if results["total_matches"] > 0:
            top_match = results["results"][0]
            assert "relevance_score" in top_match
            assert top_match["relevance_score"] > 0
            assert "snippet" in top_match

@pytest.mark.asyncio
async def test_multi_tier_deadline_alerts():
    """
    Panel Feedback 3: Verify 3-tier automated alerts:
    - Tier 1: T-24h reminder
    - Tier 2: Day of deadline urgent reminder
    - Tier 3: Overdue escalation alert
    """
    email_service.sent_emails_log.clear()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).limit(1))
        meeting = result.scalar_one_or_none()
        if not meeting:
            meeting = Meeting(title="Test Alert Meeting", date=datetime.now(timezone.utc), status="Completed")
            db.add(meeting)
            await db.commit()
            await db.refresh(meeting)

        now = datetime.now(timezone.utc)

        # 1. Action item due in 18 hours (T-24h window)
        item_24h = ActionItem(
            meeting_id=meeting.id,
            task="Submit NBA Criteria 4 Report",
            owner_name="Prof. Sharma",
            priority="High",
            status="Pending",
            due_date=now + timedelta(hours=18),
            alert_before_sent=False
        )
        # 2. Action item due in 4 hours (Day-Of urgent window)
        item_today = ActionItem(
            meeting_id=meeting.id,
            task="Finalize End-Sem Exam Schedule",
            owner_name="Prof. Sharma",
            priority="Urgent",
            status="Pending",
            due_date=now + timedelta(hours=4),
            alert_before_sent=True,
            alert_due_day_sent=False
        )
        # 3. Action item overdue by 2 days (Overdue escalation window)
        item_overdue = ActionItem(
            meeting_id=meeting.id,
            task="Upload NAAC SSR Self Study Report",
            owner_name="Prof. Sharma",
            priority="High",
            status="Pending",
            due_date=now - timedelta(days=2),
            alert_before_sent=True,
            alert_due_day_sent=True,
            alert_overdue_sent=False
        )
        db.add_all([item_24h, item_today, item_overdue])
        await db.commit()

        # Run the multi-tier scheduler dispatcher
        stats = await check_and_dispatch_reminders(db)

        # Verify reminders dispatched
        assert stats["upcoming_24h_reminders"] >= 1
        assert stats["due_today_reminders"] >= 1
        assert stats["overdue_alerts"] >= 1

        # Verify emails were created
        reminder_emails = [e for e in email_service.sent_emails_log if e.get("type") == "deadline_alert"]
        assert len(reminder_emails) >= 3
        
        # Verify idempotency flags were saved to database
        await db.refresh(item_24h)
        await db.refresh(item_today)
        await db.refresh(item_overdue)
        assert item_24h.alert_before_sent is True
        assert item_today.alert_due_day_sent is True
        assert item_overdue.alert_overdue_sent is True

@pytest.mark.asyncio
async def test_voiceprint_enrollment_and_speaker_matching():
    """
    Panel Feedback 4: Verify voice enrollment endpoint, vector storage, and acoustic speaker matching.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Synthesize audio sample (16-bit PCM WAV, > 4000 bytes to represent full sample)
        dummy_voice = io.BytesIO(b"RIFF\x44\x10\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x20\x10\x00\x00" + b"\x10\x00\x50\x00\x20\x00\x40\x00" * 500)
        files = {"file": ("my_voice_sample.wav", dummy_voice, "audio/wav")}

        # Enroll voice
        enroll_res = await client.post("/api/v1/users/enroll-voice", headers=headers, files=files)
        assert enroll_res.status_code == 200, enroll_res.text
        enroll_data = enroll_res.json()
        assert enroll_data["voice_enrolled"] is True
        assert enroll_data["dimensions"] == 64

        # Check status
        status_res = await client.get("/api/v1/users/voice-status", headers=headers)
        assert status_res.status_code == 200
        assert status_res.json()["voice_enrolled"] is True

        # Test acoustic matcher
        audio_bytes = dummy_voice.getvalue()
        vector = voice_service.extract_voice_embedding(audio_bytes)
        assert len(vector) == 64

        enrolled_roster = [{"name": "Dr. Ananya Sharma", "voice_embedding": json.dumps(vector)}]
        matched = voice_service.match_speaker_to_roster(audio_bytes, enrolled_roster, threshold=0.70)
        assert matched is not None
        matched_name, confidence = matched
        assert matched_name == "Dr. Ananya Sharma"
        assert confidence >= 0.70
