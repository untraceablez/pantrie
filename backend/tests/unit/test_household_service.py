"""Tests for HouseholdService (households, memberships, role enforcement).

The service is fully DB-backed, so these use the real ``db_session`` fixture
and create Users / Households / HouseholdMemberships directly. A small
``_make_user`` helper keeps the membership setup terse.
"""
import pytest

from src.core.exceptions import AlreadyExistsError, AuthorizationError, NotFoundError
from src.models.household import Household
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.user import User
from src.schemas.household import HouseholdCreate, HouseholdUpdate
from src.services.household_service import HouseholdService


async def _make_user(db, *, email, username) -> User:
    user = User(email=email, username=username, hashed_password="x", is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _make_household(db, *, name="House") -> Household:
    household = Household(name=name, description=None)
    db.add(household)
    await db.flush()
    return household


async def _add_member(db, *, user_id, household_id, role) -> HouseholdMembership:
    membership = HouseholdMembership(user_id=user_id, household_id=household_id, role=role)
    db.add(membership)
    await db.flush()
    return membership


# --------------------------------------------------------------------------- #
# create_household
# --------------------------------------------------------------------------- #
async def test_create_household_adds_creator_as_admin(db_session):
    user = await _make_user(db_session, email="c@example.com", username="creator")
    await db_session.commit()
    svc = HouseholdService(db_session)

    household = await svc.create_household(
        user.id, HouseholdCreate(name="My House", description="desc")
    )

    assert household.id is not None
    assert household.name == "My House"
    result = await svc.get_household_by_id(household.id, user.id)
    assert result.user_role == MemberRole.ADMIN


async def test_create_household_seeds_water_staple(db_session):
    from src.services.staple_service import StapleService

    user = await _make_user(db_session, email="w@example.com", username="watercreator")
    await db_session.commit()
    svc = HouseholdService(db_session)

    household = await svc.create_household(
        user.id, HouseholdCreate(name="Water House", description=None)
    )

    staples = await StapleService(db_session).list_household_staples(household.id, user.id)
    assert [s.name for s in staples] == ["water"]


# --------------------------------------------------------------------------- #
# get_household_by_id
# --------------------------------------------------------------------------- #
async def test_get_household_by_id_returns_membership_role(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=user.id, household_id=household.id,
                      role=MemberRole.EDITOR)
    await db_session.commit()
    svc = HouseholdService(db_session)

    result = await svc.get_household_by_id(household.id, user.id)
    assert result.id == household.id
    assert result.user_role == MemberRole.EDITOR


async def test_get_household_by_id_not_found(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(NotFoundError):
        await svc.get_household_by_id(9999, user.id)


async def test_get_household_by_id_not_a_member(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    household = await _make_household(db_session)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.get_household_by_id(household.id, user.id)


# --------------------------------------------------------------------------- #
# list_user_households
# --------------------------------------------------------------------------- #
async def test_list_user_households_returns_all_with_roles(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    h1 = await _make_household(db_session, name="One")
    h2 = await _make_household(db_session, name="Two")
    await _add_member(db_session, user_id=user.id, household_id=h1.id, role=MemberRole.ADMIN)
    await _add_member(db_session, user_id=user.id, household_id=h2.id, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)

    households = await svc.list_user_households(user.id)
    by_name = {h.name: h.user_role for h in households}
    assert by_name == {"One": MemberRole.ADMIN, "Two": MemberRole.VIEWER}


async def test_list_user_households_empty(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    await db_session.commit()
    svc = HouseholdService(db_session)
    assert await svc.list_user_households(user.id) == []


# --------------------------------------------------------------------------- #
# update_household
# --------------------------------------------------------------------------- #
async def test_update_household_admin_updates_fields(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="a")
    household = await _make_household(db_session, name="Old")
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)

    updated = await svc.update_household(
        household.id, admin.id, HouseholdUpdate(name="New", description="d")
    )
    assert updated.name == "New"
    assert updated.description == "d"


async def test_update_household_non_admin_rejected(db_session):
    editor = await _make_user(db_session, email="e@example.com", username="e")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=editor.id, household_id=household.id,
                      role=MemberRole.EDITOR)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.update_household(household.id, editor.id, HouseholdUpdate(name="X"))


# --------------------------------------------------------------------------- #
# delete_household
# --------------------------------------------------------------------------- #
async def test_delete_household_admin_succeeds(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="a")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)

    await svc.delete_household(household.id, admin.id)
    with pytest.raises(NotFoundError):
        await svc.get_household_by_id(household.id, admin.id)


async def test_delete_household_non_member_rejected(db_session):
    stranger = await _make_user(db_session, email="s@example.com", username="s")
    household = await _make_household(db_session)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.delete_household(household.id, stranger.id)


# --------------------------------------------------------------------------- #
# list_household_members
# --------------------------------------------------------------------------- #
async def test_list_household_members_returns_all(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    member = await _make_user(db_session, email="m@example.com", username="member")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await _add_member(db_session, user_id=member.id, household_id=household.id,
                      role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)

    members = await svc.list_household_members(household.id, admin.id)
    emails = {m["email"]: m["role"] for m in members}
    assert emails == {"a@example.com": "admin", "m@example.com": "viewer"}


async def test_list_household_members_non_member_rejected(db_session):
    stranger = await _make_user(db_session, email="s@example.com", username="s")
    household = await _make_household(db_session)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.list_household_members(household.id, stranger.id)


# --------------------------------------------------------------------------- #
# add_household_member
# --------------------------------------------------------------------------- #
async def test_add_household_member_success(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    invitee = await _make_user(db_session, email="i@example.com", username="invitee")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)

    result = await svc.add_household_member(
        household.id, admin.id, "i@example.com", MemberRole.EDITOR
    )
    assert result["user_id"] == invitee.id
    assert result["role"] == "editor"


async def test_add_household_member_non_admin_rejected(db_session):
    editor = await _make_user(db_session, email="e@example.com", username="e")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=editor.id, household_id=household.id,
                      role=MemberRole.EDITOR)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.add_household_member(household.id, editor.id, "x@example.com",
                                       MemberRole.VIEWER)


async def test_add_household_member_user_not_found(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(NotFoundError):
        await svc.add_household_member(household.id, admin.id, "missing@example.com",
                                       MemberRole.VIEWER)


async def test_add_household_member_already_member(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    existing = await _make_user(db_session, email="x@example.com", username="x")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await _add_member(db_session, user_id=existing.id, household_id=household.id,
                      role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AlreadyExistsError):
        await svc.add_household_member(household.id, admin.id, "x@example.com",
                                       MemberRole.EDITOR)


# --------------------------------------------------------------------------- #
# update_member_role
# --------------------------------------------------------------------------- #
async def test_update_member_role_success(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    member = await _make_user(db_session, email="m@example.com", username="member")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    membership = await _add_member(db_session, user_id=member.id,
                                   household_id=household.id, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)

    result = await svc.update_member_role(
        household.id, admin.id, membership.id, MemberRole.EDITOR
    )
    assert result["role"] == "editor"
    assert result["user_id"] == member.id


async def test_update_member_role_non_admin_rejected(db_session):
    editor = await _make_user(db_session, email="e@example.com", username="e")
    other = await _make_user(db_session, email="o@example.com", username="o")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=editor.id, household_id=household.id,
                      role=MemberRole.EDITOR)
    membership = await _add_member(db_session, user_id=other.id,
                                   household_id=household.id, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.update_member_role(household.id, editor.id, membership.id,
                                     MemberRole.ADMIN)


async def test_update_member_role_membership_not_found(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(NotFoundError):
        await svc.update_member_role(household.id, admin.id, 9999, MemberRole.EDITOR)


async def test_update_member_role_wrong_household_rejected(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    other = await _make_user(db_session, email="o@example.com", username="o")
    household = await _make_household(db_session, name="A")
    other_household = await _make_household(db_session, name="B")
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    membership = await _add_member(db_session, user_id=other.id,
                                   household_id=other_household.id, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.update_member_role(household.id, admin.id, membership.id,
                                     MemberRole.EDITOR)


async def test_update_member_role_cannot_change_own_role(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    household = await _make_household(db_session)
    membership = await _add_member(db_session, user_id=admin.id,
                                   household_id=household.id, role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.update_member_role(household.id, admin.id, membership.id,
                                     MemberRole.EDITOR)


# --------------------------------------------------------------------------- #
# remove_household_member
# --------------------------------------------------------------------------- #
async def test_remove_household_member_success(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    member = await _make_user(db_session, email="m@example.com", username="member")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    membership = await _add_member(db_session, user_id=member.id,
                                   household_id=household.id, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)

    await svc.remove_household_member(household.id, admin.id, membership.id)
    members = await svc.list_household_members(household.id, admin.id)
    assert all(m["user_id"] != member.id for m in members)


async def test_remove_household_member_membership_not_found(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    household = await _make_household(db_session)
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(NotFoundError):
        await svc.remove_household_member(household.id, admin.id, 9999)


async def test_remove_household_member_wrong_household_rejected(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    other = await _make_user(db_session, email="o@example.com", username="o")
    household = await _make_household(db_session, name="A")
    other_household = await _make_household(db_session, name="B")
    await _add_member(db_session, user_id=admin.id, household_id=household.id,
                      role=MemberRole.ADMIN)
    membership = await _add_member(db_session, user_id=other.id,
                                   household_id=other_household.id, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.remove_household_member(household.id, admin.id, membership.id)


async def test_remove_household_member_cannot_remove_self(db_session):
    admin = await _make_user(db_session, email="a@example.com", username="admin")
    household = await _make_household(db_session)
    membership = await _add_member(db_session, user_id=admin.id,
                                   household_id=household.id, role=MemberRole.ADMIN)
    await db_session.commit()
    svc = HouseholdService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.remove_household_member(household.id, admin.id, membership.id)
