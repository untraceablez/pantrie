"""
Service for handling initial application setup.
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ValidationError
from src.models.user import User
from src.models.household import Household
from src.schemas.user import UserCreate
from src.schemas.household import HouseholdCreate
from src.services.auth_service import AuthService
from src.services.household_service import HouseholdService


class SetupService:
    """Service for managing initial application setup."""

    @staticmethod
    async def is_setup_complete(db: AsyncSession) -> bool:
        """
        Check if initial setup has been completed.
        Setup is considered complete if there is at least one user in the system.

        Args:
            db: Database session

        Returns:
            True if setup is complete, False otherwise
        """
        result = await db.execute(select(func.count(User.id)))
        user_count = result.scalar()
        return user_count > 0

    @staticmethod
    async def perform_initial_setup(
        db: AsyncSession,
        admin_email: str,
        admin_username: str,
        admin_password: str,
        household_name: str,
    ) -> dict:
        """
        Perform initial application setup.

        Creates the first admin user and their household.

        Args:
            db: Database session
            admin_email: Email for the admin user
            admin_username: Username for the admin user
            admin_password: Password for the admin user
            household_name: Name for the initial household

        Returns:
            Dict with user and household information

        Raises:
            ValidationError: If setup is already complete
        """
        # Check if setup is already complete
        if await SetupService.is_setup_complete(db):
            raise ValidationError("Setup has already been completed")

        # Create admin user
        user_create = UserCreate(
            email=admin_email,
            username=admin_username,
            password=admin_password,
        )

        auth_service = AuthService(db)
        user = await auth_service.register(user_create)

        # Create household with user as admin
        household_create = HouseholdCreate(name=household_name)
        household_service = HouseholdService(db)
        household = await household_service.create_household(
            user_id=user.id,
            household_data=household_create,
        )

        return {
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
            },
            "household": {
                "id": household.id,
                "name": household.name,
            },
            "message": "Initial setup completed successfully",
        }
