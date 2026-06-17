"""Tests for MealieConnectionService (configure/get/get_active/delete).

DB-backed via the real ``db_session``. The API key is stored encrypted via
the real ``core.security.encrypt_secret``; tests assert the ciphertext is not
the plaintext and round-trips through ``decrypt_secret``. Role gating is
delegated to HouseholdService._check_user_role.
"""
import pytest

from src.core.exceptions import AuthorizationError, NotFoundError
from src.core.security import decrypt_secret
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.mealie_connection import MealieConnection
from src.models.user import User
from src.schemas.mealie import MealieConnectionConfig
from src.services.mealie_connection_service import MealieConnectionService


async def _make_user(db, *, email, username) -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _setup_household(db, *, role=MemberRole.ADMIN):
    user = await _make_user(db, email=f"{role.value}@example.com", username=role.value)
    household = Household(name="House", description=None)
    db.add(household)
    await db.flush()
    db.add(HouseholdMembership(user_id=user.id, household_id=household.id, role=role))
    await db.flush()
    return user, household


def _config(url="http://mealie.local", key="secret-api-key") -> MealieConnectionConfig:
    return MealieConnectionConfig(base_url=url, api_key=key)


# --------------------------------------------------------------------------- #
# configure
# --------------------------------------------------------------------------- #
async def test_configure_creates_connection_with_encrypted_key(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    await db_session.commit()
    svc = MealieConnectionService(db_session)

    conn = await svc.configure(household.id, user.id, _config(key="my-key"))
    assert conn.id is not None
    assert conn.base_url == "http://mealie.local"  # trailing slash stripped
    assert conn.api_key_enc != "my-key"            # stored encrypted
    assert decrypt_secret(conn.api_key_enc) == "my-key"
    assert conn.is_active is True


async def test_configure_updates_existing_connection(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    await db_session.commit()
    svc = MealieConnectionService(db_session)

    first = await svc.configure(household.id, user.id, _config(url="http://old", key="k1"))
    second = await svc.configure(
        household.id, user.id, _config(url="http://new/", key="k2")
    )
    assert second.id == first.id  # same row updated, not duplicated
    assert second.base_url == "http://new"
    assert decrypt_secret(second.api_key_enc) == "k2"


async def test_configure_non_admin_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.configure(household.id, user.id, _config())


# --------------------------------------------------------------------------- #
# get
# --------------------------------------------------------------------------- #
async def test_get_returns_connection_for_member(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    db_session.add(MealieConnection(
        household_id=household.id, base_url="http://m", api_key_enc="enc"
    ))
    await db_session.commit()
    svc = MealieConnectionService(db_session)

    conn = await svc.get(household.id, user.id)
    assert conn is not None and conn.base_url == "http://m"


async def test_get_returns_none_when_unconfigured(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    assert await svc.get(household.id, user.id) is None


async def test_get_non_member_rejected(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    stranger = await _make_user(db_session, email="s@example.com", username="stranger")
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.get(household.id, stranger.id)


# --------------------------------------------------------------------------- #
# get_active (internal, no role check)
# --------------------------------------------------------------------------- #
async def test_get_active_returns_active_connection(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    db_session.add(MealieConnection(
        household_id=household.id, base_url="http://m", api_key_enc="enc", is_active=True
    ))
    await db_session.commit()
    svc = MealieConnectionService(db_session)

    conn = await svc.get_active(household.id)
    assert conn.base_url == "http://m"


async def test_get_active_raises_when_unconfigured(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_active(household.id)


async def test_get_active_raises_when_inactive(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    db_session.add(MealieConnection(
        household_id=household.id, base_url="http://m", api_key_enc="enc", is_active=False
    ))
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_active(household.id)


# --------------------------------------------------------------------------- #
# delete
# --------------------------------------------------------------------------- #
async def test_delete_removes_connection(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    db_session.add(MealieConnection(
        household_id=household.id, base_url="http://m", api_key_enc="enc"
    ))
    await db_session.commit()
    svc = MealieConnectionService(db_session)

    await svc.delete(household.id, user.id)
    with pytest.raises(NotFoundError):
        await svc.get_active(household.id)


async def test_delete_raises_when_nothing_to_remove(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.ADMIN)
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    with pytest.raises(NotFoundError):
        await svc.delete(household.id, user.id)


async def test_delete_non_admin_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = MealieConnectionService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.delete(household.id, user.id)
