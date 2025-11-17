"""
Site administration API endpoints for managing users and households.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_site_admin
from src.core.security import hash_password
from src.db.session import get_db
from src.models.user import User
from src.models.household import Household
from src.models.household_membership import HouseholdMembership

router = APIRouter(prefix="/site-admin", tags=["site-admin"])


# User Management Schemas
class UserListItem(BaseModel):
    """User list item response."""
    id: int
    email: str
    username: str
    is_active: bool
    is_verified: bool
    site_role: str
    created_at: str
    household_count: int


class UserDetail(BaseModel):
    """Detailed user response."""
    id: int
    email: str
    username: str
    first_name: str | None
    last_name: str | None
    is_active: bool
    is_verified: bool
    site_role: str
    created_at: str
    updated_at: str


class UserCreate(BaseModel):
    """Create user request."""
    email: EmailStr
    username: str
    password: str
    first_name: str | None = None
    last_name: str | None = None
    is_verified: bool = False
    site_role: str = "user"


class UserUpdate(BaseModel):
    """Update user request."""
    email: EmailStr | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None
    is_verified: bool | None = None
    site_role: str | None = None
    password: str | None = None


# Household Management Schemas
class HouseholdListItem(BaseModel):
    """Household list item response."""
    id: int
    name: str
    created_at: str
    member_count: int


class HouseholdDetail(BaseModel):
    """Detailed household response."""
    id: int
    name: str
    created_at: str
    updated_at: str
    members: list[dict]


class HouseholdCreate(BaseModel):
    """Create household request."""
    name: str
    admin_user_id: int


class HouseholdUpdate(BaseModel):
    """Update household request."""
    name: str | None = None


# User Management Endpoints
@router.get("/users", response_model=list[UserListItem])
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> list[UserListItem]:
    """
    List all users in the system.

    Requires site administrator role.
    """
    # Get all users with household count
    result = await db.execute(
        select(
            User,
            func.count(HouseholdMembership.household_id).label("household_count")
        )
        .outerjoin(HouseholdMembership, User.id == HouseholdMembership.user_id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
    )

    users_data = result.all()

    return [
        UserListItem(
            id=user.id,
            email=user.email,
            username=user.username,
            is_active=user.is_active,
            is_verified=user.is_verified,
            site_role=user.site_role,
            created_at=user.created_at.isoformat(),
            household_count=household_count,
        )
        for user, household_count in users_data
    ]


@router.get("/users/{user_id}", response_model=UserDetail)
async def get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> UserDetail:
    """
    Get detailed information about a specific user.

    Requires site administrator role.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserDetail(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        site_role=user.site_role,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.post("/users", response_model=UserDetail, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> UserDetail:
    """
    Create a new user.

    Requires site administrator role.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    # Check if username already exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this username already exists",
        )

    # Create user
    hashed_pw = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_pw,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_verified=user_data.is_verified,
        site_role=user_data.site_role,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserDetail(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        site_role=user.site_role,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.put("/users/{user_id}", response_model=UserDetail)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_site_admin),
) -> UserDetail:
    """
    Update a user.

    Requires site administrator role.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Prevent admin from removing their own site_administrator role
    if user.id == current_admin.id and user_data.site_role and user_data.site_role != "site_administrator":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own site administrator role",
        )

    # Update fields if provided
    if user_data.email is not None:
        # Check if new email is already taken
        if user_data.email != user.email:
            result = await db.execute(select(User).where(User.email == user_data.email))
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already in use",
                )
        user.email = user_data.email

    if user_data.username is not None:
        # Check if new username is already taken
        if user_data.username != user.username:
            result = await db.execute(select(User).where(User.username == user_data.username))
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already in use",
                )
        user.username = user_data.username

    if user_data.first_name is not None:
        user.first_name = user_data.first_name
    if user_data.last_name is not None:
        user.last_name = user_data.last_name
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.is_verified is not None:
        user.is_verified = user_data.is_verified
    if user_data.site_role is not None:
        user.site_role = user_data.site_role
    if user_data.password is not None:
        user.hashed_password = hash_password(user_data.password)

    await db.commit()
    await db.refresh(user)

    return UserDetail(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        site_role=user.site_role,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_site_admin),
):
    """
    Delete a user.

    Requires site administrator role.
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await db.delete(user)
    await db.commit()


# Household Management Endpoints
@router.get("/households", response_model=list[HouseholdListItem])
async def list_all_households(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> list[HouseholdListItem]:
    """
    List all households in the system.

    Requires site administrator role.
    """
    result = await db.execute(
        select(
            Household,
            func.count(HouseholdMembership.user_id).label("member_count")
        )
        .outerjoin(HouseholdMembership, Household.id == HouseholdMembership.household_id)
        .group_by(Household.id)
        .order_by(Household.created_at.desc())
    )

    households_data = result.all()

    return [
        HouseholdListItem(
            id=household.id,
            name=household.name,
            created_at=household.created_at.isoformat(),
            member_count=member_count,
        )
        for household, member_count in households_data
    ]


@router.get("/households/{household_id}", response_model=HouseholdDetail)
async def get_household_detail(
    household_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> HouseholdDetail:
    """
    Get detailed information about a specific household.

    Requires site administrator role.
    """
    result = await db.execute(select(Household).where(Household.id == household_id))
    household = result.scalar_one_or_none()

    if not household:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found",
        )

    # Get members
    members_result = await db.execute(
        select(HouseholdMembership, User)
        .join(User, HouseholdMembership.user_id == User.id)
        .where(HouseholdMembership.household_id == household_id)
    )

    members = [
        {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": member.role,
        }
        for member, user in members_result.all()
    ]

    return HouseholdDetail(
        id=household.id,
        name=household.name,
        created_at=household.created_at.isoformat(),
        updated_at=household.updated_at.isoformat(),
        members=members,
    )


@router.post("/households", response_model=HouseholdDetail, status_code=status.HTTP_201_CREATED)
async def create_household(
    household_data: HouseholdCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> HouseholdDetail:
    """
    Create a new household.

    Requires site administrator role.
    """
    # Verify admin user exists
    result = await db.execute(select(User).where(User.id == household_data.admin_user_id))
    admin_user = result.scalar_one_or_none()

    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found",
        )

    # Create household
    household = Household(name=household_data.name)
    db.add(household)
    await db.flush()

    # Add admin as member
    member = HouseholdMembership(
        household_id=household.id,
        user_id=admin_user.id,
        role="admin",
    )
    db.add(member)

    await db.commit()
    await db.refresh(household)

    members = [{
        "user_id": admin_user.id,
        "username": admin_user.username,
        "email": admin_user.email,
        "role": "admin",
    }]

    return HouseholdDetail(
        id=household.id,
        name=household.name,
        created_at=household.created_at.isoformat(),
        updated_at=household.updated_at.isoformat(),
        members=members,
    )


@router.put("/households/{household_id}", response_model=HouseholdDetail)
async def update_household(
    household_id: int,
    household_data: HouseholdUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> HouseholdDetail:
    """
    Update a household.

    Requires site administrator role.
    """
    result = await db.execute(select(Household).where(Household.id == household_id))
    household = result.scalar_one_or_none()

    if not household:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found",
        )

    if household_data.name is not None:
        household.name = household_data.name

    await db.commit()
    await db.refresh(household)

    # Get members
    members_result = await db.execute(
        select(HouseholdMembership, User)
        .join(User, HouseholdMembership.user_id == User.id)
        .where(HouseholdMembership.household_id == household_id)
    )

    members = [
        {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": member.role,
        }
        for member, user in members_result.all()
    ]

    return HouseholdDetail(
        id=household.id,
        name=household.name,
        created_at=household.created_at.isoformat(),
        updated_at=household.updated_at.isoformat(),
        members=members,
    )


@router.delete("/households/{household_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_household(
    household_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
):
    """
    Delete a household.

    Requires site administrator role.
    """
    result = await db.execute(select(Household).where(Household.id == household_id))
    household = result.scalar_one_or_none()

    if not household:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Household not found",
        )

    await db.delete(household)
    await db.commit()
