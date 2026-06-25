"""Unit tests for the database seed script."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import seed
from src.models.category import Category

pytestmark = pytest.mark.asyncio


class _SessionCtx:
    """Minimal async context manager standing in for AsyncSessionLocal()."""

    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc):
        return False


async def test_seed_categories_inserts_all(db_session: AsyncSession):
    await seed.seed_categories(db_session)
    rows = (await db_session.execute(select(Category))).scalars().all()
    assert len(rows) == 15
    assert "Fruits" in {r.name for r in rows}


async def test_seed_all_seeds_when_empty(monkeypatch):
    session = AsyncMock()
    session.add_all = MagicMock()  # add_all is sync in the real session
    result = MagicMock()
    result.scalars.return_value.first.return_value = None  # empty table
    session.execute.return_value = result
    monkeypatch.setattr(seed, "AsyncSessionLocal", lambda: _SessionCtx(session))

    await seed.seed_all()

    session.add_all.assert_called_once()
    session.commit.assert_awaited()


async def test_seed_all_skips_when_already_present(monkeypatch):
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.first.return_value = Category(name="Fruits")
    session.execute.return_value = result
    monkeypatch.setattr(seed, "AsyncSessionLocal", lambda: _SessionCtx(session))

    await seed.seed_all()

    session.add_all.assert_not_called()


async def test_seed_all_rolls_back_and_reraises_on_error(monkeypatch):
    session = AsyncMock()
    session.execute.side_effect = RuntimeError("boom")
    monkeypatch.setattr(seed, "AsyncSessionLocal", lambda: _SessionCtx(session))

    with pytest.raises(RuntimeError):
        await seed.seed_all()

    session.rollback.assert_awaited()
