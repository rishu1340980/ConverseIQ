import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend_v2.app.main import app

@pytest.mark.asyncio
async def test_faculty_login_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Faculty"
        assert data["user"]["name"] == "Prof. Sharma"
        assert data["user"]["department_name"] == "Computer Science"

@pytest.mark.asyncio
async def test_hod_login_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={
            "email": "hod.cs@converseiq.edu",
            "password": "Hod@123"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "HOD"
        assert data["user"]["name"] in ["Prof. Mehta", "Dr. Mehta"]

@pytest.mark.asyncio
async def test_admin_login_success():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={
            "email": "admin@converseiq.edu",
            "password": "Admin@123"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "Admin"

@pytest.mark.asyncio
async def test_invalid_password_fails():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "WrongPassword!"
        })
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_auth_me_with_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        token = login_res.json()["access_token"]
        
        me_res = await ac.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["email"] == "prof.sharma@converseiq.edu"
        assert me_data["role"] == "Faculty"
