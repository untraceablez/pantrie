"""
Site settings API endpoints for site administrators.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import get_current_site_admin
from src.db.session import get_db
from src.models.system_settings import SystemSettings
from src.models.user import User

router = APIRouter(prefix="/site-settings", tags=["site-settings"])


class SMTPSettingsResponse(BaseModel):
    """Response model for SMTP settings."""
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str | None = None
    smtp_use_tls: bool = True
    require_email_confirmation: bool = True


class SMTPSettingsUpdate(BaseModel):
    """Request model for updating SMTP settings."""
    smtp_host: str = Field(..., description="SMTP server hostname")
    smtp_port: int = Field(..., ge=1, le=65535, description="SMTP server port")
    smtp_user: str | None = Field(None, description="SMTP username (optional)")
    smtp_password: str | None = Field(None, description="SMTP password (optional)")
    smtp_from_email: EmailStr = Field(..., description="From email address")
    smtp_from_name: str = Field(default="Pantrie", description="From name for emails")
    smtp_use_tls: bool = Field(default=True, description="Use TLS encryption")
    require_email_confirmation: bool = Field(default=True, description="Require email confirmation for new users")


class ProxySettingsResponse(BaseModel):
    """Response model for reverse proxy settings."""
    proxy_mode: str = "none"  # Options: "none", "builtin", "external"
    external_proxy_url: str | None = None
    custom_domain: str | None = None
    use_https: bool = True


class ProxySettingsUpdate(BaseModel):
    """Request model for updating reverse proxy settings."""
    proxy_mode: str = Field(..., description="Proxy mode: none, builtin, or external")
    external_proxy_url: str | None = Field(None, description="External proxy URL (if using external)")
    custom_domain: str | None = Field(None, description="Custom domain for the application")
    use_https: bool = Field(default=True, description="Use HTTPS")


@router.get("/smtp", response_model=SMTPSettingsResponse)
async def get_smtp_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> SMTPSettingsResponse:
    """
    Get SMTP settings.

    Requires site administrator role.
    """
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()

    if not settings:
        return SMTPSettingsResponse()

    # Don't return the password for security
    return SMTPSettingsResponse(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_from_email=settings.smtp_from_email,
        smtp_from_name=settings.smtp_from_name,
        smtp_use_tls=settings.smtp_use_tls,
        require_email_confirmation=settings.require_email_confirmation,
    )


@router.put("/smtp", response_model=SMTPSettingsResponse)
async def update_smtp_settings(
    settings_update: SMTPSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> SMTPSettingsResponse:
    """
    Update SMTP settings.

    Requires site administrator role.
    """
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()

    if settings is None:
        # Create new settings
        settings = SystemSettings(
            smtp_host=settings_update.smtp_host,
            smtp_port=settings_update.smtp_port,
            smtp_user=settings_update.smtp_user,
            smtp_password=settings_update.smtp_password,
            smtp_from_email=settings_update.smtp_from_email,
            smtp_from_name=settings_update.smtp_from_name,
            smtp_use_tls=settings_update.smtp_use_tls,
            require_email_confirmation=settings_update.require_email_confirmation,
        )
        db.add(settings)
    else:
        # Update existing settings
        settings.smtp_host = settings_update.smtp_host
        settings.smtp_port = settings_update.smtp_port
        settings.smtp_user = settings_update.smtp_user
        # Only update password if provided
        if settings_update.smtp_password:
            settings.smtp_password = settings_update.smtp_password
        settings.smtp_from_email = settings_update.smtp_from_email
        settings.smtp_from_name = settings_update.smtp_from_name
        settings.smtp_use_tls = settings_update.smtp_use_tls
        settings.require_email_confirmation = settings_update.require_email_confirmation

    await db.commit()
    await db.refresh(settings)

    return SMTPSettingsResponse(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_from_email=settings.smtp_from_email,
        smtp_from_name=settings.smtp_from_name,
        smtp_use_tls=settings.smtp_use_tls,
        require_email_confirmation=settings.require_email_confirmation,
    )


@router.get("/proxy", response_model=ProxySettingsResponse)
async def get_proxy_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> ProxySettingsResponse:
    """
    Get reverse proxy settings.

    Requires site administrator role.
    """
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()

    if not settings:
        return ProxySettingsResponse()

    return ProxySettingsResponse(
        proxy_mode=settings.proxy_mode or "none",
        external_proxy_url=settings.external_proxy_url,
        custom_domain=settings.custom_domain,
        use_https=settings.use_https,
    )


@router.put("/proxy", response_model=ProxySettingsResponse)
async def update_proxy_settings(
    settings_update: ProxySettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> ProxySettingsResponse:
    """
    Update reverse proxy settings.

    Requires site administrator role.
    """
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()

    if settings is None:
        # Create new settings
        settings = SystemSettings(
            proxy_mode=settings_update.proxy_mode,
            external_proxy_url=settings_update.external_proxy_url,
            custom_domain=settings_update.custom_domain,
            use_https=settings_update.use_https,
        )
        db.add(settings)
    else:
        # Update existing settings
        settings.proxy_mode = settings_update.proxy_mode
        settings.external_proxy_url = settings_update.external_proxy_url
        settings.custom_domain = settings_update.custom_domain
        settings.use_https = settings_update.use_https

    await db.commit()
    await db.refresh(settings)

    return ProxySettingsResponse(
        proxy_mode=settings.proxy_mode or "none",
        external_proxy_url=settings.external_proxy_url,
        custom_domain=settings.custom_domain,
        use_https=settings.use_https,
    )
