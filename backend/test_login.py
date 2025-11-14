"""Test script to debug login issue."""
import asyncio
import getpass
from sqlalchemy import select
from src.db.session import AsyncSessionLocal
from src.models.user import User
from src.core.security import verify_password, create_access_token, decode_token

async def test_login(email: str, password: str):
    """Test login credentials."""
    async with AsyncSessionLocal() as db:
        # Find user
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if not user:
            print(f"❌ User not found with email: {email}")
            return

        print(f"✓ User found: ID={user.id}, email={user.email}, username={user.username}")
        print(f"  is_active={user.is_active}")
        print(f"  hashed_password={user.hashed_password[:30]}...")

        # Verify password
        is_valid = verify_password(password, user.hashed_password)
        if is_valid:
            print(f"✓ Password is correct!")

            # Create token
            token = create_access_token({"sub": str(user.id), "email": user.email})
            print(f"✓ Token created: {token[:50]}...")

            # Decode token
            payload = decode_token(token)
            print(f"✓ Token payload: {payload}")
            print(f"  User ID in token: {payload.get('sub')}")
        else:
            print(f"❌ Password is incorrect!")

if __name__ == "__main__":
    email = input("Email: ")
    password = getpass.getpass("Password: ")

    asyncio.run(test_login(email, password))
