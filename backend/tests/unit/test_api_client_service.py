"""Tests for APIClientService list/revoke (create_client is covered elsewhere).

DB-backed via the real ``db_session`` + the ``admin_household`` fixture.
"""
from typing import Any

import pytest

from src.core.exceptions import AuthorizationError, NotFoundError
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.user import User
from src.schemas.api_client import APIClientCreate, Permissions
from src.services.api_client_service import APIClientService


async def _make_client(db, household, user, name="Mealie"):
    svc = APIClientService(db)
    return await svc.create_client(
        household_id=household.id, user_id=user.id,
        data=APIClientCreate(name=name, permissions=Permissions(read=True)),
    )


async def _editor(db, household) -> User:
    editor = User(email="ed@example.com", username="ed", hashed_password="x", is_active=True)
    db.add(editor)
    await db.flush()
    db.add(HouseholdMembership(
        user_id=editor.id, household_id=household.id, role=MemberRole.EDITOR
    ))
    await db.commit()
    return editor


async def test_list_clients_returns_household_clients(db_session, admin_household: dict[str, Any]):
    household, user = admin_household["household"], admin_household["user"]
    await _make_client(db_session, household, user, name="A")
    await _make_client(db_session, household, user, name="B")
    svc = APIClientService(db_session)

    clients = await svc.list_clients(household.id, user.id)
    assert {c.name for c in clients} == {"A", "B"}


async def test_list_clients_non_admin_rejected(db_session, admin_household: dict[str, Any]):
    household = admin_household["household"]
    editor = await _editor(db_session, household)
    svc = APIClientService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.list_clients(household.id, editor.id)


async def test_revoke_client_marks_inactive(db_session, admin_household: dict[str, Any]):
    household, user = admin_household["household"], admin_household["user"]
    client, _ = await _make_client(db_session, household, user)
    svc = APIClientService(db_session)

    await svc.revoke_client(household.id, user.id, client.id)
    refreshed = (await svc.list_clients(household.id, user.id))[0]
    assert refreshed.is_active is False


async def test_revoke_client_not_found(db_session, admin_household: dict[str, Any]):
    household, user = admin_household["household"], admin_household["user"]
    svc = APIClientService(db_session)
    with pytest.raises(NotFoundError):
        await svc.revoke_client(household.id, user.id, 9999)


async def test_revoke_client_non_admin_rejected(db_session, admin_household: dict[str, Any]):
    household, user = admin_household["household"], admin_household["user"]
    client, _ = await _make_client(db_session, household, user)
    editor = await _editor(db_session, household)
    svc = APIClientService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.revoke_client(household.id, editor.id, client.id)
