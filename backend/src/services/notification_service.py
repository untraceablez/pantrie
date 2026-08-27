"""
Notification service for sending notifications via email and webhooks.
"""
import hmac
import hashlib
import json
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import Settings, get_settings
from src.core.logging import setup_logging
from src.models.household_membership import HouseholdMembership
from src.models.notification_dispatch import NotificationDispatch
from src.models.system_settings import SystemSettings
from src.models.webhook import Webhook
from src.models.user import User
from src.models.household import Household
from src.models.inventory_item import InventoryItem
from src.services.email_service import EmailService
from src.services.inventory_service import InventoryService

logger = setup_logging()

# Event types the daily digest can dispatch; mirrors the webhook vocabulary.
EVENT_EXPIRING_ITEMS = "expiring_items"
EVENT_LOW_STOCK = "low_stock"


class NotificationService:
    """Service for sending notifications via various channels."""

    @staticmethod
    async def get_notification_settings(db: AsyncSession) -> Optional[SystemSettings]:
        """Get notification settings from database."""
        result = await db.execute(select(SystemSettings))
        return result.scalar_one_or_none()

    @staticmethod
    def _location_name(item: Any) -> str:
        """Name of an item's storage location, or 'Unknown'.

        ``InventoryItem`` has no mapped ``location`` relationship, so the
        attribute is only present when a caller attaches it (see
        ``InventoryService._attach_locations``).
        """
        location = getattr(item, "location", None)
        return location.name if location is not None else "Unknown"

    @staticmethod
    async def send_webhook(
        webhook: Webhook,
        event_type: str,
        data: Dict[str, Any],
    ) -> bool:
        """
        Send a webhook notification.

        Args:
            webhook: Webhook configuration
            event_type: Type of event (e.g., 'expiring_items', 'low_stock', 'new_member')
            data: Event data payload

        Returns:
            True if webhook was sent successfully
        """
        if not webhook.is_active:
            return False

        # Check if this event type is enabled for this webhook
        enabled_events = webhook.event_types.split(",") if webhook.event_types else []
        if event_type not in enabled_events:
            return False

        payload = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Pantrie-Webhook/1.0",
            "X-Pantrie-Event": event_type,
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
                return response.status_code >= 200 and response.status_code < 300
        except Exception as e:
            print(f"Failed to send webhook to {webhook.url}: {str(e)}")
            return False

    @staticmethod
    async def notify_expiring_items(
        db: AsyncSession,
        items: List[InventoryItem],
        household: Household,
        recipients: List[User],
    ) -> Dict[str, int]:
        """
        Send notifications about expiring items.

        Args:
            db: Database session
            items: List of expiring items
            household: Household the items belong to
            recipients: Users to notify

        Returns:
            Dict with counts of successful email and webhook notifications
        """
        settings = await NotificationService.get_notification_settings(db)
        results = {"emails_sent": 0, "webhooks_sent": 0}

        if not settings or not settings.notify_expiring_items:
            return results

        # Build item list for notifications
        item_list = [
            {
                "name": item.name,
                "expiration_date": item.expiration_date.isoformat() if item.expiration_date else None,
                "location": NotificationService._location_name(item),
                "quantity": item.quantity,
            }
            for item in items
        ]

        # Send email notifications
        if settings.email_notifications_enabled and settings.smtp_host:
            for user in recipients:
                success = await NotificationService._send_expiring_items_email(
                    db, user, household, item_list
                )
                if success:
                    results["emails_sent"] += 1

        # Send webhook notifications
        webhook_data = {
            "household_id": household.id,
            "household_name": household.name,
            "items": item_list,
            "item_count": len(items),
        }

        result = await db.execute(
            select(Webhook).where(
                (Webhook.household_id == household.id) | (Webhook.household_id.is_(None)),
                Webhook.is_active == True,
            )
        )
        webhooks = result.scalars().all()

        for webhook in webhooks:
            success = await NotificationService.send_webhook(
                webhook, "expiring_items", webhook_data
            )
            if success:
                results["webhooks_sent"] += 1

        return results

    @staticmethod
    async def _send_expiring_items_email(
        db: AsyncSession,
        user: User,
        household: Household,
        items: List[Dict[str, Any]],
    ) -> bool:
        """Send expiring items notification email to a user."""
        subject = f"Expiring Items Alert - {household.name}"

        items_html = ""
        for item in items:
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['name']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['expiration_date'] or 'N/A'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['location']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['quantity']}</td>
            </tr>
            """

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th {{ background-color: #f3f4f6; padding: 10px; text-align: left; }}
                .footer {{ margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Expiring Items Alert</h1>
                </div>
                <div class="content">
                    <p>Hi {user.username},</p>
                    <p>The following items in <strong>{household.name}</strong> are expiring soon:</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Expiration Date</th>
                                <th>Location</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                    <p style="margin-top: 20px;">Consider using these items soon or adding them to your shopping list!</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from Pantrie.</p>
                </div>
            </div>
        </body>
        </html>
        """

        items_text = "\n".join(
            [f"  - {item['name']} (expires: {item['expiration_date'] or 'N/A'}, location: {item['location']})"
             for item in items]
        )

        text_body = f"""
        Expiring Items Alert - {household.name}

        Hi {user.username},

        The following items are expiring soon:

        {items_text}

        Consider using these items soon or adding them to your shopping list!

        This is an automated message from Pantrie.
        """

        return await EmailService.send_email(
            db=db,
            to_email=user.email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

    @staticmethod
    async def notify_new_member(
        db: AsyncSession,
        new_user: User,
        household: Household,
        added_by: User,
        recipients: List[User],
    ) -> Dict[str, int]:
        """
        Send notifications about a new household member.

        Args:
            db: Database session
            new_user: The user who was added
            household: Household the user was added to
            added_by: User who added the new member
            recipients: Users to notify

        Returns:
            Dict with counts of successful notifications
        """
        settings = await NotificationService.get_notification_settings(db)
        results = {"emails_sent": 0, "webhooks_sent": 0}

        if not settings or not settings.notify_new_member:
            return results

        # Send email notifications
        if settings.email_notifications_enabled and settings.smtp_host:
            for user in recipients:
                if user.id != new_user.id:  # Don't notify the new member about themselves
                    success = await NotificationService._send_new_member_email(
                        db, user, new_user, household, added_by
                    )
                    if success:
                        results["emails_sent"] += 1

        # Send webhook notifications
        webhook_data = {
            "household_id": household.id,
            "household_name": household.name,
            "new_member": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
            },
            "added_by": {
                "id": added_by.id,
                "username": added_by.username,
            },
        }

        result = await db.execute(
            select(Webhook).where(
                (Webhook.household_id == household.id) | (Webhook.household_id.is_(None)),
                Webhook.is_active == True,
            )
        )
        webhooks = result.scalars().all()

        for webhook in webhooks:
            success = await NotificationService.send_webhook(
                webhook, "new_member", webhook_data
            )
            if success:
                results["webhooks_sent"] += 1

        return results

    @staticmethod
    async def _send_new_member_email(
        db: AsyncSession,
        recipient: User,
        new_user: User,
        household: Household,
        added_by: User,
    ) -> bool:
        """Send new member notification email."""
        subject = f"New Member Added - {household.name}"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .member-card {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
                .footer {{ margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Household Member</h1>
                </div>
                <div class="content">
                    <p>Hi {recipient.username},</p>
                    <p>A new member has been added to <strong>{household.name}</strong>:</p>
                    <div class="member-card">
                        <p><strong>Username:</strong> {new_user.username}</p>
                        <p><strong>Email:</strong> {new_user.email}</p>
                        <p><strong>Added by:</strong> {added_by.username}</p>
                    </div>
                    <p>They can now view and manage items in your household inventory.</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from Pantrie.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        New Household Member - {household.name}

        Hi {recipient.username},

        A new member has been added to {household.name}:

        Username: {new_user.username}
        Email: {new_user.email}
        Added by: {added_by.username}

        They can now view and manage items in your household inventory.

        This is an automated message from Pantrie.
        """

        return await EmailService.send_email(
            db=db,
            to_email=recipient.email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

    @staticmethod
    async def notify_low_stock(
        db: AsyncSession,
        items: List[InventoryItem],
        household: Household,
        recipients: List[User],
    ) -> Dict[str, int]:
        """
        Send notifications about low stock items.

        Args:
            db: Database session
            items: List of low stock items
            household: Household the items belong to
            recipients: Users to notify

        Returns:
            Dict with counts of successful notifications
        """
        settings = await NotificationService.get_notification_settings(db)
        results = {"emails_sent": 0, "webhooks_sent": 0}

        if not settings or not settings.notify_low_stock:
            return results

        # Build item list for notifications
        item_list = [
            {
                "name": item.name,
                "quantity": item.quantity,
                "location": NotificationService._location_name(item),
            }
            for item in items
        ]

        # Send email notifications
        if settings.email_notifications_enabled and settings.smtp_host:
            for user in recipients:
                success = await NotificationService._send_low_stock_email(
                    db, user, household, item_list
                )
                if success:
                    results["emails_sent"] += 1

        # Send webhook notifications
        webhook_data = {
            "household_id": household.id,
            "household_name": household.name,
            "items": item_list,
            "item_count": len(items),
        }

        result = await db.execute(
            select(Webhook).where(
                (Webhook.household_id == household.id) | (Webhook.household_id.is_(None)),
                Webhook.is_active == True,
            )
        )
        webhooks = result.scalars().all()

        for webhook in webhooks:
            success = await NotificationService.send_webhook(
                webhook, "low_stock", webhook_data
            )
            if success:
                results["webhooks_sent"] += 1

        return results

    @staticmethod
    async def _send_low_stock_email(
        db: AsyncSession,
        user: User,
        household: Household,
        items: List[Dict[str, Any]],
    ) -> bool:
        """Send low stock notification email to a user."""
        subject = f"Low Stock Alert - {household.name}"

        items_html = ""
        for item in items:
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['name']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['quantity']}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{item['location']}</td>
            </tr>
            """

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th {{ background-color: #f3f4f6; padding: 10px; text-align: left; }}
                .footer {{ margin-top: 20px; text-align: center; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Low Stock Alert</h1>
                </div>
                <div class="content">
                    <p>Hi {user.username},</p>
                    <p>The following items in <strong>{household.name}</strong> are running low:</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                    <p style="margin-top: 20px;">Consider restocking these items soon!</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from Pantrie.</p>
                </div>
            </div>
        </body>
        </html>
        """

        items_text = "\n".join(
            [f"  - {item['name']} (qty: {item['quantity']}, location: {item['location']})"
             for item in items]
        )

        text_body = f"""
        Low Stock Alert - {household.name}

        Hi {user.username},

        The following items are running low:

        {items_text}

        Consider restocking these items soon!

        This is an automated message from Pantrie.
        """

        return await EmailService.send_email(
            db=db,
            to_email=user.email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

    # ------------------------------------------------------------------ #
    # Scheduled daily digest
    # ------------------------------------------------------------------ #

    @staticmethod
    async def already_dispatched(
        db: AsyncSession,
        household_id: int,
        event_type: str,
        on_date: date,
    ) -> bool:
        """
        Check whether a digest already went out for a household today.

        Args:
            db: Database session
            household_id: Household the digest belongs to
            event_type: 'expiring_items' or 'low_stock'
            on_date: Day to check

        Returns:
            True if a dispatch has already been recorded for that day
        """
        result = await db.execute(
            select(NotificationDispatch.id).where(
                NotificationDispatch.household_id == household_id,
                NotificationDispatch.event_type == event_type,
                NotificationDispatch.dispatch_date == on_date,
            )
        )
        return result.scalars().first() is not None

    @staticmethod
    async def record_dispatch(
        db: AsyncSession,
        household_id: int,
        event_type: str,
        on_date: date,
        item_count: int,
        results: Dict[str, int],
    ) -> NotificationDispatch:
        """
        Record that a digest was dispatched, so it is not sent again today.

        Args:
            db: Database session
            household_id: Household the digest belongs to
            event_type: 'expiring_items' or 'low_stock'
            on_date: Day the digest was dispatched
            item_count: Number of items in the digest
            results: Counts returned by the notify_* orchestrator

        Returns:
            The persisted dispatch record
        """
        record = NotificationDispatch(
            household_id=household_id,
            event_type=event_type,
            dispatch_date=on_date,
            item_count=item_count,
            emails_sent=results.get("emails_sent", 0),
            webhooks_sent=results.get("webhooks_sent", 0),
        )
        db.add(record)
        await db.commit()
        return record

    @staticmethod
    async def get_household_recipients(
        db: AsyncSession, household_id: int
    ) -> List[User]:
        """
        Get the active users who should receive a household's notifications.

        Args:
            db: Database session
            household_id: Household to look up members for

        Returns:
            Active members of the household, ordered by user ID
        """
        result = await db.execute(
            select(User)
            .join(HouseholdMembership, HouseholdMembership.user_id == User.id)
            .where(
                HouseholdMembership.household_id == household_id,
                User.is_active.is_(True),
            )
            .order_by(User.id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def _dispatch_digest(
        db: AsyncSession,
        event_type: str,
        household: Household,
        recipients: List[User],
        items: List[InventoryItem],
        on_date: date,
        summary: Dict[str, int],
    ) -> None:
        """Send one household's digest for one event type, once per day."""
        if not items:
            return

        if await NotificationService.already_dispatched(
            db, household.id, event_type, on_date
        ):
            summary["skipped_duplicates"] += 1
            logger.info(
                "Digest already dispatched today, skipping",
                household_id=household.id,
                event_type=event_type,
                dispatch_date=on_date.isoformat(),
            )
            return

        if event_type == EVENT_EXPIRING_ITEMS:
            results = await NotificationService.notify_expiring_items(
                db, items, household, recipients
            )
        else:
            results = await NotificationService.notify_low_stock(
                db, items, household, recipients
            )

        await NotificationService.record_dispatch(
            db,
            household_id=household.id,
            event_type=event_type,
            on_date=on_date,
            item_count=len(items),
            results=results,
        )

        summary[f"{event_type}_dispatched"] += 1
        summary["emails_sent"] += results.get("emails_sent", 0)
        summary["webhooks_sent"] += results.get("webhooks_sent", 0)
        logger.info(
            "Digest dispatched",
            household_id=household.id,
            event_type=event_type,
            item_count=len(items),
            emails_sent=results.get("emails_sent", 0),
            webhooks_sent=results.get("webhooks_sent", 0),
        )

    @staticmethod
    async def run_daily_notifications(
        db: AsyncSession,
        app_settings: Optional[Settings] = None,
        on_date: Optional[date] = None,
    ) -> Dict[str, int]:
        """
        Send the daily expiring-items and low-stock digests for every household.

        Reuses the existing email and webhook delivery paths and honours the
        flags stored in ``SystemSettings``. Each (household, event type) pair
        is dispatched at most once per day, so running the job again — after a
        restart, or via an APScheduler misfire catch-up — is a no-op.

        Args:
            db: Database session
            app_settings: Application settings (defaults to the cached ones)
            on_date: Day the digests belong to (defaults to today)

        Returns:
            Dict of per-run counters (households processed, digests dispatched,
            duplicates skipped, errors, emails and webhooks sent)
        """
        config = app_settings or get_settings()
        run_date = on_date or date.today()
        summary = {
            "households_processed": 0,
            f"{EVENT_EXPIRING_ITEMS}_dispatched": 0,
            f"{EVENT_LOW_STOCK}_dispatched": 0,
            "skipped_duplicates": 0,
            "errors": 0,
            "emails_sent": 0,
            "webhooks_sent": 0,
        }

        settings = await NotificationService.get_notification_settings(db)
        if not settings:
            logger.info("Daily notification job skipped: system settings not configured")
            return summary

        if not settings.notify_expiring_items and not settings.notify_low_stock:
            logger.info("Daily notification job skipped: all digests disabled")
            return summary

        within_days = (
            settings.expiry_warning_days or config.NOTIFICATIONS_EXPIRY_WARNING_DAYS
        )
        threshold = config.NOTIFICATIONS_LOW_STOCK_THRESHOLD
        inventory_service = InventoryService(db)

        # IDs, not ORM rows: a rollback below expires loaded instances, so each
        # household is re-fetched inside its own iteration.
        result = await db.execute(select(Household.id).order_by(Household.id))
        household_ids = list(result.scalars().all())

        for household_id in household_ids:
            summary["households_processed"] += 1
            try:
                household = await db.get(Household, household_id)
                recipients = await NotificationService.get_household_recipients(
                    db, household.id
                )

                if settings.notify_expiring_items:
                    expiring = await inventory_service.get_expiring_items(
                        household.id, within_days
                    )
                    await NotificationService._dispatch_digest(
                        db,
                        event_type=EVENT_EXPIRING_ITEMS,
                        household=household,
                        recipients=recipients,
                        items=expiring,
                        on_date=run_date,
                        summary=summary,
                    )

                if settings.notify_low_stock:
                    low_stock = await inventory_service.get_low_stock_items(
                        household.id, threshold
                    )
                    await NotificationService._dispatch_digest(
                        db,
                        event_type=EVENT_LOW_STOCK,
                        household=household,
                        recipients=recipients,
                        items=low_stock,
                        on_date=run_date,
                        summary=summary,
                    )
            except Exception as exc:  # one bad household must not stop the run
                summary["errors"] += 1
                await db.rollback()
                logger.error(
                    "Daily notification digest failed for household",
                    household_id=household_id,
                    error=str(exc),
                )

        logger.info("Daily notification job complete", **summary)
        return summary
