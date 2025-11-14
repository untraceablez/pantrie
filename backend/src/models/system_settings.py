"""System settings model for storing application configuration."""
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class SystemSettings(Base):
    """System-wide settings."""

    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # SMTP Configuration
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Email confirmation settings
    require_email_confirmation: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Reverse Proxy Configuration
    proxy_mode: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default="none"
    )  # Options: "none", "builtin", "external"
    external_proxy_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    custom_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    use_https: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
