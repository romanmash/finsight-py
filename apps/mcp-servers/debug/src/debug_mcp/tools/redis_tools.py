"""Redis debugging tools (read-only)."""

from __future__ import annotations

import time
from collections.abc import Mapping
from typing import Protocol, cast

from debug_mcp.models import RedisKeyResult, ToolResponse

KEY_CAP = 200
_redis: object | None = None


class RedisProtocol(Protocol):
    async def get(self, key: str) -> object: ...

    async def keys(self, pattern: str) -> list[object]: ...

    async def type(self, key: str) -> object: ...

    async def ttl(self, key: str) -> object: ...

    async def strlen(self, key: str) -> object: ...

    async def lrange(self, key: str, start: int, end: int) -> object: ...

    async def llen(self, key: str) -> object: ...

    async def hgetall(self, key: str) -> object: ...

    async def hlen(self, key: str) -> object: ...

    async def smembers(self, key: str) -> object: ...

    async def scard(self, key: str) -> object: ...

    async def zrange(self, key: str, start: int, end: int, withscores: bool = False) -> object: ...

    async def zcard(self, key: str) -> object: ...


def set_redis_client(redis_client: object) -> None:
    """Configure redis client dependency."""
    global _redis
    _redis = redis_client


def _now_ms() -> float:
    return time.perf_counter() * 1000


def _elapsed_ms(start_ms: float) -> int:
    return int(_now_ms() - start_ms)


def _decode(value: object) -> object:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, list):
        return [_decode(item) for item in value]
    if isinstance(value, set):
        return sorted(str(_decode(item)) for item in value)
    if isinstance(value, tuple):
        return [_decode(item) for item in value]
    if isinstance(value, Mapping):
        typed_map = cast(Mapping[object, object], value)
        return {str(_decode(key)): _decode(item) for key, item in typed_map.items()}
    return value


def _to_int(value: object | None) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        return int(value)
    return 0


async def redis_get(key: str) -> ToolResponse[str | None]:
    """Return decoded Redis string value."""
    started = _now_ms()

    if _redis is None:
        return ToolResponse(
            data=None,
            error="Redis client is not configured",
            latency_ms=_elapsed_ms(started),
        )
    redis_client = cast(RedisProtocol, _redis)

    try:
        value = await redis_client.get(key)
    except Exception as exc:
        return ToolResponse(
            data=None,
            error=f"Redis GET failed: {exc}",
            latency_ms=_elapsed_ms(started),
        )

    decoded = _decode(value)
    return ToolResponse(
        data=str(decoded) if decoded is not None else None,
        latency_ms=_elapsed_ms(started),
    )


async def redis_keys(pattern: str = "*") -> ToolResponse[list[str]]:
    """Return capped list of keys matching a pattern."""
    started = _now_ms()

    if _redis is None:
        return ToolResponse(
            data=None,
            error="Redis client is not configured",
            latency_ms=_elapsed_ms(started),
        )
    redis_client = cast(RedisProtocol, _redis)

    try:
        values = await redis_client.keys(pattern)
    except Exception as exc:
        return ToolResponse(
            data=None,
            error=f"Redis KEYS failed: {exc}",
            latency_ms=_elapsed_ms(started),
        )

    decoded = [str(_decode(item)) for item in values]
    return ToolResponse(data=decoded[:KEY_CAP], latency_ms=_elapsed_ms(started))


async def redis_inspect(key: str) -> ToolResponse[RedisKeyResult]:
    """Inspect key type, ttl, value, and byte size."""
    started = _now_ms()

    if _redis is None:
        return ToolResponse(
            data=None,
            error="Redis client is not configured",
            latency_ms=_elapsed_ms(started),
        )
    redis_client = cast(RedisProtocol, _redis)

    try:
        key_type_raw = await redis_client.type(key)
        key_type = str(_decode(key_type_raw))
        ttl_raw = await redis_client.ttl(key)
        ttl = int(ttl_raw) if isinstance(ttl_raw, int) and ttl_raw >= 0 else None

        value: object | None = None
        size: int | None = None

        if key_type == "string":
            raw = await redis_client.get(key)
            value = _decode(raw)
            strlen = await redis_client.strlen(key)
            size = _to_int(strlen)
        elif key_type == "list":
            raw = await redis_client.lrange(key, 0, -1)
            value = _decode(raw)
            llen = await redis_client.llen(key)
            size = _to_int(llen)
        elif key_type == "hash":
            raw = await redis_client.hgetall(key)
            value = _decode(raw)
            hlen = await redis_client.hlen(key)
            size = _to_int(hlen)
        elif key_type == "set":
            raw = await redis_client.smembers(key)
            value = _decode(raw)
            scard = await redis_client.scard(key)
            size = _to_int(scard)
        elif key_type == "zset":
            raw = await redis_client.zrange(key, 0, -1, withscores=True)
            value = _decode(raw)
            zcard = await redis_client.zcard(key)
            size = _to_int(zcard)
        elif key_type == "none":
            value = None
            size = None

    except Exception as exc:
        return ToolResponse(
            data=None,
            error=f"Redis inspect failed: {exc}",
            latency_ms=_elapsed_ms(started),
        )

    return ToolResponse(
        data=RedisKeyResult(key=key, type=key_type, ttl=ttl, value=value, size=size),
        latency_ms=_elapsed_ms(started),
    )
