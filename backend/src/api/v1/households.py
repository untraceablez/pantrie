"""Household API endpoints."""
from fastapi import APIRouter, Depends, status

from src.core.deps import CurrentUserId, DbSession
from src.models.household_membership import MemberRole
from src.schemas.household import (
    AddMemberRequest,
    HouseholdCreate,
    HouseholdMemberUpdate,
    HouseholdResponse,
    HouseholdUpdate,
    HouseholdWithMembership,
)
from src.services.household_service import HouseholdService

router = APIRouter(prefix="/households", tags=["Households"])


@router.post("", response_model=HouseholdResponse, status_code=status.HTTP_201_CREATED)
async def create_household(
    household_data: HouseholdCreate,
    user_id: CurrentUserId,
    db: DbSession,
) -> HouseholdResponse:
    """Create a new household."""
    household_service = HouseholdService(db)
    household = await household_service.create_household(user_id, household_data)
    return HouseholdResponse.model_validate(household)


@router.get("", response_model=list[HouseholdWithMembership])
async def list_households(
    user_id: CurrentUserId,
    db: DbSession,
) -> list[HouseholdWithMembership]:
    """List all households the current user is a member of."""
    household_service = HouseholdService(db)
    return await household_service.list_user_households(user_id)


@router.get("/{household_id}", response_model=HouseholdWithMembership)
async def get_household(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> HouseholdWithMembership:
    """Get household by ID."""
    household_service = HouseholdService(db)
    return await household_service.get_household_by_id(household_id, user_id)


@router.put("/{household_id}", response_model=HouseholdResponse)
async def update_household(
    household_id: int,
    update_data: HouseholdUpdate,
    user_id: CurrentUserId,
    db: DbSession,
) -> HouseholdResponse:
    """Update household information (admin only)."""
    household_service = HouseholdService(db)
    household = await household_service.update_household(household_id, user_id, update_data)
    return HouseholdResponse.model_validate(household)


@router.delete("/{household_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_household(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Delete household (admin only)."""
    household_service = HouseholdService(db)
    await household_service.delete_household(household_id, user_id)


# Member management endpoints


@router.get("/{household_id}/members")
async def list_household_members(
    household_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> list[dict]:
    """List all members of a household."""
    household_service = HouseholdService(db)
    return await household_service.list_household_members(household_id, user_id)


@router.post("/{household_id}/members", status_code=status.HTTP_201_CREATED)
async def add_household_member(
    household_id: int,
    member_data: AddMemberRequest,
    user_id: CurrentUserId,
    db: DbSession,
) -> dict:
    """Add a new member to the household (admin only)."""
    household_service = HouseholdService(db)
    return await household_service.add_household_member(
        household_id, user_id, member_data.email, member_data.role
    )


@router.patch("/{household_id}/members/{membership_id}")
async def update_member_role(
    household_id: int,
    membership_id: int,
    update_data: HouseholdMemberUpdate,
    user_id: CurrentUserId,
    db: DbSession,
) -> dict:
    """Update a member's role in the household (admin only)."""
    household_service = HouseholdService(db)
    return await household_service.update_member_role(
        household_id, user_id, membership_id, update_data.role
    )


@router.delete("/{household_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_household_member(
    household_id: int,
    membership_id: int,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Remove a member from the household (admin only)."""
    household_service = HouseholdService(db)
    await household_service.remove_household_member(household_id, user_id, membership_id)
