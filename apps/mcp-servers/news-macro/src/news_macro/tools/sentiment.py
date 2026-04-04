"""Sentiment tool."""

from __future__ import annotations

import os
import time
from datetime import UTC, datetime
from typing import Literal

import httpx
from redis.asyncio import Redis

from news_macro.cache import CacheHelper
from news_macro.models import SentimentData, ToolResponse
from news_macro.settings import tool_ttl

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("FINNHUB_BASE_URL", "https://finnhub.invalid")


def _label(score: float) -> Literal["bullish", "bearish", "neutral"]:
    if score > 0.2:
        return "bullish"
    if score < -0.2:
        return "bearish"
    return "neutral"


async def get_sentiment(symbol: str) -> ToolResponse[SentimentData]:
    started = time.perf_counter()
    params = {"symbol": symbol}
    key = _cache.make_key("news-macro", "get_sentiment", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = SentimentData.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/sentiment", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_sentiment failed: {exc}", latency_ms=latency)

    score = float(payload.get("score", 0.0)) if isinstance(payload, dict) else 0.0
    label = _label(score)
    data = SentimentData(symbol=symbol, score=score, label=label, as_of=datetime.now(UTC))
    await _cache.set(key, data.model_dump(mode="json"), ttl=tool_ttl("get_sentiment"))
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
