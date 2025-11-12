"""Database seed script for initial data."""
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import AsyncSessionLocal
from src.models.category import Category
from src.models.location import Location


async def seed_categories(session: AsyncSession) -> None:
    """Seed initial categories."""
    categories = [
        Category(
            name="Fruits",
            description="Fresh and dried fruits",
            icon="🍎",
        ),
        Category(
            name="Vegetables",
            description="Fresh vegetables and greens",
            icon="🥬",
        ),
        Category(
            name="Dairy",
            description="Milk, cheese, yogurt, and dairy products",
            icon="🥛",
        ),
        Category(
            name="Meat",
            description="Fresh and frozen meat products",
            icon="🥩",
        ),
        Category(
            name="Poultry",
            description="Chicken, turkey, and other poultry",
            icon="🍗",
        ),
        Category(
            name="Seafood",
            description="Fish and seafood products",
            icon="🐟",
        ),
        Category(
            name="Grains",
            description="Rice, pasta, bread, and grain products",
            icon="🌾",
        ),
        Category(
            name="Canned Goods",
            description="Canned vegetables, fruits, and other preserved items",
            icon="🥫",
        ),
        Category(
            name="Beverages",
            description="Drinks, juices, and liquid refreshments",
            icon="🥤",
        ),
        Category(
            name="Condiments",
            description="Sauces, dressings, and flavor enhancers",
            icon="🧂",
        ),
        Category(
            name="Snacks",
            description="Chips, crackers, and snack foods",
            icon="🍿",
        ),
        Category(
            name="Frozen Foods",
            description="Frozen meals and ingredients",
            icon="❄️",
        ),
        Category(
            name="Baking",
            description="Flour, sugar, baking ingredients",
            icon="🧁",
        ),
        Category(
            name="Spices",
            description="Herbs, spices, and seasonings",
            icon="🌶️",
        ),
        Category(
            name="Other",
            description="Miscellaneous items",
            icon="📦",
        ),
    ]

    session.add_all(categories)
    await session.commit()


async def seed_locations(session: AsyncSession) -> None:
    """Seed initial locations."""
    locations = [
        Location(
            name="Pantry",
            description="Main pantry storage area",
            icon="🚪",
        ),
        Location(
            name="Refrigerator",
            description="Main refrigerator",
            icon="❄️",
        ),
        Location(
            name="Freezer",
            description="Main freezer compartment",
            icon="🧊",
        ),
        Location(
            name="Kitchen Cabinet",
            description="Kitchen cabinets and cupboards",
            icon="🗄️",
        ),
        Location(
            name="Spice Rack",
            description="Dedicated spice storage",
            icon="🌶️",
        ),
        Location(
            name="Wine Rack",
            description="Wine and beverage storage",
            icon="🍷",
        ),
        Location(
            name="Counter",
            description="Kitchen counter surface",
            icon="🔲",
        ),
        Location(
            name="Other",
            description="Other storage locations",
            icon="📍",
        ),
    ]

    session.add_all(locations)
    await session.commit()


async def seed_all() -> None:
    """Run all seed functions."""
    async with AsyncSessionLocal() as session:
        try:
            # Check if data already exists
            from sqlalchemy import select

            result = await session.execute(select(Category))
            if result.scalars().first():
                print("Categories already exist. Skipping seed.")
            else:
                await seed_categories(session)
                print("✓ Seeded categories")

            result = await session.execute(select(Location))
            if result.scalars().first():
                print("Locations already exist. Skipping seed.")
            else:
                await seed_locations(session)
                print("✓ Seeded locations")

        except Exception as e:
            await session.rollback()
            print(f"Error seeding database: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(seed_all())
