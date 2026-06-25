"""Unit tests for db.session helpers (get_db / init_db / drop_db)."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.db import session as session_mod

pytestmark = pytest.mark.asyncio


class _Ctx:
    """Async context manager yielding a preset object."""

    def __init__(self, obj):
        self._obj = obj

    async def __aenter__(self):
        return self._obj

    async def __aexit__(self, *exc):
        return False


async def test_get_db_commits_on_success(monkeypatch):
    sess = AsyncMock()
    monkeypatch.setattr(session_mod, "AsyncSessionLocal", lambda: _Ctx(sess))

    gen = session_mod.get_db()
    yielded = await gen.__anext__()
    assert yielded is sess
    with pytest.raises(StopAsyncIteration):
        await gen.__anext__()

    sess.commit.assert_awaited_once()
    sess.rollback.assert_not_called()
    sess.close.assert_awaited_once()


async def test_get_db_rolls_back_on_error(monkeypatch):
    sess = AsyncMock()
    sess.commit.side_effect = RuntimeError("boom")
    monkeypatch.setattr(session_mod, "AsyncSessionLocal", lambda: _Ctx(sess))

    gen = session_mod.get_db()
    await gen.__anext__()
    with pytest.raises(RuntimeError):
        await gen.__anext__()

    sess.rollback.assert_awaited_once()
    sess.close.assert_awaited_once()


async def test_init_db_creates_all(monkeypatch):
    conn = AsyncMock()
    engine = MagicMock()
    engine.begin.return_value = _Ctx(conn)
    monkeypatch.setattr(session_mod, "engine", engine)

    await session_mod.init_db()

    conn.run_sync.assert_awaited_once()


async def test_drop_db_drops_all(monkeypatch):
    conn = AsyncMock()
    engine = MagicMock()
    engine.begin.return_value = _Ctx(conn)
    monkeypatch.setattr(session_mod, "engine", engine)

    await session_mod.drop_db()

    conn.run_sync.assert_awaited_once()
