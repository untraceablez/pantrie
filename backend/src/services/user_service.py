"""User service for managing user profiles."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AuthenticationError, NotFoundError, ValidationError
from src.core.logging import setup_logging
from src.core.security import hash_password, verify_password
from src.models.user import User
from src.schemas.user import PasswordChange, UserUpdate

logger = setup_logging()


class UserService:
    """Service for user profile operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_id(self, user_id: int) -> User:
        """Get user by ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalars().first()

        if not user:
            raise NotFoundError(
                message="User not found",
                details={"user_id": user_id},
            )

        return user

    async def update_user_profile(
        self, user_id: int, update_data: UserUpdate
    ) -> User:
        """Update user profile information."""
        user = await self.get_user_by_id(user_id)

        update_dict = update_data.model_dump(exclude_unset=True)

        # Check if username is being changed and if it's already taken
        if "username" in update_dict and update_dict["username"] != user.username:
            existing = await self.db.execute(
                select(User).where(User.username == update_dict["username"])
            )
            if existing.scalars().first():
                raise ValidationError(
                    message="Username already taken",
                    details={"username": update_dict["username"]},
                )

        # Check if email is being changed and if it's already taken
        if "email" in update_dict and update_dict["email"] != user.email:
            existing = await self.db.execute(
                select(User).where(User.email == update_dict["email"])
            )
            if existing.scalars().first():
                raise ValidationError(
                    message="Email already taken",
                    details={"email": update_dict["email"]},
                )

        # Update fields
        for field, value in update_dict.items():
            setattr(user, field, value)

        await self.db.commit()
        await self.db.refresh(user)

        logger.info(
            "User profile updated",
            user_id=user_id,
            fields=list(update_dict.keys()),
        )

        return user

    async def change_password(
        self, user_id: int, password_change: PasswordChange
    ) -> None:
        """Change user password."""
        user = await self.get_user_by_id(user_id)

        # Verify current password
        if not verify_password(password_change.current_password, user.hashed_password):
            raise AuthenticationError(
                message="Current password is incorrect",
                details={},
            )

        # Hash and set new password
        user.hashed_password = hash_password(password_change.new_password)

        await self.db.commit()

        logger.info(
            "User password changed",
            user_id=user_id,
        )
