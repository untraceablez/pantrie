"""Unit tests for per-client rate limiting (US2)."""
import secrets

import pytest

from src.core.cache import get_redis
from src.core.exceptions import RateLimitError
from src.core.rate_limit import check_client_rate_limit


@pytest.mark.asyncio
async def test_blocks_after_limit_with_retry_after() -> None:
    redis = await get_redis()
    client_id = f"test-rl-{secrets.token_hex(4)}"  # unique key per run
    limit = 3

    # First `limit` requests are allowed.
    for _ in range(limit):
        await check_client_rate_limit(redis, client_id, limit)

    # The next one is rejected with a retry hint.
    with pytest.raises(RateLimitError) as exc:
        await check_client_rate_limit(redis, client_id, limit)
    assert exc.value.details.get("retry_after", 0) > 0
