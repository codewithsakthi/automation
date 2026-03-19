"""
Auth endpoint tests.

Covers:
  - Successful login returns access_token + refresh_token
  - Wrong password returns 401 with correct shape
  - Unknown username returns 401
  - Token is a valid non-empty string
  - Unauthenticated /me returns 401
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_login_success(client_with_admin: AsyncClient):
    """Valid credentials → 200 with token payload."""
    resp = await client_with_admin.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "adminpass"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 20


async def test_login_wrong_password(client_with_admin: AsyncClient):
    """Wrong password → 401 Unauthorized."""
    resp = await client_with_admin.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "wrongpassword"},
    )
    assert resp.status_code == 401
    assert "detail" in resp.json()


async def test_login_unknown_user(client_empty_db: AsyncClient):
    """Username that doesn't exist → 401 (no info leakage)."""
    resp = await client_empty_db.post(
        "/api/auth/login",
        data={"username": "ghost_user", "password": "doesntmatter"},
    )
    assert resp.status_code == 401


async def test_refresh_token_present(client_with_admin: AsyncClient):
    """Successful login must include a refresh_token field."""
    resp = await client_with_admin.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "adminpass"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "refresh_token" in body
    assert isinstance(body["refresh_token"], str)
    assert len(body["refresh_token"]) > 20


async def test_me_requires_auth(client_empty_db: AsyncClient):
    """GET /auth/me without token → 401."""
    resp = await client_empty_db.get("/api/auth/me")
    assert resp.status_code == 401
