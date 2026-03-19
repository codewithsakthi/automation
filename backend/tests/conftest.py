"""
Shared pytest fixtures for the SPARK test suite.

Strategy: We mock the database dependency entirely — no real DB, no SQLite.
This avoids the PostgreSQL-only ARRAY(CHAR(1)) type on the Attendance model.

Each fixture hardwires what the mock DB session returns, so there's no
need to inspect SQLAlchemy statement strings (bound params are invisible
in the compiled string anyway).
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.database import get_db
from app.core.auth import get_password_hash, create_access_token
from app.models.base import User, Role


# ---------------------------------------------------------------------------
# Token helpers (importable by test modules)
# ---------------------------------------------------------------------------

def make_admin_token() -> str:
    return create_access_token(data={"sub": "testadmin", "role": "admin"})


def make_student_token() -> str:
    return create_access_token(data={"sub": "23CS001", "role": "student"})


# ---------------------------------------------------------------------------
# Pre-built model objects
# ---------------------------------------------------------------------------

def _build_user(username: str, password: str, role_name: str, uid: int) -> User:
    role = Role()
    role.id = uid
    role.name = role_name

    user = User()
    user.id = uid
    user.username = username
    user.password_hash = get_password_hash(password)
    user.is_initial_password = False
    user.role = role
    user.role_id = uid
    return user


ADMIN_USER = _build_user("testadmin", "adminpass", "admin", 1)
STUDENT_USER = _build_user("23CS001", "student123", "student", 2)


# ---------------------------------------------------------------------------
# Mock DB session factory
# ---------------------------------------------------------------------------

def _db_always_returns(user_obj):
    """
    Return an async mock session whose .execute() always resolves to
    scalars().first() == user_obj (or None if user_obj is None).
    """
    result = MagicMock()
    result.scalars.return_value.first.return_value = user_obj

    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


def _make_db_override(user_obj):
    """Return a FastAPI dependency override that yields the mock session."""
    async def _override():
        yield _db_always_returns(user_obj)
    return _override


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def client_with_admin():
    """HTTP client; every DB query resolves to ADMIN_USER."""
    app.dependency_overrides[get_db] = _make_db_override(ADMIN_USER)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def client_with_student():
    """HTTP client; every DB query resolves to STUDENT_USER."""
    app.dependency_overrides[get_db] = _make_db_override(STUDENT_USER)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def client_empty_db():
    """HTTP client; every DB query resolves to None."""
    app.dependency_overrides[get_db] = _make_db_override(None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def authed_admin_client():
    """
    HTTP client pre-loaded with an admin Bearer token.
    DB resolves to ADMIN_USER (so /me and token validation work).
    """
    app.dependency_overrides[get_db] = _make_db_override(ADMIN_USER)
    headers = {"Authorization": f"Bearer {make_admin_token()}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers=headers) as ac:
        yield ac
    app.dependency_overrides.clear()
