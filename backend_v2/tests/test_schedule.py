import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app
from backend_v2.app.core.security import create_access_token

@pytest.mark.asyncio
async def test_schedule_and_reminder_flow():
    hod_token = create_access_token(data={"sub": "hod.cs@converseiq.edu", "role": "HOD"})
    headers = {"Authorization": f"Bearer {hod_token}"}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test GET /api/v1/schedule/domains-and-years
        meta_resp = await client.get("/api/v1/schedule/domains-and-years", headers=headers)
        assert meta_resp.status_code == 200
        meta_data = meta_resp.json()
        assert "academic_years" in meta_data
        assert "domains" in meta_data
        assert len(meta_data["domains"]) >= 5

        # 2. Test POST /api/v1/schedule/events (HOD schedules an academic event)
        start_time = datetime.now(timezone.utc) + timedelta(days=2)
        event_payload = {
            "title": "Machine Learning Lab & Model Deployment",
            "description": "Hands-on lab covering PyTorch training and ONNX runtime optimization.",
            "academic_year": "3rd Year (B.Tech)",
            "target_batch": "CSE-3A & CSE-3B",
            "domain": "AI & Machine Learning",
            "event_type": "Lab Session",
            "delivery_mode": "Offline",
            "venue_or_link": "Lab 402 - Systems Lab",
            "start_time": start_time.isoformat(),
            "duration_minutes": 90,
            "faculty_name": "Prof. Sharma",
            "faculty_email": "prof.sharma@converseiq.edu",
            "send_email_invitation": True
        }

        create_resp = await client.post("/api/v1/schedule/events", json=event_payload, headers=headers)
        assert create_resp.status_code == 201, f"Expected 201, got {create_resp.status_code}: {create_resp.text}"
        res_json = create_resp.json()
        assert res_json["status"] == "success"
        event = res_json["event"]
        assert event["title"] == "Machine Learning Lab & Model Deployment"
        assert event["academic_year"] == "3rd Year (B.Tech)"
        assert event["domain"] == "AI & Machine Learning"
        event_id = event["id"]

        # 3. Test GET /api/v1/schedule/events (Filter by academic year and domain)
        filter_resp = await client.get("/api/v1/schedule/events?academic_year=3rd Year (B.Tech)", headers=headers)
        assert filter_resp.status_code == 200
        events_list = filter_resp.json()
        assert any(e["id"] == event_id for e in events_list)

        # 4. Test POST /api/v1/schedule/events/{id}/send-reminder (HOD sends manual email reminder)
        remind_resp = await client.post(f"/api/v1/schedule/events/{event_id}/send-reminder", headers=headers)
        assert remind_resp.status_code == 200
        remind_json = remind_resp.json()
        assert remind_json["status"] == "success"
        assert remind_json["reminder_sent_count"] >= 1

        # 5. Test DELETE /api/v1/schedule/events/{id}
        del_resp = await client.delete(f"/api/v1/schedule/events/{event_id}", headers=headers)
        assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_automated_timed_reminders():
    from backend_v2.app.services.reminder_scheduler import check_and_send_due_reminders
    from backend_v2.app.core.database import AsyncSessionLocal, engine, Base
    from backend_v2.app.models.schedule_event import ScheduleEvent

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    now = datetime.now(timezone.utc)
    
    # Insert two test events: one at 20 hours (in 24h window), one at 3 hours (in 4h window)
    async with AsyncSessionLocal() as db:
        ev_24h = ScheduleEvent(
            title="Automated 24h Reminder Test",
            academic_year="2nd Year",
            domain="Cloud & DevOps",
            faculty_name="Prof. Test24",
            faculty_email="prof.test24@converseiq.edu",
            start_time=now + timedelta(hours=20),
            status="Scheduled",
            reminder_24h_sent=False,
            reminder_4h_sent=False,
        )
        ev_4h = ScheduleEvent(
            title="Automated 4h Reminder Test",
            academic_year="4th Year",
            domain="Cyber Security",
            faculty_name="Prof. Test4",
            faculty_email="prof.test4@converseiq.edu",
            start_time=now + timedelta(hours=3),
            status="Scheduled",
            reminder_24h_sent=True,  # 24h already sent
            reminder_4h_sent=False,
        )
        db.add_all([ev_24h, ev_4h])
        await db.commit()
        await db.refresh(ev_24h)
        await db.refresh(ev_4h)
        id_24h = ev_24h.id
        id_4h = ev_4h.id

    # Run the automated reminder check
    dispatched = await check_and_send_due_reminders()
    assert dispatched >= 2

    # Verify flags updated
    async with AsyncSessionLocal() as db:
        res1 = await db.get(ScheduleEvent, id_24h)
        res2 = await db.get(ScheduleEvent, id_4h)
        assert res1.reminder_24h_sent is True
        assert res2.reminder_4h_sent is True

        # Clean up
        await db.delete(res1)
        await db.delete(res2)
        await db.commit()

