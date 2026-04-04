"""Macro signals tool."""

from __future__ import annotations

import os
import time
from datetime import UTC, datetime
from typing import Literal

import httpx
from redis.asyncio import Redis

from news_macro.cache import CacheHelper
from news_macro.models import MacroSignals, ToolResponse
from news_macro.settings import tool_ttl

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("GDELT_BASE_URL", "https://gdelt.invalid")


def _regime(volatility: float) -> Literal["low", "medium", "high"]:
    if volatility < 0.3:
        return "low"
    if volatility < 0.7:
        return "medium"
    return "high"


async def get_macro_signals() -> ToolResponse[MacroSignals]:
    started = time.perf_counter()
    params: dict[str, str] = {}
    key = _cache.make_key("news-macro", "get_macro_signals", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = MacroSignals.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/macro-signals")
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_macro_signals failed: {exc}", latency_ms=latency)

    market_sentiment = (
        float(payload.get("market_sentiment", 0.0)) if isinstance(payload, dict) else 0.0
    )
    volatility = float(payload.get("volatility", 0.0)) if isinstance(payload, dict) else 0.0
    geopolitical = (
        float(payload["geopolitical_risk_index"])
        if isinstance(payload, dict) and payload.get("geopolitical_risk_index") is not None
        else None
    )
    data = MacroSignals(
        market_sentiment=market_sentiment,
        volatility_regime=_regime(volatility),
        geopolitical_risk_index=geopolitical,
        updated_at=datetime.now(UTC),
    )
    await _cache.set(key, data.model_dump(mode="json"), ttl=tool_ttl("get_macro_signals"))
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
