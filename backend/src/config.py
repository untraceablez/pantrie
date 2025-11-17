"""Application configuration using pydantic-settings."""
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Pantrie"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: PostgresDsn = Field(
        default="postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie"
    )
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: RedisDsn = Field(default="redis://localhost:6379/0")
    REDIS_CACHE_TTL: int = 3600  # 1 hour

    # Security
    SECRET_KEY: str = Field(
        default="change-me-in-production-use-openssl-rand-hex-32"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OAuth
    OAUTH_GOOGLE_CLIENT_ID: str | None = None
    OAUTH_GOOGLE_CLIENT_SECRET: str | None = None
    OAUTH_GITHUB_CLIENT_ID: str | None = None
    OAUTH_GITHUB_CLIENT_SECRET: str | None = None
    OAUTH_AUTHENTIK_CLIENT_ID: str | None = None
    OAUTH_AUTHENTIK_CLIENT_SECRET: str | None = None
    OAUTH_AUTHENTIK_BASE_URL: str | None = None  # e.g., https://auth.example.com
    OAUTH_AUTHENTIK_SLUG: str | None = None  # Application slug in Authentik

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://localhost:5175"]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str] | None) -> list[str]:
        """Parse CORS origins from comma-separated string or list."""
        if v is None or v == "":
            return ["http://localhost:3000", "http://localhost:5173", "http://localhost:5175"]
        if isinstance(v, str):
            # If it looks like JSON, it will be parsed by pydantic automatically
            # If it's comma-separated, split it
            if not v.startswith("["):
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return v
        return ["http://localhost:3000", "http://localhost:5173", "http://localhost:5175"]

    # External APIs
    OPEN_FOOD_FACTS_API_URL: str = "https://world.openfoodfacts.org/api/v2"
    GOOGLE_VISION_API_KEY: str | None = None
    MEALIE_API_URL: str | None = None
    MEALIE_API_KEY: str | None = None

    # Storage (S3-compatible)
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    S3_BUCKET_NAME: str = "pantrie-images"
    S3_REGION: str = "us-east-1"

    # Email
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "noreply@pantrie.app"

    # Celery
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
