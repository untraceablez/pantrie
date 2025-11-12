"""Redis cache service wrapper."""
import json
from typing import Any

import redis.asyncio as aioredis
from redis.asyncio import Redis

from src.config import get_settings
from src.core.logging import setup_logging

logger = setup_logging()
settings = get_settings()

# Global Redis client
_redis_client: Redis | None = None


async def get_redis() -> Redis:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = await aioredis.from_url(
            str(settings.REDIS_URL),
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis() -> None:
    """Close Redis connection."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


class CacheService:
    """Redis cache service for key-value operations."""

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    async def get(self, key: str) -> Any | None:
        """Get value from cache."""
        try:
            value = await self.redis.get(key)
            if value is None:
                return None
            return json.loads(value)
        except Exception as e:
            logger.error("Cache get error", key=key, error=str(e))
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int | None = None,
    ) -> bool:
        """Set value in cache with optional TTL."""
        try:
            serialized = json.dumps(value)
            ttl = ttl or settings.REDIS_CACHE_TTL
            await self.redis.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error("Cache set error", key=key, error=str(e))
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error("Cache delete error", key=key, error=str(e))
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error("Cache delete pattern error", pattern=pattern, error=str(e))
            return 0

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error("Cache exists error", key=key, error=str(e))
            return False

    async def publish(self, channel: str, message: dict[str, Any]) -> None:
        """Publish message to Redis pub/sub channel."""
        try:
            serialized = json.dumps(message)
            await self.redis.publish(channel, serialized)
        except Exception as e:
            logger.error("Cache publish error", channel=channel, error=str(e))


async def get_cache_service() -> CacheService:
    """Dependency to get cache service."""
    redis_client = await get_redis()
    return CacheService(redis_client)
