"""
Notification service for sending notifications via email and webhooks.
"""
import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.system_settings import SystemSettings
from src.models.webhook import Webhook
from src.models.user import User
from src.models.household import Household
from src.models.inventory_item import InventoryItem
from src.services.email_service import EmailService


class NotificationService:
    """Service for sending notifications via various channels."""

    @staticmethod
    async def get_notification_settings(db: AsyncSession) -> Optional[SystemSettings]:
        """Get notification settings from database."""
        result = await db.execute(select(SystemSettings))
        return result.scalar_one_or_none()

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
                "location": item.location.name if item.location else "Unknown",
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
                "location": item.location.name if item.location else "Unknown",
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
