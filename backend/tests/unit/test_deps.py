"""Unit tests for core.deps dependency helpers."""
from datetime import datetime

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.core import deps
from src.core.exceptions import AuthenticationError, AuthorizationError
from src.core.security import create_access_token

# (asyncio_mode = "auto" in pyproject auto-detects the async tests here; the
# require_client_scope tests below are intentionally sync.)


# --- get_current_user_id ---------------------------------------------------
async def test_user_id_missing_header():
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_id(None)


async def test_user_id_bad_scheme():
    tok = create_access_token({"sub": "1"})
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_id(f"Basic {tok}")


async def test_user_id_malformed_header():
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_id("OnlyOneWord")


async def test_user_id_invalid_token():
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_id("Bearer not.a.real.jwt")


async def test_user_id_missing_sub():
    tok = create_access_token({"foo": "bar"})
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_id(f"Bearer {tok}")


async def test_user_id_valid():
    tok = create_access_token({"sub": "42"})
    assert await deps.get_current_user_id(f"Bearer {tok}") == 42


# --- get_current_user_role -------------------------------------------------
async def test_role_missing_header():
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_role(None)


async def test_role_bad_scheme():
    tok = create_access_token({"sub": "1", "role": "admin"})
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_role(f"Basic {tok}")


async def test_role_malformed_header():
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_role("x")


async def test_role_invalid_token():
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_role("Bearer nope")


async def test_role_missing_role_claim():
    tok = create_access_token({"sub": "1"})
    with pytest.raises(AuthenticationError):
        await deps.get_current_user_role(f"Bearer {tok}")


async def test_role_valid():
    tok = create_access_token({"sub": "1", "role": "admin"})
    assert await deps.get_current_user_role(f"Bearer {tok}") == "admin"


# --- get_current_user ------------------------------------------------------
async def test_get_current_user_found():
    db = AsyncMock()
    user = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    db.execute.return_value = result
    assert await deps.get_current_user(1, db) is user


async def test_get_current_user_not_found():
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute.return_value = result
    with pytest.raises(AuthenticationError):
        await deps.get_current_user(1, db)


# --- get_current_api_client ------------------------------------------------
async def test_api_client_missing_header():
    with pytest.raises(AuthenticationError):
        await deps.get_current_api_client(AsyncMock(), None)


async def test_api_client_malformed_header():
    with pytest.raises(AuthenticationError):
        await deps.get_current_api_client(AsyncMock(), "x")


async def test_api_client_bad_scheme():
    tok = create_access_token({"type": "client", "sub": "c1"})
    with pytest.raises(AuthenticationError):
        await deps.get_current_api_client(AsyncMock(), f"Basic {tok}")


async def test_api_client_wrong_token_type(monkeypatch):
    # create_access_token forces type="access"; here decode returns a non-client
    # payload so the type guard fires.
    monkeypatch.setattr(deps, "decode_token", lambda _t: {"type": "access", "sub": "c1"})
    with pytest.raises(AuthenticationError):
        await deps.get_current_api_client(AsyncMock(), "Bearer x")


async def test_api_client_revoked_or_missing(monkeypatch):
    monkeypatch.setattr(deps, "decode_token", lambda _t: {"type": "client", "sub": "c1"})
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.first.return_value = None
    db.execute.return_value = result
    with pytest.raises(AuthenticationError):
        await deps.get_current_api_client(db, "Bearer x")


async def test_api_client_success_records_last_used(monkeypatch):
    monkeypatch.setattr(deps, "decode_token", lambda _t: {"type": "client", "sub": "c1"})
    db = AsyncMock()
    client = MagicMock()
    client.is_active = True
    result = MagicMock()
    result.scalars.return_value.first.return_value = client
    db.execute.return_value = result

    out = await deps.get_current_api_client(db, "Bearer x")

    assert out is client
    assert isinstance(client.last_used_at, datetime)
    db.commit.assert_awaited_once()


# --- require_client_scope --------------------------------------------------
def test_require_client_scope_allows_when_present():
    dep = deps.require_client_scope("read")
    client = MagicMock()
    client.permissions = {"read": True}
    assert dep(client) is client


def test_require_client_scope_rejects_when_absent():
    dep = deps.require_client_scope("read")
    client = MagicMock()
    client.permissions = {}
    with pytest.raises(AuthorizationError):
        dep(client)
