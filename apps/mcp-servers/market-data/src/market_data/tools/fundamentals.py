"""Fundamentals tool."""

from __future__ import annotations

import os
import time
from decimal import Decimal

import httpx
from redis.asyncio import Redis

from market_data.cache import CacheHelper
from market_data.models import FundamentalsData, ToolResponse
from market_data.settings import tool_ttl

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("OPENBB_BASE_URL", "https://openbb.invalid")


async def get_fundamentals(symbol: str) -> ToolResponse[FundamentalsData]:
    started = time.perf_counter()
    params = {"symbol": symbol}
    key = _cache.make_key("market-data", "get_fundamentals", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = FundamentalsData.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/market/fundamentals", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_fundamentals failed: {exc}", latency_ms=latency)

    if not isinstance(payload, dict):
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(
            data=None, error="get_fundamentals failed: invalid payload", latency_ms=latency
        )

    data = FundamentalsData(
        symbol=symbol,
        market_cap=Decimal(str(payload["market_cap"]))
        if payload.get("market_cap") is not None
        else None,
        pe_ratio=float(payload["pe_ratio"]) if payload.get("pe_ratio") is not None else None,
        eps=float(payload["eps"]) if payload.get("eps") is not None else None,
        revenue=Decimal(str(payload["revenue"])) if payload.get("revenue") is not None else None,
        sector=str(payload["sector"]) if payload.get("sector") is not None else None,
    )
    await _cache.set(key, data.model_dump(mode="json"), ttl=tool_ttl("get_fundamentals"))
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
