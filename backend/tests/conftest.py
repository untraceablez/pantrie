"""Pytest configuration and fixtures for backend tests."""
import asyncio
import os
from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import Settings, get_settings
from src.db.base import Base
from src.db.session import get_db
from src.main import app

# Test database URL. Defaults to localhost (native/hybrid dev); override with
# TEST_DATABASE_URL when running inside the backend container (host=postgres).
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie_test",
)


def get_test_settings() -> Settings:
    """Get test settings."""
    settings = Settings(
        DATABASE_URL=TEST_DATABASE_URL,
        ENVIRONMENT="test",
        DEBUG=True,
        DATABASE_ECHO=False,
    )
    return settings


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine() -> AsyncGenerator[Any, None]:
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=None,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(test_engine: Any) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(autouse=True)
async def _clean_tables(test_engine: Any) -> AsyncGenerator[None, None]:
    """Truncate all tables before each test for isolation.

    Fixtures here commit data, so a session rollback is not enough. Cleaning at
    setup (rather than teardown) guarantees a clean slate for the test about to
    run, independent of any prior test's teardown timing.
    """
    async with test_engine.begin() as conn:
        tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
        if tables:
            await conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def override_get_db(db_session: AsyncSession) -> Generator[None, None, None]:
    """Override the get_db dependency."""

    async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def override_get_settings() -> Generator[None, None, None]:
    """Override the get_settings dependency."""
    app.dependency_overrides[get_settings] = get_test_settings
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client(override_get_db: None, override_get_settings: None) -> TestClient:
    """Create a test client."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def async_client(
    override_get_db: None, override_get_settings: None
) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def admin_household(db_session: AsyncSession) -> dict[str, Any]:
    """Create an admin user who owns a household.

    Returns a dict with ``user`` (User), ``household`` (Household), and
    ``auth_headers`` (Bearer token for that user).
    """
    from src.core.security import create_access_token, hash_password
    from src.models.household import Household
    from src.models.household_membership import HouseholdMembership, MemberRole
    from src.models.user import User

    user = User(
        email="admin@example.com",
        username="admin",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    household = Household(name="Test Household", description="for tests")
    db_session.add(household)
    await db_session.flush()

    db_session.add(
        HouseholdMembership(
            user_id=user.id, household_id=household.id, role=MemberRole.ADMIN
        )
    )
    await db_session.commit()

    token = create_access_token({"sub": str(user.id)})
    return {
        "user": user,
        "household": household,
        "auth_headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
async def editor_headers(
    db_session: AsyncSession, admin_household: dict[str, Any]
) -> dict[str, str]:
    """Auth headers for a non-admin (editor) member of the admin's household."""
    from src.core.security import create_access_token, hash_password
    from src.models.household_membership import HouseholdMembership, MemberRole
    from src.models.user import User

    editor = User(
        email="editor@example.com",
        username="editor",
        hashed_password=hash_password("password123"),
        is_active=True,
        is_verified=True,
    )
    db_session.add(editor)
    await db_session.flush()
    db_session.add(
        HouseholdMembership(
            user_id=editor.id,
            household_id=admin_household["household"].id,
            role=MemberRole.EDITOR,
        )
    )
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': str(editor.id)})}"}
