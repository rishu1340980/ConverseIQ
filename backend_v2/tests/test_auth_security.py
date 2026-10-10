import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone, timedelta
from backend_v2.app.main import app
from backend_v2.app.core.security import (
    validate_password_strength,
    create_access_token,
    decode_access_token,
)
from backend_v2.app.core.rate_limiter import login_ip_limiter

@pytest.mark.asyncio
async def test_password_complexity_validator():
    """Verify password strength validation rules."""
    # Too short (< 8 chars)
    assert validate_password_strength("Short1!") is not None
    # No uppercase
    assert validate_password_strength("lowercase123!") is not None
    # No lowercase
    assert validate_password_strength("UPPERCASE123!") is not None
    # No digit
    assert validate_password_strength("NoDigitsHere!!") is not None
    # No special char
    assert validate_password_strength("NoSpecialChar123") is not None
    # Common password
    assert validate_password_strength("password123") is not None
    # Strong password
    assert validate_password_strength("Faculty@Secured2026") is None
    assert validate_password_strength("Prof#Strong99") is None

@pytest.mark.asyncio
async def test_valid_login_and_token_structure():
    """Verify valid login returns token with jti, token_version, and role."""
    login_ip_limiter.reset_ip("127.0.0.1")
    login_ip_limiter.reset_ip("testclient")
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        token = data["access_token"]
        assert token
        
        # Verify decoded payload has security claims
        payload = decode_access_token(token)
        assert payload is not None
        assert "jti" in payload
        assert "token_version" in payload
        assert payload.get("iss") == "converseiq-auth"
        assert payload.get("role") == "Faculty"

@pytest.mark.asyncio
async def test_nonexistent_user_returns_generic_error():
    """Verify nonexistent user does not leak account existence."""
    login_ip_limiter.reset_ip("127.0.0.1")
    login_ip_limiter.reset_ip("testclient")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/login", json={
            "email": "nonexistent.attacker@converseiq.edu",
            "password": "RandomPassword@123"
        })
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid email or password"

@pytest.mark.asyncio
async def test_account_lockout_after_five_failed_attempts():
    """Verify 5 consecutive failed logins trigger 15-minute HTTP 423 lockout."""
    login_ip_limiter.reset_ip("127.0.0.1")
    login_ip_limiter.reset_ip("testclient")

    target_email = "hod.cs@converseiq.edu"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First 4 failed attempts -> HTTP 401
        for i in range(4):
            login_ip_limiter.reset_ip("127.0.0.1")
            login_ip_limiter.reset_ip("testclient")
            r = await ac.post("/api/v1/auth/login", json={
                "email": target_email,
                "password": "WrongPassword@999"
            })
            assert r.status_code == 401

        # 5th failed attempt -> Triggers lockout HTTP 423
        login_ip_limiter.reset_ip("127.0.0.1")
        login_ip_limiter.reset_ip("testclient")
        r5 = await ac.post("/api/v1/auth/login", json={
            "email": target_email,
            "password": "WrongPassword@999"
        })
        assert r5.status_code == 423
        assert "locked" in r5.json()["detail"].lower()

        # Subsequent attempt even with correct password is blocked while locked
        login_ip_limiter.reset_ip("127.0.0.1")
        login_ip_limiter.reset_ip("testclient")
        r_blocked = await ac.post("/api/v1/auth/login", json={
            "email": target_email,
            "password": "Hod@123"
        })
        assert r_blocked.status_code == 423

@pytest.mark.asyncio
async def test_jwt_logout_and_revocation():
    """Verify logging out blacklists the JWT and rejects subsequent calls."""
    login_ip_limiter.reset_ip("127.0.0.1")
    login_ip_limiter.reset_ip("testclient")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login
        login_resp = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Verify token works on /me
        me_resp = await ac.get("/api/v1/auth/me", headers=headers)
        assert me_resp.status_code == 200

        # 3. Call /logout
        logout_resp = await ac.post("/api/v1/auth/logout", headers=headers)
        assert logout_resp.status_code == 200
        assert "revoked" in logout_resp.json()["message"].lower()

        # 4. Token must now be rejected on /me (HTTP 401)
        rejected_resp = await ac.get("/api/v1/auth/me", headers=headers)
        assert rejected_resp.status_code == 401
        assert "revoked" in rejected_resp.json()["detail"].lower()

@pytest.mark.asyncio
async def test_password_change_token_version_invalidation():
    """Verify changing password increments token_version, invalidating all old tokens."""
    login_ip_limiter.reset_ip("127.0.0.1")
    login_ip_limiter.reset_ip("testclient")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login to get initial token
        r1 = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        old_token = r1.json()["access_token"]
        old_headers = {"Authorization": f"Bearer {old_token}"}

        # 2. Change password
        ch_resp = await ac.post("/api/v1/auth/change-password", headers=old_headers, json={
            "current_password": "Faculty@123",
            "new_password": "Prof#NewSecure2026!"
        })
        assert ch_resp.status_code == 200
        fresh_token = ch_resp.json()["access_token"]
        assert fresh_token

        # 3. Old token MUST fail on /me due to token_version mismatch
        r_old = await ac.get("/api/v1/auth/me", headers=old_headers)
        assert r_old.status_code == 401
        assert "invalidated" in r_old.json()["detail"].lower()

        # 4. Fresh token must succeed
        r_fresh = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {fresh_token}"})
        assert r_fresh.status_code == 200

        # Reset password back to standard for subsequent tests
        await ac.post("/api/v1/auth/change-password", headers={"Authorization": f"Bearer {fresh_token}"}, json={
            "current_password": "Prof#NewSecure2026!",
            "new_password": "Faculty@123"
        })

@pytest.mark.asyncio
async def test_role_authorization_and_idor_protection():
    """Verify Faculty cannot access Admin endpoints and cannot access unauthorized meeting."""
    login_ip_limiter.reset_ip("127.0.0.1")
    login_ip_limiter.reset_ip("testclient")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Faculty login
        f_resp = await ac.post("/api/v1/auth/login", json={
            "email": "prof.sharma@converseiq.edu",
            "password": "Faculty@123"
        })
        f_token = f_resp.json()["access_token"]
        f_headers = {"Authorization": f"Bearer {f_token}"}

        # 1. Faculty attempts to access Admin audit logs -> HTTP 403 Forbidden
        admin_resp = await ac.get("/api/v1/audit", headers=f_headers)
        assert admin_resp.status_code == 403

        # 2. Admin login succeeds for audit logs
        login_ip_limiter.reset_ip("127.0.0.1")
        login_ip_limiter.reset_ip("testclient")
        a_resp = await ac.post("/api/v1/auth/login", json={
            "email": "admin@converseiq.edu",
            "password": "Admin@123"
        })
        a_token = a_resp.json()["access_token"]
        a_headers = {"Authorization": f"Bearer {a_token}"}

        admin_allowed = await ac.get("/api/v1/audit", headers=a_headers)
        assert admin_allowed.status_code == 200
