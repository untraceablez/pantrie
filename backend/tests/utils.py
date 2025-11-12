"""Test utilities and helper functions."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.category import Category
from src.models.location import Location


async def create_test_category(
    session: AsyncSession,
    name: str = "Test Category",
    description: str | None = None,
    icon: str | None = None,
) -> Category:
    """Create a test category."""
    category = Category(
        name=name,
        description=description or f"Test description for {name}",
        icon=icon or "📦",
    )
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


async def create_test_location(
    session: AsyncSession,
    name: str = "Test Location",
    description: str | None = None,
    icon: str | None = None,
) -> Location:
    """Create a test location."""
    location = Location(
        name=name,
        description=description or f"Test description for {name}",
        icon=icon or "📍",
    )
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return location


def assert_timestamp_fields(obj: Any) -> None:
    """Assert that an object has valid timestamp fields."""
    assert hasattr(obj, "created_at")
    assert hasattr(obj, "updated_at")
    assert obj.created_at is not None
    assert obj.updated_at is not None
    assert obj.created_at <= obj.updated_at
