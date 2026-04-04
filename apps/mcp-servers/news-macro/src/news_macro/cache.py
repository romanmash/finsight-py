"""Redis cache helper for news-macro server."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from redis.asyncio import Redis


class CacheHelper:
    """Typed JSON cache wrapper for MCP tool responses."""

    def __init__(self, redis_client: Redis) -> None:
        self._redis = redis_client

    async def get(self, key: str) -> dict[str, Any] | None:
        raw = await self._redis.get(key)
        if raw is None:
            return None
        text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None

    async def set(self, key: str, value: Mapping[str, Any], ttl: int) -> None:
        await self._redis.set(key, json.dumps(dict(value), default=str), ex=ttl)

    @staticmethod
    def make_key(server: str, tool: str, params: Mapping[str, Any]) -> str:
        payload = json.dumps(dict(params), sort_keys=True, default=str)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
        return f"{server}:{tool}:{digest}"
