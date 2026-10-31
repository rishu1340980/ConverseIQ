import pytest
import io
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.meeting import Meeting
from app.models.mom import MinutesOfMeeting
from app.models.action_item import ActionItem
from app.models.user import User
from app.models.participant import Participant
from app.services.exporter import (
    generate_mom_pdf,
    generate_mom_docx,
    generate_action_items_pdf,
    MANDATORY_FOOTER_TEXT
)

@pytest.mark.asyncio
async def test_strict_domain_validation():
    """Verify non-APSIT domains are strictly rejected with institutional message."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Non-APSIT domain in login
        res = await client.post("/api/v1/auth/login", json={
            "email": "intruder@gmail.com",
            "password": "Password123"
        })
        assert res.status_code == 400
        assert res.json()["detail"] == "Not Applicable. Please use your official APSIT institutional email address."

        # 2. Non-APSIT domain in OTP request
        res_otp = await client.post("/api/v1/auth/request-otp", json={
            "email": "student@yahoo.com"
        })
        assert res_otp.status_code == 400
        assert res_otp.json()["detail"] == "Not Applicable. Please use your official APSIT institutional email address."

@pytest.mark.asyncio
async def test_otp_lifecycle_and_verification():
    """Verify OTP generation, cooldown, and verification flow."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        test_email = "23104080@apsit.edu.in"
        
        # Request OTP
        req_res = await client.post("/api/v1/auth/request-otp", json={"email": test_email})
        assert req_res.status_code == 200
        assert req_res.json()["success"] is True

        # Second request immediately should trigger 429 cooldown
        cooldown_res = await client.post("/api/v1/auth/request-otp", json={"email": test_email})
        assert cooldown_res.status_code == 429
        assert "Please wait" in cooldown_res.json()["detail"]

@pytest.mark.asyncio
async def test_faculty_directory_and_email_configuration():
    """Verify faculty directory search and HOD email configuration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as HOD
        hod_login = await client.post("/api/v1/auth/login", json={
            "email": "hod.it@apsit.edu.in",
            "password": "Hod@123"
        })
        assert hod_login.status_code == 200
        token = hod_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Query directory
        dir_res = await client.get("/api/v1/users/faculty-directory", headers=headers)
        assert dir_res.status_code == 200
        faculty_list = dir_res.json()
        assert len(faculty_list) >= 12
        assert any(f["name"] == "Prof. Jayshree Jha" for f in faculty_list)

@pytest.mark.asyncio
async def test_institutional_mom_pdf_and_docx_exports():
    """Verify PDF & DOCX generation with institutional banner and mandatory footer."""
    organizer = User(name="Dr. Kiran Deshpande", email="hod.it@apsit.edu.in")
    m = Meeting(
        id=101,
        title="Department Academic Board Review",
        date=datetime.now(timezone.utc),
        duration_minutes=60,
        creator=organizer,
        participants=[
            Participant(name="Prof. Randeep Kaur Kahlon", speaker_label="Speaker A", attended=True, invitation_status="Accepted"),
            Participant(name="Demo", speaker_label="Speaker B", attended=True, invitation_status="Accepted")
        ]
    )
    mom = MinutesOfMeeting(
        meeting_id=101,
        summary="Discussion on NBA documentation and course objectives.",
        decisions=["Approved modified syllabus timetable"],
        topics_discussed=[{"topic": "Curriculum", "points": ["Completed module 3"]}],
        is_finalized=True
    )
    actions = [
        ActionItem(meeting_id=101, task="Compile lab manuals", owner_name="Prof. Randeep Kaur Kahlon", due_date=datetime.now(timezone.utc), priority="High", status="In Progress")
    ]

    pdf_buffer = generate_mom_pdf(m, mom, actions)
    assert len(pdf_buffer.getvalue()) > 50000

    docx_buffer = generate_mom_docx(m, mom, actions)
    assert len(docx_buffer.getvalue()) > 50000

    ai_pdf_buffer = generate_action_items_pdf(actions)
    assert len(ai_pdf_buffer.getvalue()) > 50000
    assert MANDATORY_FOOTER_TEXT == "This is a system-generated Minutes of Meeting (MoM). No signature required."


@pytest.mark.asyncio
async def test_export_endpoints_http():
    """Verify HTTP export routes for PDF, DOCX, and Action Items."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "hod.it@apsit.edu.in",
            "password": "Hod@123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test /api/v1/reports/action-items/pdf
        res_ai = await client.get("/api/v1/reports/action-items/pdf", headers=headers)
        assert res_ai.status_code == 200
        assert res_ai.headers["content-type"] == "application/pdf"
        assert len(res_ai.content) > 1000

        # 2. Test /api/v1/export/action-items/pdf
        res_ai2 = await client.get("/api/v1/export/action-items/pdf", headers=headers)
        assert res_ai2.status_code == 200
        assert res_ai2.headers["content-type"] == "application/pdf"

        # 3. Test /api/v1/reports/mom/{meeting_id}/pdf
        res_mom = await client.get("/api/v1/reports/mom/1/pdf", headers=headers)
        assert res_mom.status_code == 200
        assert res_mom.headers["content-type"] == "application/pdf"

        # 4. Test /api/v1/mom/{meeting_id}/export/docx
        res_docx = await client.get("/api/v1/mom/1/export/docx", headers=headers)
        assert res_docx.status_code == 200


