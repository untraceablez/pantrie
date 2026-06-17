"""Tests for LocationService, AllergenService, and UserService.

All three are small household-gated CRUD services (Location/Allergen) plus a
profile service (User). DB-backed via the real ``db_session``.
"""
import pytest

from src.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
)
from src.core.security import hash_password, verify_password
from src.models.household import Household
from src.models.household_allergen import HouseholdAllergen
from src.models.household_membership import HouseholdMembership, MemberRole
from src.models.location import Location
from src.models.user import User
from src.schemas.allergen import AllergenCreate
from src.schemas.location import LocationCreate, LocationUpdate
from src.schemas.user import PasswordChange, UserUpdate
from src.services.allergen_service import AllergenService
from src.services.location_service import LocationService
from src.services.user_service import UserService


async def _make_user(db, *, email, username, password=None) -> User:
    user = User(email=email, username=username,
                hashed_password=hash_password(password) if password else "x",
                is_active=True)
    db.add(user)
    await db.flush()
    return user


async def _setup_household(db, *, role=MemberRole.EDITOR):
    user = await _make_user(db, email=f"{role.value}@example.com", username=role.value)
    household = Household(name="House", description=None)
    db.add(household)
    await db.flush()
    db.add(HouseholdMembership(user_id=user.id, household_id=household.id, role=role))
    await db.flush()
    return user, household


# =========================================================================== #
# LocationService
# =========================================================================== #
async def test_create_location_editor_succeeds(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = LocationService(db_session)
    loc = await svc.create_location(
        user.id, LocationCreate(household_id=household.id, name="Pantry", icon="🧺")
    )
    assert loc.id is not None and loc.name == "Pantry"


async def test_create_location_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = LocationService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.create_location(user.id, LocationCreate(household_id=household.id, name="X"))


async def test_get_location_by_id_success_and_not_found(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    loc = Location(household_id=household.id, name="Fridge")
    db_session.add(loc)
    await db_session.commit()
    svc = LocationService(db_session)
    assert (await svc.get_location_by_id(loc.id, user.id)).name == "Fridge"
    with pytest.raises(NotFoundError):
        await svc.get_location_by_id(9999, user.id)


async def test_get_location_non_member_rejected(db_session):
    _, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    stranger = await _make_user(db_session, email="s@example.com", username="stranger")
    loc = Location(household_id=household.id, name="Fridge")
    db_session.add(loc)
    await db_session.commit()
    svc = LocationService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.get_location_by_id(loc.id, stranger.id)


async def test_list_household_locations_sorted_by_name(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    db_session.add_all([
        Location(household_id=household.id, name="Zebra"),
        Location(household_id=household.id, name="Attic"),
    ])
    await db_session.commit()
    svc = LocationService(db_session)
    names = [loc.name for loc in await svc.list_household_locations(household.id, user.id)]
    assert names == ["Attic", "Zebra"]


async def test_update_location_editor_and_not_found(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    loc = Location(household_id=household.id, name="Old")
    db_session.add(loc)
    await db_session.commit()
    svc = LocationService(db_session)
    updated = await svc.update_location(loc.id, user.id, LocationUpdate(name="New"))
    assert updated.name == "New"
    with pytest.raises(NotFoundError):
        await svc.update_location(9999, user.id, LocationUpdate(name="X"))


async def test_update_location_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    loc = Location(household_id=household.id, name="Old")
    db_session.add(loc)
    await db_session.commit()
    svc = LocationService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.update_location(loc.id, user.id, LocationUpdate(name="New"))


async def test_delete_location_editor_and_not_found(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    loc = Location(household_id=household.id, name="Gone")
    db_session.add(loc)
    await db_session.commit()
    svc = LocationService(db_session)
    await svc.delete_location(loc.id, user.id)
    with pytest.raises(NotFoundError):
        await svc.get_location_by_id(loc.id, user.id)
    with pytest.raises(NotFoundError):
        await svc.delete_location(9999, user.id)


async def test_delete_location_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    loc = Location(household_id=household.id, name="Keep")
    db_session.add(loc)
    await db_session.commit()
    svc = LocationService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.delete_location(loc.id, user.id)


# =========================================================================== #
# AllergenService
# =========================================================================== #
async def test_create_allergen_normalizes_name(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    await db_session.commit()
    svc = AllergenService(db_session)
    allergen = await svc.create_allergen(
        user.id, household.id, AllergenCreate(name="  Peanuts  ")
    )
    assert allergen.name == "peanuts"  # stripped + lowercased


async def test_create_allergen_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    await db_session.commit()
    svc = AllergenService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.create_allergen(user.id, household.id, AllergenCreate(name="milk"))


async def test_list_household_allergens(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    db_session.add_all([
        HouseholdAllergen(household_id=household.id, name="soy"),
        HouseholdAllergen(household_id=household.id, name="egg"),
    ])
    await db_session.commit()
    svc = AllergenService(db_session)
    names = [a.name for a in await svc.list_household_allergens(household.id, user.id)]
    assert names == ["egg", "soy"]


async def test_delete_allergen_editor_and_not_found(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.EDITOR)
    allergen = HouseholdAllergen(household_id=household.id, name="gluten")
    db_session.add(allergen)
    await db_session.commit()
    svc = AllergenService(db_session)
    await svc.delete_allergen(allergen.id, user.id)
    assert await svc.list_household_allergens(household.id, user.id) == []
    with pytest.raises(NotFoundError):
        await svc.delete_allergen(9999, user.id)


async def test_delete_allergen_viewer_rejected(db_session):
    user, household = await _setup_household(db_session, role=MemberRole.VIEWER)
    allergen = HouseholdAllergen(household_id=household.id, name="fish")
    db_session.add(allergen)
    await db_session.commit()
    svc = AllergenService(db_session)
    with pytest.raises(AuthorizationError):
        await svc.delete_allergen(allergen.id, user.id)


# =========================================================================== #
# UserService
# =========================================================================== #
async def test_get_user_by_id_found_and_not_found(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    await db_session.commit()
    svc = UserService(db_session)
    assert (await svc.get_user_by_id(user.id)).id == user.id
    with pytest.raises(NotFoundError):
        await svc.get_user_by_id(9999)


async def test_update_user_profile_changes_fields(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u")
    await db_session.commit()
    svc = UserService(db_session)
    updated = await svc.update_user_profile(
        user.id, UserUpdate(first_name="Ada", username="ada")
    )
    assert updated.first_name == "Ada" and updated.username == "ada"


async def test_update_user_profile_duplicate_username_rejected(db_session):
    await _make_user(db_session, email="taken@example.com", username="taken")
    user = await _make_user(db_session, email="u@example.com", username="u")
    await db_session.commit()
    svc = UserService(db_session)
    with pytest.raises(ValidationError):
        await svc.update_user_profile(user.id, UserUpdate(username="taken"))


async def test_update_user_profile_duplicate_email_rejected(db_session):
    await _make_user(db_session, email="taken@example.com", username="other")
    user = await _make_user(db_session, email="u@example.com", username="u")
    await db_session.commit()
    svc = UserService(db_session)
    with pytest.raises(ValidationError):
        await svc.update_user_profile(user.id, UserUpdate(email="taken@example.com"))


async def test_change_password_success(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u",
                            password="OldPass1")
    await db_session.commit()
    svc = UserService(db_session)
    await svc.change_password(
        user.id, PasswordChange(current_password="OldPass1", new_password="NewPass2")
    )
    await db_session.refresh(user)
    assert verify_password("NewPass2", user.hashed_password)


async def test_change_password_wrong_current_rejected(db_session):
    user = await _make_user(db_session, email="u@example.com", username="u",
                            password="OldPass1")
    await db_session.commit()
    svc = UserService(db_session)
    with pytest.raises(AuthenticationError):
        await svc.change_password(
            user.id, PasswordChange(current_password="WrongPass9", new_password="NewPass2")
        )
