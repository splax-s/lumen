"""Fixed-window rate limits, counted in Redis."""

from fastapi import HTTPException, status
from redis.asyncio import Redis


async def rate_limit(redis: Redis, key: str, limit: int, window_seconds: int) -> None:
    """Counts one use of `key`. Raises 429 once the limit for the window is passed."""
    name = f"rate:{key}"
    count = await redis.incr(name)
    if count == 1:
        await redis.expire(name, window_seconds)
    if count > limit:
        retry = await redis.ttl(name)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too_many_requests",
            headers={"Retry-After": str(max(1, retry))},
        )
