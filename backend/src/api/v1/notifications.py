"""
Notification settings API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.core.dependencies import get_current_site_admin, get_current_user
from src.db.session import get_db
from src.models.system_settings import SystemSettings
from src.models.webhook import Webhook
from src.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


# Email Notification Settings Schemas
class EmailNotificationSettingsResponse(BaseModel):
    """Response model for email notification settings."""
    email_notifications_enabled: bool = False
    notify_expiring_items: bool = True
    notify_low_stock: bool = True
    notify_new_member: bool = True
    expiry_warning_days: int = 7
    smtp_configured: bool = False  # Whether SMTP is configured


class EmailNotificationSettingsUpdate(BaseModel):
    """Request model for updating email notification settings."""
    email_notifications_enabled: bool = Field(..., description="Enable email notifications")
    notify_expiring_items: bool = Field(default=True, description="Notify about expiring items")
    notify_low_stock: bool = Field(default=True, description="Notify about low stock items")
    notify_new_member: bool = Field(default=True, description="Notify about new household members")
    expiry_warning_days: int = Field(default=7, ge=1, le=30, description="Days before expiry to warn")


# Webhook Schemas
class WebhookCreate(BaseModel):
    """Request model for creating a webhook."""
    name: str = Field(..., min_length=1, max_length=255, description="Webhook name")
    url: str = Field(..., description="Webhook URL")
    secret: str | None = Field(None, max_length=255, description="Secret for HMAC signature")
    event_types: List[str] = Field(
        default=["expiring_items", "low_stock", "new_member"],
        description="Event types to trigger webhook"
    )
    household_id: int | None = Field(None, description="Household ID (null for all)")


class WebhookUpdate(BaseModel):
    """Request model for updating a webhook."""
    name: str | None = Field(None, min_length=1, max_length=255)
    url: str | None = Field(None)
    secret: str | None = Field(None, max_length=255)
    is_active: bool | None = Field(None)
    event_types: List[str] | None = Field(None)


class WebhookResponse(BaseModel):
    """Response model for a webhook."""
    id: int
    name: str
    url: str
    is_active: bool
    event_types: List[str]
    household_id: int | None
    created_by_id: int

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_events(cls, webhook: Webhook) -> "WebhookResponse":
        """Create response from ORM model, parsing event_types."""
        return cls(
            id=webhook.id,
            name=webhook.name,
            url=webhook.url,
            is_active=webhook.is_active,
            event_types=webhook.event_types.split(",") if webhook.event_types else [],
            household_id=webhook.household_id,
            created_by_id=webhook.created_by_id,
        )


class WebhookTestRequest(BaseModel):
    """Request model for testing a webhook."""
    webhook_id: int


class WebhookTestResponse(BaseModel):
    """Response model for webhook test result."""
    success: bool
    status_code: int | None = None
    message: str


# Email Notification Endpoints
@router.get("/email", response_model=EmailNotificationSettingsResponse)
async def get_email_notification_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> EmailNotificationSettingsResponse:
    """
    Get email notification settings.

    Requires site administrator role.
    """
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()

    if not settings:
        return EmailNotificationSettingsResponse()

    return EmailNotificationSettingsResponse(
        email_notifications_enabled=settings.email_notifications_enabled,
        notify_expiring_items=settings.notify_expiring_items,
        notify_low_stock=settings.notify_low_stock,
        notify_new_member=settings.notify_new_member,
        expiry_warning_days=settings.expiry_warning_days,
        smtp_configured=bool(settings.smtp_host and settings.smtp_port),
    )


@router.put("/email", response_model=EmailNotificationSettingsResponse)
async def update_email_notification_settings(
    settings_update: EmailNotificationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_site_admin),
) -> EmailNotificationSettingsResponse:
    """
    Update email notification settings.

    Requires site administrator role.
    """
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()

    if settings is None:
        # Create new settings
        settings = SystemSettings(
            email_notifications_enabled=settings_update.email_notifications_enabled,
            notify_expiring_items=settings_update.notify_expiring_items,
            notify_low_stock=settings_update.notify_low_stock,
            notify_new_member=settings_update.notify_new_member,
            expiry_warning_days=settings_update.expiry_warning_days,
        )
        db.add(settings)
    else:
        # Update existing settings
        settings.email_notifications_enabled = settings_update.email_notifications_enabled
        settings.notify_expiring_items = settings_update.notify_expiring_items
        settings.notify_low_stock = settings_update.notify_low_stock
        settings.notify_new_member = settings_update.notify_new_member
        settings.expiry_warning_days = settings_update.expiry_warning_days

    await db.commit()
    await db.refresh(settings)

    return EmailNotificationSettingsResponse(
        email_notifications_enabled=settings.email_notifications_enabled,
        notify_expiring_items=settings.notify_expiring_items,
        notify_low_stock=settings.notify_low_stock,
        notify_new_member=settings.notify_new_member,
        expiry_warning_days=settings.expiry_warning_days,
        smtp_configured=bool(settings.smtp_host and settings.smtp_port),
    )


# Webhook Endpoints
@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[WebhookResponse]:
    """
    List all webhooks for the current user.

    Site admins can see all webhooks. Regular users see only their own.
    """
    if current_user.site_role == "site_administrator":
        result = await db.execute(select(Webhook))
    else:
        result = await db.execute(
            select(Webhook).where(Webhook.created_by_id == current_user.id)
        )

    webhooks = result.scalars().all()
    return [WebhookResponse.from_orm_with_events(w) for w in webhooks]


@router.post("/webhooks", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    webhook_data: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WebhookResponse:
    """
    Create a new webhook.
    """
    # Only site admins can create webhooks without household association
    if webhook_data.household_id is None and current_user.site_role != "site_administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only site administrators can create global webhooks"
        )

    webhook = Webhook(
        name=webhook_data.name,
        url=webhook_data.url,
        secret=webhook_data.secret,
        event_types=",".join(webhook_data.event_types),
        household_id=webhook_data.household_id,
        created_by_id=current_user.id,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)

    return WebhookResponse.from_orm_with_events(webhook)


@router.get("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WebhookResponse:
    """
    Get a specific webhook by ID.
    """
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Check permissions
    if current_user.site_role != "site_administrator" and webhook.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return WebhookResponse.from_orm_with_events(webhook)


@router.put("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: int,
    webhook_data: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WebhookResponse:
    """
    Update a webhook.
    """
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Check permissions
    if current_user.site_role != "site_administrator" and webhook.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    if webhook_data.name is not None:
        webhook.name = webhook_data.name
    if webhook_data.url is not None:
        webhook.url = webhook_data.url
    if webhook_data.secret is not None:
        webhook.secret = webhook_data.secret
    if webhook_data.is_active is not None:
        webhook.is_active = webhook_data.is_active
    if webhook_data.event_types is not None:
        webhook.event_types = ",".join(webhook_data.event_types)

    await db.commit()
    await db.refresh(webhook)

    return WebhookResponse.from_orm_with_events(webhook)


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a webhook.
    """
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Check permissions
    if current_user.site_role != "site_administrator" and webhook.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await db.delete(webhook)
    await db.commit()


@router.post("/webhooks/{webhook_id}/test", response_model=WebhookTestResponse)
async def test_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WebhookTestResponse:
    """
    Test a webhook by sending a test payload.
    """
    import httpx
    import json
    import hmac
    import hashlib
    from datetime import datetime, timezone

    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Check permissions
    if current_user.site_role != "site_administrator" and webhook.created_by_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Create test payload
    payload = {
        "event": "test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "message": "This is a test webhook from Pantrie",
            "webhook_name": webhook.name,
        }
    }

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Pantrie-Webhook/1.0",
        "X-Pantrie-Event": "test",
    }

    # Add HMAC signature if secret is configured
    if webhook.secret:
        payload_bytes = json.dumps(payload).encode()
        signature = hmac.new(
            webhook.secret.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        headers["X-Pantrie-Signature"] = f"sha256={signature}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook.url,
                json=payload,
                headers=headers,
            )

            if response.status_code >= 200 and response.status_code < 300:
                return WebhookTestResponse(
                    success=True,
                    status_code=response.status_code,
                    message="Webhook test successful"
                )
            else:
                return WebhookTestResponse(
                    success=False,
                    status_code=response.status_code,
                    message=f"Webhook returned error status: {response.status_code}"
                )
    except httpx.TimeoutException:
        return WebhookTestResponse(
            success=False,
            message="Webhook request timed out"
        )
    except httpx.RequestError as e:
        return WebhookTestResponse(
            success=False,
            message=f"Failed to connect to webhook: {str(e)}"
        )
