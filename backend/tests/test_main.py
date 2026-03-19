import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_read_root(client_empty_db):
    response = await client_empty_db.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "SPARK API is running", "version": "2.0.0", "docs": "/docs"}

@pytest.mark.asyncio
async def test_health_check_healthy(client_empty_db):
    # client_empty_db provides a mock session that resolves SELECT 1
    response = await client_empty_db.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"

@pytest.mark.asyncio
async def test_api_v1_versioning_redirect(client_empty_db):
    # Test legacy redirect
    response = await client_empty_db.get("/api/auth/me", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/api/v1/auth/me"

@pytest.mark.asyncio
async def test_debug_sentry_no_dsn(client_empty_db):
    # Without SENTRY_DSN, it should return a message
    response = await client_empty_db.get("/api/v1/debug-sentry")
    assert response.status_code == 200
    assert "Sentry DSN not configured" in response.json()["message"]
