"""News tool."""

from __future__ import annotations

import os
import time
from datetime import UTC, datetime

import httpx
from redis.asyncio import Redis

from news_macro.cache import CacheHelper
from news_macro.models import NewsItem, ToolResponse

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("FINNHUB_BASE_URL", "https://finnhub.invalid")


async def get_news(query: str, limit: int = 10) -> ToolResponse[list[NewsItem]]:
    started = time.perf_counter()
    params: dict[str, str | int] = {"q": query, "limit": limit}
    key = _cache.make_key("news-macro", "get_news", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            items = [NewsItem.model_validate(item) for item in cached.get("items", [])]
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=items, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/news", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_news failed: {exc}", latency_ms=latency)

    rows = payload.get("items", []) if isinstance(payload, dict) else []
    items = [
        NewsItem(
            headline=str(row.get("headline", "")),
            source=str(row.get("source", "")),
            url=str(row.get("url")) if row.get("url") is not None else None,
            published_at=datetime.fromisoformat(
                str(row.get("published_at", datetime.now(UTC).isoformat()))
            ),
            relevance_score=float(row["relevance_score"])
            if row.get("relevance_score") is not None
            else None,
            summary=str(row.get("summary")) if row.get("summary") is not None else None,
        )
        for row in rows
        if isinstance(row, dict)
    ]
    await _cache.set(key, {"items": [it.model_dump(mode="json") for it in items]}, ttl=300)
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=items, cache_hit=False, latency_ms=latency)
