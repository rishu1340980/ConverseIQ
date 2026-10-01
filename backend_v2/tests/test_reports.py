import pytest
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app
from backend_v2.app.core.security import create_access_token

@pytest.mark.asyncio
async def test_pdf_reports():
    token = create_access_token(data={"sub": "admin@converseiq.edu", "role": "Admin"})
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test Action Items PDF export
        resp = await client.get("/api/v1/reports/action-items/pdf", headers=headers)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content.startswith(b"%PDF")
        assert len(resp.content) > 500

        # 2. Get meetings list to find a valid meeting ID
        meetings_resp = await client.get("/api/v1/meetings", headers=headers)
        assert meetings_resp.status_code == 200
        meetings = meetings_resp.json()
        
        if meetings:
            meeting_id = meetings[0]["id"]
            mom_pdf_resp = await client.get(f"/api/v1/reports/mom/{meeting_id}/pdf", headers=headers)
            assert mom_pdf_resp.status_code == 200
            assert mom_pdf_resp.headers["content-type"] == "application/pdf"
            assert mom_pdf_resp.content.startswith(b"%PDF")
            assert len(mom_pdf_resp.content) > 1000
