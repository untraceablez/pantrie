"""
Service for handling initial application setup.
"""
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import ValidationError
from src.models.user import User
from src.models.household import Household
from src.models.system_settings import SystemSettings
from src.schemas.user import UserCreate
from src.schemas.household import HouseholdCreate
from src.schemas.setup import SMTPConfig, ProxyConfig, OAuthConfig
from src.services.auth_service import AuthService
from src.services.household_service import HouseholdService
import os


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
        smtp_config: Optional[SMTPConfig] = None,
        proxy_config: Optional[ProxyConfig] = None,
        oauth_config: Optional[OAuthConfig] = None,
    ) -> dict:
        """
        Perform initial application setup.

        Creates the first admin user, their household, and optionally configures SMTP and proxy.

        Args:
            db: Database session
            admin_email: Email for the admin user
            admin_username: Username for the admin user
            admin_password: Password for the admin user
            household_name: Name for the initial household
            smtp_config: Optional SMTP configuration
            proxy_config: Optional reverse proxy configuration

        Returns:
            Dict with user and household information

        Raises:
            ValidationError: If setup is already complete
        """
        # Check if setup is already complete
        if await SetupService.is_setup_complete(db):
            raise ValidationError("Setup has already been completed")

        # Create admin user (first user is verified by default, no email confirmation needed)
        user_create = UserCreate(
            email=admin_email,
            username=admin_username,
            password=admin_password,
        )

        auth_service = AuthService(db)
        user = await auth_service.register(user_create)

        # Mark first admin user as verified and set as site administrator
        user.is_verified = True
        user.site_role = "site_administrator"
        await db.commit()
        await db.refresh(user)

        # Create household with user as admin
        household_create = HouseholdCreate(name=household_name)
        household_service = HouseholdService(db)
        household = await household_service.create_household(
            user_id=user.id,
            household_data=household_create,
        )

        # Save SMTP and/or proxy configuration if provided
        if smtp_config or proxy_config:
            # Check if system settings already exist
            result = await db.execute(select(SystemSettings))
            settings = result.scalar_one_or_none()

            if settings is None:
                # Create new settings
                settings = SystemSettings(
                    # SMTP config
                    smtp_host=smtp_config.smtp_host if smtp_config else None,
                    smtp_port=smtp_config.smtp_port if smtp_config else None,
                    smtp_user=smtp_config.smtp_user if smtp_config else None,
                    smtp_password=smtp_config.smtp_password if smtp_config else None,
                    smtp_from_email=smtp_config.smtp_from_email if smtp_config else None,
                    smtp_from_name=smtp_config.smtp_from_name if smtp_config else "Pantrie",
                    smtp_use_tls=smtp_config.smtp_use_tls if smtp_config else True,
                    require_email_confirmation=True,
                    # Proxy config
                    proxy_mode=proxy_config.proxy_mode if proxy_config else "none",
                    external_proxy_url=proxy_config.external_proxy_url if proxy_config else None,
                    custom_domain=proxy_config.custom_domain if proxy_config else None,
                    use_https=proxy_config.use_https if proxy_config else True,
                )
                db.add(settings)
            else:
                # Update existing settings
                if smtp_config:
                    settings.smtp_host = smtp_config.smtp_host
                    settings.smtp_port = smtp_config.smtp_port
                    settings.smtp_user = smtp_config.smtp_user
                    settings.smtp_password = smtp_config.smtp_password
                    settings.smtp_from_email = smtp_config.smtp_from_email
                    settings.smtp_from_name = smtp_config.smtp_from_name
                    settings.smtp_use_tls = smtp_config.smtp_use_tls
                    settings.require_email_confirmation = True

                if proxy_config:
                    settings.proxy_mode = proxy_config.proxy_mode
                    settings.external_proxy_url = proxy_config.external_proxy_url
                    settings.custom_domain = proxy_config.custom_domain
                    settings.use_https = proxy_config.use_https

            await db.commit()

        # Write OAuth credentials to .env file if provided
        if oauth_config:
            env_file_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
            env_vars = {}

            # Read existing .env file if it exists
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            env_vars[key] = value

            # Update OAuth credentials
            if oauth_config.google_client_id and oauth_config.google_client_secret:
                env_vars['OAUTH_GOOGLE_CLIENT_ID'] = oauth_config.google_client_id
                env_vars['OAUTH_GOOGLE_CLIENT_SECRET'] = oauth_config.google_client_secret

            if (oauth_config.authentik_client_id and
                oauth_config.authentik_client_secret and
                oauth_config.authentik_base_url and
                oauth_config.authentik_slug):
                env_vars['OAUTH_AUTHENTIK_CLIENT_ID'] = oauth_config.authentik_client_id
                env_vars['OAUTH_AUTHENTIK_CLIENT_SECRET'] = oauth_config.authentik_client_secret
                env_vars['OAUTH_AUTHENTIK_BASE_URL'] = oauth_config.authentik_base_url
                env_vars['OAUTH_AUTHENTIK_SLUG'] = oauth_config.authentik_slug

            # Write back to .env file
            with open(env_file_path, 'w') as f:
                for key, value in env_vars.items():
                    f.write(f'{key}={value}\n')

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
