"""
RBAC integration tests.

Verifies that admin-only endpoints correctly reject requests made
with a student-role JWT token (403) and no token at all (401).
"""

import pytest
from httpx import AsyncClient
from tests.conftest import make_admin_token, make_student_token

pytestmark = pytest.mark.asyncio

ADMIN_ONLY_ENDPOINTS = [
    "/api/admin/command-center",
    "/api/admin/risk-registry",
    "/api/admin/students",
]


@pytest.mark.parametrize("endpoint", ADMIN_ONLY_ENDPOINTS)
async def test_admin_endpoint_rejects_student_token(client_with_student: AsyncClient, endpoint: str):
    """Student token → 403 on all admin-only endpoints."""
    headers = {"Authorization": f"Bearer {make_student_token()}"}
    resp = await client_with_student.get(endpoint, headers=headers)
    assert resp.status_code == 403, (
        f"Expected 403 for student on {endpoint}, got {resp.status_code}: {resp.text}"
    )


async def test_unauthenticated_admin_endpoint(client_empty_db: AsyncClient):
    """No token at all → 401 (not 403, not 200)."""
    resp = await client_empty_db.get("/api/admin/command-center")
    assert resp.status_code == 401


async def test_role_is_embedded_in_token(client_with_admin: AsyncClient):
    """
    After a successful login with admin credentials the returned access_token
    must encode a 'role' claim of 'admin'. We verify this by decoding the JWT
    using the local SECRET_KEY (not communicating with any external service).
    """
    from jose import jwt
    from app.core.database import settings

    resp = await client_with_admin.post(
        "/api/auth/login",
        data={"username": "testadmin", "password": "adminpass"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload.get("role") == "admin"


