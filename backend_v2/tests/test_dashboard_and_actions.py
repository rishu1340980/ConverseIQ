import pytest
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app

@pytest.mark.asyncio
async def test_dashboard_and_actions_workflow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login as Faculty
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Check initial Dashboard
        dash_res = await ac.get("/api/v1/dashboard/faculty", headers=headers)
        assert dash_res.status_code == 200
        initial_dash = dash_res.json()
        assert "metrics" in initial_dash
        initial_pending = initial_dash["metrics"]["pending_action_items"]

        # 3. Create a real action item
        create_res = await ac.post("/api/v1/action-items", headers=headers, json={
            "task": "Submit NBA Criteria 4 Curriculum documentation",
            "priority": "High",
            "owner_name": "Prof. Sharma"
        })
        assert create_res.status_code == 201
        created_item = create_res.json()
        assert created_item["status"] == "Pending"
        assert created_item["task"] == "Submit NBA Criteria 4 Curriculum documentation"
        item_id = created_item["id"]

        # 4. Verify dashboard pending count increased
        dash_res_2 = await ac.get("/api/v1/dashboard/faculty", headers=headers)
        assert dash_res_2.json()["metrics"]["pending_action_items"] == initial_pending + 1

        # 5. List action items
        list_res = await ac.get("/api/v1/action-items", headers=headers)
        assert list_res.status_code == 200
        items = list_res.json()
        assert any(it["id"] == item_id for it in items)

        # 6. Toggle task status to Completed
        toggle_res = await ac.patch(f"/api/v1/action-items/{item_id}/toggle", headers=headers)
        assert toggle_res.status_code == 200
        assert toggle_res.json()["status"] == "Completed"

        # 7. Verify dashboard pending count decreased back
        dash_res_3 = await ac.get("/api/v1/dashboard/faculty", headers=headers)
        assert dash_res_3.json()["metrics"]["pending_action_items"] == initial_pending

        # 8. Clean up test item
        del_res = await ac.delete(f"/api/v1/action-items/{item_id}", headers=headers)
        assert del_res.status_code == 204
