"""
Reset database by deleting all data.
"""
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from src.config import settings


async def clear_database():
    """Delete all data from database tables."""
    engine = create_async_engine(settings.database_url)

    try:
        async with engine.begin() as conn:
            # Delete in order to respect foreign key constraints
            print("Deleting inventory items...")
            await conn.execute(text('DELETE FROM inventory_items'))

            print("Deleting household allergens...")
            await conn.execute(text('DELETE FROM household_allergens'))

            print("Deleting household members...")
            await conn.execute(text('DELETE FROM household_members'))

            print("Deleting households...")
            await conn.execute(text('DELETE FROM households'))

            print("Deleting users...")
            await conn.execute(text('DELETE FROM users'))

            print("\n✓ All data deleted successfully!")
            print("\nThe application is now ready for initial setup.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    print("=" * 50)
    print("Database Reset Script")
    print("=" * 50)
    print("\nWARNING: This will delete ALL data from the database!")
    print("Press Ctrl+C to cancel...\n")

    try:
        asyncio.run(clear_database())
    except KeyboardInterrupt:
        print("\n\nReset cancelled.")
