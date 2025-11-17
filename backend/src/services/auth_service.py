"""Authentication service for user registration and login."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.core.exceptions import AlreadyExistsError, AuthenticationError, NotFoundError
from src.core.logging import setup_logging
from src.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token_type,
)
from src.models.refresh_token import RefreshToken
from src.models.user import User
from src.schemas.user import TokenResponse, UserCreate, UserLogin
from src.services.email_service import EmailService

logger = setup_logging()
settings = get_settings()


class AuthService:
    """Service for authentication operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, user_data: UserCreate) -> User:
        """Register a new user."""
        # Check if email already exists
        result = await self.db.execute(select(User).where(User.email == user_data.email))
        if result.scalars().first():
            raise AlreadyExistsError(
                message="User with this email already exists",
                details={"email": user_data.email},
            )

        # Check if username already exists
        result = await self.db.execute(select(User).where(User.username == user_data.username))
        if result.scalars().first():
            raise AlreadyExistsError(
                message="User with this username already exists",
                details={"username": user_data.username},
            )

        # Create new user (not verified by default - they need to confirm email)
        hashed_pw = hash_password(user_data.password)
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_pw,
            is_verified=False,  # New users must verify email
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        logger.info("User registered", user_id=user.id, email=user.email)

        # Send confirmation email if SMTP is configured
        smtp_settings = await EmailService.get_smtp_settings(self.db)
        if smtp_settings and smtp_settings.smtp_host and smtp_settings.require_email_confirmation:
            try:
                # Get base URL from settings or use default
                base_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
                await EmailService.send_confirmation_email(self.db, user, base_url)
                logger.info("Confirmation email sent", user_id=user.id, email=user.email)
                # Refresh user after email service commits the token
                await self.db.refresh(user)
            except Exception as e:
                logger.error(
                    "Failed to send confirmation email",
                    user_id=user.id,
                    email=user.email,
                    error=str(e),
                )
                # Don't fail registration if email sending fails
                # User can request a new confirmation email later

        return user

    async def login(self, login_data: UserLogin) -> TokenResponse:
        """Authenticate user and return tokens."""
        # Find user by email
        result = await self.db.execute(select(User).where(User.email == login_data.email))
        user = result.scalars().first()

        if not user:
            raise AuthenticationError(message="Invalid email or password")

        # Check if this is an OAuth-only user
        if user.hashed_password is None:
            provider_name = user.oauth_provider.title() if user.oauth_provider else "OAuth"
            raise AuthenticationError(
                message=f"This account uses {provider_name} authentication. Please sign in with {provider_name}."
            )

        # Verify password
        if not verify_password(login_data.password, user.hashed_password):
            raise AuthenticationError(message="Invalid email or password")

        # Check if user is active
        if not user.is_active:
            raise AuthenticationError(message="User account is disabled")

        # Check if email is verified (only if SMTP is configured and requires confirmation)
        smtp_settings = await EmailService.get_smtp_settings(self.db)
        if smtp_settings and smtp_settings.require_email_confirmation:
            if not user.is_verified:
                raise AuthenticationError(
                    message="Email not verified. Please check your email for a confirmation link."
                )

        # Generate tokens
        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "site_role": user.site_role
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

        logger.info("User logged in", user_id=user.id, email=user.email)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh_access_token(self, refresh_token: str) -> TokenResponse:
        """Generate new access token from refresh token."""
        # Verify token type
        payload = verify_token_type(refresh_token, "refresh")
        user_id = int(payload["sub"])

        # Check if refresh token exists and is valid
        result = await self.db.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token,
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,  # noqa: E712
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        stored_token = result.scalars().first()

        if not stored_token:
            raise AuthenticationError(message="Invalid or expired refresh token")

        # Get user
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()

        if not user or not user.is_active:
            raise AuthenticationError(message="User not found or inactive")

        # Generate new access token
        access_token = create_access_token({
            "sub": str(user.id),
            "email": user.email,
            "site_role": user.site_role
        })

        logger.info("Access token refreshed", user_id=user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # Return same refresh token
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def revoke_refresh_token(self, refresh_token: str) -> None:
        """Revoke a refresh token (logout)."""
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token == refresh_token)
        )
        token = result.scalars().first()

        if token:
            token.is_revoked = True
            await self.db.commit()
            logger.info("Refresh token revoked", user_id=token.user_id)

    async def get_user_by_id(self, user_id: int) -> User:
        """Get user by ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()

        if not user:
            raise NotFoundError(message="User not found", details={"user_id": user_id})

        return user
