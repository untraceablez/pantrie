"""Common dependencies for API endpoints."""
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.deps import get_current_user
from src.db.session import get_db
from src.models.user import User


async def get_current_site_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency to verify current user is a site administrator.

    Args:
        current_user: Current authenticated user

    Returns:
        User object if they are a site administrator

    Raises:
        403: If user is not a site administrator
    """
    if current_user.site_role != "site_administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only site administrators can access this resource",
        )
    return current_user
