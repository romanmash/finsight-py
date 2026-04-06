"""Tests for Redis debug tools."""

from __future__ import annotations

import pytest
from debug_mcp.tools import redis_tools


class _FakeRedis:
    async def get(self, key: str) -> bytes | None:
        if key == "missing":
            return None
        return b"value"

    async def keys(self, pattern: str) -> list[bytes]:
        return [f"key:{idx}".encode() for idx in range(260)]

    async def type(self, key: str) -> bytes:
        return {
            "s": b"string",
            "l": b"list",
            "h": b"hash",
            "z": b"zset",
            "missing": b"none",
        }.get(key, b"set")

    async def ttl(self, key: str) -> int:
        return 30

    async def strlen(self, key: str) -> int:
        return 5

    async def lrange(self, key: str, start: int, end: int) -> list[bytes]:
        return [b"a", b"b"]

    async def llen(self, key: str) -> int:
        return 2

    async def hgetall(self, key: str) -> dict[bytes, bytes]:
        return {b"k": b"v"}

    async def hlen(self, key: str) -> int:
        return 1

    async def smembers(self, key: str) -> set[bytes]:
        return {b"a", b"b"}

    async def scard(self, key: str) -> int:
        return 2

    async def zrange(
        self, key: str, start: int, end: int, withscores: bool = False
    ) -> list[tuple[bytes, float]]:
        if withscores:
            return [(b"x", 1.0)]
        return []

    async def zcard(self, key: str) -> int:
        return 1


@pytest.mark.asyncio
async def test_redis_keys_cap_enforced() -> None:
    redis_tools.set_redis_client(_FakeRedis())
    result = await redis_tools.redis_keys("*")
    assert result.data is not None
    assert len(result.data) == 200


@pytest.mark.asyncio
async def test_redis_inspect_string() -> None:
    redis_tools.set_redis_client(_FakeRedis())
    result = await redis_tools.redis_inspect("s")
    assert result.data is not None
    assert result.data.type == "string"
    assert result.data.value == "value"


@pytest.mark.asyncio
async def test_redis_inspect_list() -> None:
    redis_tools.set_redis_client(_FakeRedis())
    result = await redis_tools.redis_inspect("l")
    assert result.data is not None
    assert result.data.type == "list"
    assert result.data.value == ["a", "b"]


@pytest.mark.asyncio
async def test_redis_inspect_hash() -> None:
    redis_tools.set_redis_client(_FakeRedis())
    result = await redis_tools.redis_inspect("h")
    assert result.data is not None
    assert result.data.type == "hash"
    assert result.data.value == {"k": "v"}
