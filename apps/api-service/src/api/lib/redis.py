"""Async Redis client and typed cache wrapper."""

from __future__ import annotations

import functools
from typing import cast

from redis.asyncio import Redis
from redis.exceptions import RedisError

from api.lib.config import get_settings


class CacheError(RuntimeError):
    """Raised when cache operations fail due to connectivity/runtime issues."""


@functools.lru_cache(maxsize=1)
def get_redis() -> Redis:
    """Return shared async Redis client instance."""
    settings = get_settings()
    return cast(Redis, Redis.from_url(settings.redis_url, decode_responses=False))


class CacheClient:
    """Simple typed cache interface used by app components."""

    def __init__(self, redis_client: Redis | None = None) -> None:
        self._redis = redis_client if redis_client is not None else get_redis()

    async def get(self, key: str) -> bytes | str | None:
        try:
            value = await self._redis.get(key)
        except (RedisError, OSError) as exc:
            raise CacheError(f"Cache get failed for key '{key}': {exc}") from exc
        if value is None:
            return None
        if isinstance(value, (bytes, str)):
            return value
        raise CacheError(f"Cache get returned unsupported value type for key '{key}'")

    async def set(self, key: str, value: bytes | str, ttl: int) -> None:
        try:
            await self._redis.set(key, value, ex=ttl)
        except (RedisError, OSError) as exc:
            raise CacheError(f"Cache set failed for key '{key}': {exc}") from exc

    async def delete(self, key: str) -> bool:
        try:
            deleted = await self._redis.delete(key)
        except (RedisError, OSError) as exc:
            raise CacheError(f"Cache delete failed for key '{key}': {exc}") from exc
        return cast(int, deleted) > 0

