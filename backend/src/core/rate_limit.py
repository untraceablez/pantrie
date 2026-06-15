"""Per-client rate limiting backed by Redis (fixed-window counter)."""
import time

from fastapi import Depends
from redis.asyncio import Redis

from src.config import Settings, get_settings
from src.core.cache import get_redis
from src.core.deps import CurrentApiClient
from src.core.exceptions import RateLimitError
from src.models.api_client import APIClient

WINDOW_SECONDS = 3600


async def check_client_rate_limit(
    redis: Redis, client_id: str, limit: int, window_seconds: int = WINDOW_SECONDS
) -> None:
    """Increment the client's window counter; raise RateLimitError if exceeded."""
    window = int(time.time() // window_seconds)
    key = f"ratelimit:client:{client_id}:{window}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_seconds)
    if count > limit:
        ttl = await redis.ttl(key)
        raise RateLimitError(
            message="Rate limit exceeded",
            details={"retry_after": ttl if ttl and ttl > 0 else window_seconds},
        )


async def enforce_client_rate_limit(
    client: CurrentApiClient,
    settings: Settings = Depends(get_settings),
) -> APIClient:
    """FastAPI dependency enforcing the per-client hourly request limit."""
    redis = await get_redis()
    await check_client_rate_limit(redis, client.client_id, settings.CLIENT_RATE_LIMIT_PER_HOUR)
    return client
