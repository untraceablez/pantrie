"""Security utilities for password hashing and JWT token handling."""
import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from cryptography.fernet import Fernet
from jose import JWTError, jwt

from src.config import get_settings
from src.core.exceptions import AuthenticationError

settings = get_settings()


def _fernet() -> Fernet:
    """Build a Fernet cipher from the app secret key (32-byte derived key)."""
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a value that must be recoverable later (e.g. an outbound API key)."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str) -> str:
    """Decrypt a value produced by encrypt_secret."""
    return _fernet().decrypt(token.encode()).decode()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    # Convert password to bytes and generate salt
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Return as string for database storage
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_client_token(
    client_id: str, household_id: int, scopes: list[str]
) -> tuple[str, int]:
    """Create a short-lived API client access token.

    Distinct from user tokens via ``type="client"``. Returns the token and its
    lifetime in seconds.
    """
    expire_minutes = settings.CLIENT_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    to_encode = {
        "sub": client_id,
        "household_id": household_id,
        "scopes": scopes,
        "exp": expire,
        "type": "client",
    }
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expire_minutes * 60


def create_refresh_token(data: dict[str, Any]) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise AuthenticationError(message="Invalid token", details={"error": str(e)})


def verify_token_type(token: str, expected_type: str) -> dict[str, Any]:
    """Verify token type and return payload."""
    payload = decode_token(token)
    token_type = payload.get("type")

    if token_type != expected_type:
        raise AuthenticationError(
            message=f"Invalid token type. Expected {expected_type}, got {token_type}"
        )

    return payload
