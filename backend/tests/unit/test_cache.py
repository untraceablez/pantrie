"""Unit tests for the Redis cache wrapper."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.core import cache

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _reset_client(monkeypatch):
    """Each test starts with no cached global Redis client."""
    monkeypatch.setattr(cache, "_redis_client", None)


def _svc(redis):
    return cache.CacheService(redis)


async def test_get_redis_is_a_singleton(monkeypatch):
    fake = AsyncMock()
    from_url = AsyncMock(return_value=fake)
    monkeypatch.setattr(cache.aioredis, "from_url", from_url)

    first = await cache.get_redis()
    second = await cache.get_redis()

    assert first is fake and second is fake
    from_url.assert_awaited_once()


async def test_close_redis_closes_and_clears(monkeypatch):
    fake = AsyncMock()
    monkeypatch.setattr(cache, "_redis_client", fake)

    await cache.close_redis()

    fake.close.assert_awaited_once()
    assert cache._redis_client is None
    # No-op when already closed.
    await cache.close_redis()


async def test_get_returns_parsed_value():
    r = AsyncMock()
    r.get.return_value = '{"a": 1}'
    assert await _svc(r).get("k") == {"a": 1}


async def test_get_returns_none_on_miss():
    r = AsyncMock()
    r.get.return_value = None
    assert await _svc(r).get("k") is None


async def test_get_swallows_errors():
    r = AsyncMock()
    r.get.side_effect = RuntimeError("down")
    assert await _svc(r).get("k") is None


async def test_set_uses_default_ttl_and_returns_true():
    r = AsyncMock()
    assert await _svc(r).set("k", {"a": 1}) is True
    r.setex.assert_awaited_once()


async def test_set_returns_false_on_error():
    r = AsyncMock()
    r.setex.side_effect = RuntimeError("down")
    assert await _svc(r).set("k", {"a": 1}) is False


async def test_delete_returns_true():
    r = AsyncMock()
    assert await _svc(r).delete("k") is True


async def test_delete_returns_false_on_error():
    r = AsyncMock()
    r.delete.side_effect = RuntimeError("down")
    assert await _svc(r).delete("k") is False


async def test_delete_pattern_removes_matched_keys():
    r = MagicMock()

    async def scan_iter(match=None):
        for k in ["a", "b"]:
            yield k

    r.scan_iter = scan_iter
    r.delete = AsyncMock(return_value=2)
    assert await _svc(r).delete_pattern("p*") == 2
    r.delete.assert_awaited_once_with("a", "b")


async def test_delete_pattern_returns_zero_when_empty():
    r = MagicMock()

    async def scan_iter(match=None):
        for k in []:
            yield k

    r.scan_iter = scan_iter
    r.delete = AsyncMock()
    assert await _svc(r).delete_pattern("p*") == 0
    r.delete.assert_not_awaited()


async def test_delete_pattern_returns_zero_on_error():
    r = MagicMock()

    def scan_iter(match=None):
        raise RuntimeError("down")

    r.scan_iter = scan_iter
    assert await _svc(r).delete_pattern("p*") == 0


async def test_exists_true():
    r = AsyncMock()
    r.exists.return_value = 1
    assert await _svc(r).exists("k") is True


async def test_exists_false_when_zero():
    r = AsyncMock()
    r.exists.return_value = 0
    assert await _svc(r).exists("k") is False


async def test_exists_false_on_error():
    r = AsyncMock()
    r.exists.side_effect = RuntimeError("down")
    assert await _svc(r).exists("k") is False


async def test_publish_serializes_message():
    r = AsyncMock()
    await _svc(r).publish("ch", {"m": 1})
    r.publish.assert_awaited_once()


async def test_publish_swallows_errors():
    r = AsyncMock()
    r.publish.side_effect = RuntimeError("down")
    await _svc(r).publish("ch", {"m": 1})  # must not raise


async def test_get_cache_service_wraps_client(monkeypatch):
    fake = AsyncMock()
    monkeypatch.setattr(cache, "get_redis", AsyncMock(return_value=fake))
    svc = await cache.get_cache_service()
    assert isinstance(svc, cache.CacheService)
    assert svc.redis is fake
