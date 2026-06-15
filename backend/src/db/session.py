"""Database session management."""
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.config import get_settings

settings = get_settings()

# Create async engine. NullPool (used in tests) does not accept pool sizing
# arguments, so only pass them when a real pool is in use.
_engine_kwargs: dict[str, Any] = {"echo": settings.DATABASE_ECHO}
if settings.ENVIRONMENT == "test":
    _engine_kwargs["poolclass"] = NullPool
else:
    _engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    _engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW

engine = create_async_engine(str(settings.DATABASE_URL), **_engine_kwargs)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database (create tables)."""
    from src.db.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db() -> None:
    """Drop all database tables (for testing)."""
    from src.db.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
