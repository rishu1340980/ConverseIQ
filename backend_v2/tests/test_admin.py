import pytest
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app
from backend_v2.app.core.security import create_access_token


@pytest.mark.asyncio
async def test_admin_dashboard_and_permissions():
    transport = ASGITransport(app=app)
    admin_token = create_access_token(data={"sub": "admin@converseiq.edu", "email": "admin@converseiq.edu", "role": "Admin"})
    faculty_token = create_access_token(data={"sub": "prof.sharma@converseiq.edu", "email": "prof.sharma@converseiq.edu", "role": "Faculty"})

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Faculty should be forbidden from admin dashboard
        res_fac = await ac.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {faculty_token}"})
        assert res_fac.status_code == 403

        # 2. Admin should receive 200 with complete AdminDashboardData structure
        res_adm = await ac.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_adm.status_code == 200
        data = res_adm.json()
        assert "total_faculty" in data
        assert "total_meetings" in data
        assert "action_items_tracked" in data
        assert "active_departments" in data
        assert "completion_percentage" in data
        assert "department_activity" in data
        assert "system_alerts" in data


@pytest.mark.asyncio
async def test_audit_logs_endpoint():
    transport = ASGITransport(app=app)
    admin_token = create_access_token(data={"sub": "admin@converseiq.edu", "email": "admin@converseiq.edu", "role": "Admin"})
    faculty_token = create_access_token(data={"sub": "prof.sharma@converseiq.edu", "email": "prof.sharma@converseiq.edu", "role": "Faculty"})

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Faculty cannot access audit logs
        res_fac = await ac.get("/api/v1/audit", headers={"Authorization": f"Bearer {faculty_token}"})
        assert res_fac.status_code == 403

        # 2. Admin can access audit logs
        res_adm = await ac.get("/api/v1/audit", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_adm.status_code == 200
        logs = res_adm.json()
        assert isinstance(logs, list)

        # 3. Test filtering by severity
        res_filtered = await ac.get("/api/v1/audit?severity=OK", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_filtered.status_code == 200


@pytest.mark.asyncio
async def test_analytics_endpoint():
    transport = ASGITransport(app=app)
    admin_token = create_access_token(data={"sub": "admin@converseiq.edu", "email": "admin@converseiq.edu", "role": "Admin"})

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/analytics", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        data = res.json()
        assert "stats" in data
        assert "avg_meeting_duration_mins" in data["stats"]
        assert "actions_per_meeting" in data["stats"]
        assert "action_completion_rate" in data["stats"]
        assert "ai_queries_this_month" in data["stats"]
        assert "meetings_vs_actions_trend" in data
        assert len(data["meetings_vs_actions_trend"]) == 6


@pytest.mark.asyncio
async def test_admin_settings_persistence():
    transport = ASGITransport(app=app)
    admin_token = create_access_token(data={"sub": "admin@converseiq.edu", "email": "admin@converseiq.edu", "role": "Admin"})

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Get settings
        res_get = await ac.get("/api/v1/admin/settings", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_get.status_code == 200
        settings_data = res_get.json()
        assert "institution_name" in settings_data

        # 2. Update settings
        payload = {
            "institution_name": "Test Engineering Institute of Tech",
            "retention_days": 90,
            "enable_2fa": True
        }
        res_put = await ac.put("/api/v1/admin/settings", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
        assert res_put.status_code == 200
        updated = res_put.json()
        assert updated["institution_name"] == "Test Engineering Institute of Tech"
        assert updated["retention_days"] == 90
        assert updated["enable_2fa"] is True

        # 3. Verify audit log was created for settings update
        res_audit = await ac.get("/api/v1/audit?search=settings", headers={"Authorization": f"Bearer {admin_token}"})
        assert res_audit.status_code == 200
        matching_logs = res_audit.json()
        assert len(matching_logs) > 0


@pytest.mark.asyncio
async def test_departments_enriched_metrics():
    transport = ASGITransport(app=app)
    admin_token = create_access_token(data={"sub": "admin@converseiq.edu", "email": "admin@converseiq.edu", "role": "Admin"})

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/departments", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        depts = res.json()
        assert len(depts) > 0
        first = depts[0]
        assert "faculty_count" in first
        assert "meeting_count" in first
        assert "pending_actions" in first
        assert "completion_rate" in first
