import pytest
import io
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_meeting_upload_and_diarization_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login as default seeded HOD or faculty
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        assert login_res.status_code == 200, login_res.text
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Upload and analyze meeting directly
        # Create a small dummy audio file in memory
        dummy_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
        files = {"file": ("faculty_meeting.wav", dummy_audio, "audio/wav")}
        data = {
            "title": "Semester Curriculum & Timetable Review",
            "participants": "Dr. Ananya Sharma, Prof. Kavya Rao, Prof. Mehta",
            "duration_minutes": "45"
        }

        upload_res = await client.post(
            "/api/v1/meetings/upload-and-analyze",
            headers=headers,
            data=data,
            files=files
        )
        assert upload_res.status_code == 200, upload_res.text
        meeting_id = upload_res.json()["meeting_id"]

        # 3. Fetch meeting detail
        detail_res = await client.get(f"/api/v1/meetings/{meeting_id}", headers=headers)
        assert detail_res.status_code == 200, detail_res.text
        meeting_data = detail_res.json()

        assert meeting_data["title"] == "Semester Curriculum & Timetable Review"
        assert meeting_data["status"] == "Completed"
        
        # Check MoM
        mom = meeting_data.get("mom")
        assert mom is not None
        assert len(mom["summary"]) > 0
        assert len(mom["decisions"]) > 0
        assert isinstance(mom["utterances"], list)
        assert len(mom["utterances"]) > 0

        # Verify language tags & faculty diarization
        for u in mom["utterances"]:
            assert u["speaker"] in ["Dr. Ananya Sharma", "Prof. Kavya Rao", "Prof. Mehta"]
            assert u.get("language") in ["Hindi", "English", "Hinglish"]
            assert "text" in u
            assert "translation" in u

        # Check Action items with real faculty names
        action_items = meeting_data.get("action_items", [])
        assert len(action_items) > 0
        for act in action_items:
            assert act["owner_name"] in ["Dr. Ananya Sharma", "Prof. Kavya Rao", "Prof. Mehta"]
            assert act["priority"] in ["High", "Medium", "Low"]
            assert act["due_date"] is not None
