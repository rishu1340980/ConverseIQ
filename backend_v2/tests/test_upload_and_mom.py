import pytest
import io
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app
from backend_v2.app.core.security import create_access_token

@pytest.mark.asyncio
async def test_upload_and_analyze_flow():
    token = create_access_token(data={"sub": "prof.sharma@converseiq.edu", "role": "Faculty"})
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test POST /api/v1/meetings/upload-and-analyze
        dummy_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
        files = {"file": ("test_recording.wav", dummy_audio, "audio/wav")}
        data = {
            "title": "Computer Science Curriculum Board Meeting",
            "participants": "Prof. Sharma, Dr. Anita Rao, Prof. Mishra",
            "duration_minutes": "50"
        }

        resp = await client.post("/api/v1/meetings/upload-and-analyze", data=data, files=files, headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        res_data = resp.json()
        assert "meeting_id" in res_data
        meeting_id = res_data["meeting_id"]

        # 2. Test GET /api/v1/meetings/{id}
        resp_detail = await client.get(f"/api/v1/meetings/{meeting_id}", headers=headers)
        assert resp_detail.status_code == 200
        detail = resp_detail.json()
        assert detail["title"] == "Computer Science Curriculum Board Meeting"
        assert len(detail["participants"]) == 3
        assert detail["mom"] is not None
        assert "summary" in detail["mom"]
        assert len(detail["action_items"]) > 0

        # 3. Test PUT /api/v1/mom/{id}
        put_resp = await client.put(
            f"/api/v1/mom/{meeting_id}",
            json={
                "summary": "Updated executive summary after faculty review.",
                "decisions": ["Finalized revised lab timetable.", "Approved AI course elective."]
            },
            headers=headers
        )
        assert put_resp.status_code == 200
        assert put_resp.json()["mom"]["summary"] == "Updated executive summary after faculty review."

        # 4. Test POST /api/v1/mom/{id}/finalize
        fin_resp = await client.post(f"/api/v1/mom/{meeting_id}/finalize", headers=headers)
        assert fin_resp.status_code == 200
        assert fin_resp.json()["mom"]["is_finalized"] is True

        print("\nAll upload, MoM generation, update, and finalize tests passed successfully!")

