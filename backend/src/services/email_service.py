"""
Email service for sending emails via SMTP.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.system_settings import SystemSettings
from src.models.user import User


class EmailService:
    """Service for sending emails."""

    @staticmethod
    async def get_smtp_settings(db: AsyncSession) -> Optional[SystemSettings]:
        """Get SMTP settings from database."""
        result = await db.execute(select(SystemSettings))
        return result.scalar_one_or_none()

    @staticmethod
    def generate_confirmation_token() -> str:
        """Generate a secure random token for email confirmation."""
        return secrets.token_urlsafe(32)

    @staticmethod
    async def send_email(
        db: AsyncSession,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send an email using configured SMTP settings.

        Args:
            db: Database session
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML body content
            text_body: Plain text body content (optional)

        Returns:
            True if email was sent successfully, False otherwise
        """
        settings = await EmailService.get_smtp_settings(db)

        if not settings or not settings.smtp_host:
            print("Email service not configured - SMTP settings missing")
            return False

        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
            msg["To"] = to_email

            # Attach text body if provided
            if text_body:
                msg.attach(MIMEText(text_body, "plain"))

            # Attach HTML body
            msg.attach(MIMEText(html_body, "html"))

            # Connect to SMTP server and send
            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)

            # Login if credentials provided
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)

            # Send email
            server.send_message(msg)
            server.quit()

            print(f"Email sent successfully to {to_email}")
            return True

        except Exception as e:
            print(f"Failed to send email to {to_email}: {str(e)}")
            return False

    @staticmethod
    async def send_confirmation_email(
        db: AsyncSession, user: User, base_url: str = "http://localhost:5173"
    ) -> bool:
        """
        Send email confirmation to a user.

        Args:
            db: Database session
            user: User object
            base_url: Base URL for the application

        Returns:
            True if email was sent successfully
        """
        # Generate confirmation token
        token = EmailService.generate_confirmation_token()

        # Save token to user
        user.email_confirmation_token = token
        user.email_confirmation_sent_at = datetime.now(timezone.utc)
        await db.commit()

        # Build confirmation URL
        confirmation_url = f"{base_url}/confirm-email?token={token}"

        # Create email content
        subject = "Confirm Your Email - Pantrie"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #2563eb;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 8px 8px 0 0;
                }}
                .content {{
                    background-color: #f9fafb;
                    padding: 30px;
                    border-radius: 0 0 8px 8px;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 30px;
                    background-color: #2563eb;
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                }}
                .footer {{
                    margin-top: 20px;
                    text-align: center;
                    color: #6b7280;
                    font-size: 14px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Pantrie!</h1>
                </div>
                <div class="content">
                    <p>Hi {user.username},</p>
                    <p>Thank you for registering with Pantrie. To complete your registration, please confirm your email address by clicking the button below:</p>
                    <div style="text-align: center;">
                        <a href="{confirmation_url}" class="button">Confirm Email Address</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #2563eb;">{confirmation_url}</p>
                    <p>This link will expire in 24 hours.</p>
                    <p>If you didn't create an account with Pantrie, you can safely ignore this email.</p>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_body = f"""
        Welcome to Pantrie!

        Hi {user.username},

        Thank you for registering with Pantrie. To complete your registration, please confirm your email address by visiting this link:

        {confirmation_url}

        This link will expire in 24 hours.

        If you didn't create an account with Pantrie, you can safely ignore this email.
        """

        return await EmailService.send_email(
            db=db, to_email=user.email, subject=subject, html_body=html_body, text_body=text_body
        )

    @staticmethod
    async def verify_confirmation_token(db: AsyncSession, token: str) -> Optional[User]:
        """
        Verify an email confirmation token and return the associated user.

        Args:
            db: Database session
            token: Confirmation token

        Returns:
            User object if token is valid, None otherwise
        """
        # Find user with this token
        result = await db.execute(
            select(User).where(User.email_confirmation_token == token)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        # Check if token has expired (24 hours)
        if user.email_confirmation_sent_at:
            expiry_time = user.email_confirmation_sent_at + timedelta(hours=24)
            if datetime.now(timezone.utc) > expiry_time:
                return None

        return user

    @staticmethod
    async def confirm_email(db: AsyncSession, token: str) -> bool:
        """
        Confirm a user's email address using their confirmation token.

        Args:
            db: Database session
            token: Confirmation token

        Returns:
            True if confirmation was successful, False otherwise
        """
        user = await EmailService.verify_confirmation_token(db, token)

        if not user:
            return False

        # Mark email as confirmed
        user.is_verified = True
        user.email_confirmed_at = datetime.now(timezone.utc)
        user.email_confirmation_token = None  # Clear the token

        await db.commit()
        return True
