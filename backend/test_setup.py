"""Test setup endpoint"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from src.config import get_settings
settings = get_settings()
from src.services.setup_service import SetupService

async def test_setup():
    engine = create_async_engine(str(settings.DATABASE_URL))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            result = await SetupService.perform_initial_setup(
                db=db,
                admin_email="test@test.com",
                admin_username="admin",
                admin_password="Test1234",
                household_name="Test Home"
            )
            print("Success!", result)
        except Exception as e:
            print(f"Error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_setup())
