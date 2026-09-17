import pytest
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app

@pytest.mark.asyncio
async def test_meetings_full_workflow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create a Meeting
        create_res = await ac.post("/api/v1/meetings", headers=headers, json={
            "title": "Academic Council Curriculum Review 2026",
            "duration_minutes": 60,
            "participants": "Dr. Sharma, Dr. Priya Kapoor, Prof. Mehta"
        })
        assert create_res.status_code == 201
        m_data = create_res.json()
        assert m_data["title"] == "Academic Council Curriculum Review 2026"
        meeting_id = m_data["id"]
        assert len(m_data["participants"]) == 3

        # 3. List Meetings
        list_res = await ac.get("/api/v1/meetings", headers=headers)
        assert list_res.status_code == 200
        meetings = list_res.json()
        assert any(m["id"] == meeting_id for m in meetings)

        # 4. Search Meetings
        search_res = await ac.get("/api/v1/meetings?search=Curriculum", headers=headers)
        assert search_res.status_code == 200
        assert len(search_res.json()) >= 1

        # 5. Get Meeting Detail
        detail_res = await ac.get(f"/api/v1/meetings/{meeting_id}", headers=headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == meeting_id
        assert "mom" in detail
        assert "participants" in detail
        assert "action_items" in detail

        # 6. Map Attendees
        map_res = await ac.post(
            f"/api/v1/meetings/{meeting_id}/map-attendees",
            headers=headers,
            json={
                "speaker_label": "Speaker A",
                "real_name": "Prof. Sharma"
            }
        )
        assert map_res.status_code == 200
        map_data = map_res.json()
        assert map_data["status"] == "success"
        assert map_data["real_name"] == "Prof. Sharma"
