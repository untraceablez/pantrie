"""Unit tests for the household staple service."""
from typing import Any

import pytest

from src.core.exceptions import AlreadyExistsError, AuthorizationError, NotFoundError
from src.models.user import User
from src.schemas.staple import StapleCreate
from src.services.staple_service import DEFAULT_STAPLES, StapleService


@pytest.mark.asyncio
async def test_create_and_list_staple(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    svc = StapleService(db_session)

    created = await svc.create_staple(user.id, hh.id, StapleCreate(name="  Olive Oil "))
    assert created.name == "olive oil"  # normalized

    staples = await svc.list_household_staples(hh.id, user.id)
    assert [s.name for s in staples] == ["olive oil"]


@pytest.mark.asyncio
async def test_create_duplicate_raises_conflict(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    svc = StapleService(db_session)
    await svc.create_staple(user.id, hh.id, StapleCreate(name="salt"))
    with pytest.raises(AlreadyExistsError):
        await svc.create_staple(user.id, hh.id, StapleCreate(name="SALT"))


@pytest.mark.asyncio
async def test_create_forbidden_for_non_member(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh = admin_household["household"]
    stranger = User(email="s@example.com", username="stranger", hashed_password="x", is_active=True)
    db_session.add(stranger)
    await db_session.commit()
    svc = StapleService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.create_staple(stranger.id, hh.id, StapleCreate(name="pepper"))


@pytest.mark.asyncio
async def test_delete_staple(db_session: Any, admin_household: dict[str, Any]) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    svc = StapleService(db_session)
    s = await svc.create_staple(user.id, hh.id, StapleCreate(name="sugar"))
    await svc.delete_staple(s.id, user.id)
    assert await svc.list_household_staples(hh.id, user.id) == []


@pytest.mark.asyncio
async def test_delete_missing_raises_not_found(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    user = admin_household["user"]
    svc = StapleService(db_session)
    with pytest.raises(NotFoundError):
        await svc.delete_staple(999999, user.id)


@pytest.mark.asyncio
async def test_seed_default_staples_is_idempotent(
    db_session: Any, admin_household: dict[str, Any]
) -> None:
    hh, user = admin_household["household"], admin_household["user"]
    svc = StapleService(db_session)

    await svc.seed_default_staples(hh.id)
    await db_session.commit()
    await svc.seed_default_staples(hh.id)  # second call must not duplicate
    await db_session.commit()

    staples = await svc.list_household_staples(hh.id, user.id)
    assert [s.name for s in staples] == DEFAULT_STAPLES
    assert "water" in DEFAULT_STAPLES
