"""OAuth service for handling OAuth authentication with external providers."""
from datetime import datetime, timedelta, timezone
from typing import Literal

from authlib.integrations.starlette_client import OAuth
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.exceptions import AuthenticationError, ConfigurationError
from src.core.logging import setup_logging
from src.core.security import create_access_token, create_refresh_token
from src.models.refresh_token import RefreshToken
from src.models.user import User
from src.schemas.user import TokenResponse

logger = setup_logging()
settings = get_settings()

# Initialize OAuth client
oauth = OAuth()

# Register Google OAuth provider
if settings.OAUTH_GOOGLE_CLIENT_ID and settings.OAUTH_GOOGLE_CLIENT_SECRET:
    oauth.register(
        name='google',
        client_id=settings.OAUTH_GOOGLE_CLIENT_ID,
        client_secret=settings.OAUTH_GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile',
        },
    )
    logger.info("Google OAuth provider registered")
else:
    logger.warning("Google OAuth credentials not configured")

# Register Authentik OAuth provider
if (
    settings.OAUTH_AUTHENTIK_CLIENT_ID
    and settings.OAUTH_AUTHENTIK_CLIENT_SECRET
    and settings.OAUTH_AUTHENTIK_BASE_URL
    and settings.OAUTH_AUTHENTIK_SLUG
):
    oauth.register(
        name='authentik',
        client_id=settings.OAUTH_AUTHENTIK_CLIENT_ID,
        client_secret=settings.OAUTH_AUTHENTIK_CLIENT_SECRET,
        server_metadata_url=f'{settings.OAUTH_AUTHENTIK_BASE_URL}/application/o/{settings.OAUTH_AUTHENTIK_SLUG}/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile',
        },
    )
    logger.info("Authentik OAuth provider registered")
else:
    logger.warning("Authentik OAuth credentials not configured")


OAuthProvider = Literal["google", "authentik"]


class OAuthService:
    """Service for OAuth operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def get_provider_config(provider: OAuthProvider) -> dict:
        """Get OAuth configuration for a provider."""
        if provider == "google":
            if not settings.OAUTH_GOOGLE_CLIENT_ID or not settings.OAUTH_GOOGLE_CLIENT_SECRET:
                raise ConfigurationError(
                    message="Google OAuth is not configured",
                    details={"provider": provider},
                )
            return {
                "client_id": settings.OAUTH_GOOGLE_CLIENT_ID,
                "client_secret": settings.OAUTH_GOOGLE_CLIENT_SECRET,
                "name": "Google",
            }
        elif provider == "authentik":
            if (
                not settings.OAUTH_AUTHENTIK_CLIENT_ID
                or not settings.OAUTH_AUTHENTIK_CLIENT_SECRET
                or not settings.OAUTH_AUTHENTIK_BASE_URL
                or not settings.OAUTH_AUTHENTIK_SLUG
            ):
                raise ConfigurationError(
                    message="Authentik OAuth is not configured",
                    details={"provider": provider},
                )
            return {
                "client_id": settings.OAUTH_AUTHENTIK_CLIENT_ID,
                "client_secret": settings.OAUTH_AUTHENTIK_CLIENT_SECRET,
                "base_url": settings.OAUTH_AUTHENTIK_BASE_URL,
                "slug": settings.OAUTH_AUTHENTIK_SLUG,
                "name": "Authentik",
            }
        else:
            raise ConfigurationError(
                message="Unsupported OAuth provider",
                details={"provider": provider},
            )

    async def get_authorization_url(self, provider: OAuthProvider, redirect_uri: str) -> str:
        """Get OAuth authorization URL for a provider."""
        # Verify provider is configured
        self.get_provider_config(provider)

        # Get OAuth client for provider
        client = oauth.create_client(provider)
        if not client:
            raise ConfigurationError(
                message=f"{provider.title()} OAuth client not registered",
                details={"provider": provider},
            )

        # Generate authorization URL
        redirect_uri_full = f"{redirect_uri}"
        return await client.authorize_redirect(redirect_uri_full)

    async def handle_callback(
        self, provider: OAuthProvider, code: str, redirect_uri: str, request
    ) -> TokenResponse:
        """Handle OAuth callback and create/login user."""
        # Verify provider is configured
        config = self.get_provider_config(provider)

        # Get OAuth client for provider
        client = oauth.create_client(provider)
        if not client:
            raise ConfigurationError(
                message=f"{provider.title()} OAuth client not registered",
                details={"provider": provider},
            )

        # Exchange code for token
        try:
            token = await client.authorize_access_token(request)
        except Exception as e:
            logger.error(
                "OAuth token exchange failed",
                provider=provider,
                error=str(e),
            )
            raise AuthenticationError(
                message="Failed to authenticate with OAuth provider",
                details={"provider": provider, "error": str(e)},
            )

        # Parse user info from token
        try:
            user_info = token.get("userinfo")
            if not user_info:
                # Try to parse from id_token if userinfo not present
                user_info = await client.parse_id_token(token)

            email = user_info.get("email")
            email_verified = user_info.get("email_verified", False)
            oauth_id = user_info.get("sub")
            first_name = user_info.get("given_name")
            last_name = user_info.get("family_name")
            avatar_url = user_info.get("picture")

            if not email or not oauth_id:
                raise AuthenticationError(
                    message="OAuth provider did not return required user information",
                    details={"provider": provider},
                )

        except Exception as e:
            logger.error(
                "Failed to parse OAuth user info",
                provider=provider,
                error=str(e),
            )
            raise AuthenticationError(
                message="Failed to parse user information from OAuth provider",
                details={"provider": provider, "error": str(e)},
            )

        # Find or create user
        user = await self._find_or_create_oauth_user(
            provider=provider,
            oauth_id=oauth_id,
            email=email,
            email_verified=email_verified,
            first_name=first_name,
            last_name=last_name,
            avatar_url=avatar_url,
        )

        # Check if user is active
        if not user.is_active:
            raise AuthenticationError(message="User account is disabled")

        # Generate tokens
        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "site_role": user.site_role,
        })
        refresh_token_str = create_refresh_token({"sub": str(user.id)})

        # Store refresh token
        refresh_token = RefreshToken(
            user_id=user.id,
            token=refresh_token_str,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.add(refresh_token)
        await self.db.commit()

        logger.info(
            "User logged in via OAuth",
            user_id=user.id,
            email=user.email,
            provider=provider,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def _find_or_create_oauth_user(
        self,
        provider: OAuthProvider,
        oauth_id: str,
        email: str,
        email_verified: bool,
        first_name: str | None = None,
        last_name: str | None = None,
        avatar_url: str | None = None,
    ) -> User:
        """Find existing user or create new OAuth user with auto-linking."""
        # First, try to find user by OAuth provider and ID
        result = await self.db.execute(
            select(User).where(
                User.oauth_provider == provider,
                User.oauth_id == oauth_id,
            )
        )
        user = result.scalars().first()

        if user:
            # Update user info if changed
            updated = False
            if first_name and user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if avatar_url and user.avatar_url != avatar_url:
                user.avatar_url = avatar_url
                updated = True
            if email_verified and not user.is_verified:
                user.is_verified = True
                user.email_confirmed_at = datetime.now(timezone.utc)
                updated = True

            if updated:
                await self.db.commit()
                await self.db.refresh(user)
                logger.info(
                    "OAuth user info updated",
                    user_id=user.id,
                    provider=provider,
                )

            return user

        # If email is verified, try to find existing user by email to auto-link
        if email_verified:
            result = await self.db.execute(select(User).where(User.email == email))
            existing_user = result.scalars().first()

            if existing_user:
                # Auto-link OAuth account to existing user
                existing_user.oauth_provider = provider
                existing_user.oauth_id = oauth_id
                existing_user.is_verified = True
                existing_user.email_confirmed_at = datetime.now(timezone.utc)

                # Update profile info if not already set
                if not existing_user.first_name and first_name:
                    existing_user.first_name = first_name
                if not existing_user.last_name and last_name:
                    existing_user.last_name = last_name
                if not existing_user.avatar_url and avatar_url:
                    existing_user.avatar_url = avatar_url

                await self.db.commit()
                await self.db.refresh(existing_user)

                logger.info(
                    "OAuth account linked to existing user",
                    user_id=existing_user.id,
                    email=email,
                    provider=provider,
                )

                return existing_user

        # Create new OAuth user
        # Generate username from email (use part before @)
        username_base = email.split("@")[0]
        username = username_base

        # Ensure username is unique
        counter = 1
        while True:
            result = await self.db.execute(select(User).where(User.username == username))
            if not result.scalars().first():
                break
            username = f"{username_base}{counter}"
            counter += 1

        # Create user without password (OAuth-only account)
        new_user = User(
            email=email,
            username=username,
            hashed_password=None,  # OAuth-only user has no password
            oauth_provider=provider,
            oauth_id=oauth_id,
            is_verified=email_verified,  # Trust verified OAuth email
            email_confirmed_at=datetime.now(timezone.utc) if email_verified else None,
            first_name=first_name,
            last_name=last_name,
            avatar_url=avatar_url,
            is_active=True,
        )

        self.db.add(new_user)
        await self.db.commit()
        await self.db.refresh(new_user)

        logger.info(
            "New OAuth user created",
            user_id=new_user.id,
            email=email,
            provider=provider,
        )

        return new_user
