"""ETF holdings tool."""

from __future__ import annotations

import os
import time
from datetime import date

import httpx
from redis.asyncio import Redis

from market_data.cache import CacheHelper
from market_data.models import ETFData, ETFHolding, ToolResponse

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("OPENBB_BASE_URL", "https://openbb.invalid")


async def get_etf_holdings(symbol: str) -> ToolResponse[ETFData]:
    started = time.perf_counter()
    params = {"symbol": symbol}
    key = _cache.make_key("market-data", "get_etf_holdings", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = ETFData.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/market/etf-holdings", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_etf_holdings failed: {exc}", latency_ms=latency)

    rows = payload.get("holdings", []) if isinstance(payload, dict) else []
    holdings = [
        ETFHolding(
            ticker=str(row.get("ticker", "")),
            weight=float(row.get("weight", 0.0)),
            name=str(row.get("name")) if row.get("name") is not None else None,
        )
        for row in rows
        if isinstance(row, dict)
    ]
    as_of_value = payload.get("as_of_date") if isinstance(payload, dict) else None
    as_of = date.fromisoformat(str(as_of_value)) if as_of_value is not None else None
    data = ETFData(symbol=symbol, holdings=holdings, as_of_date=as_of)
    await _cache.set(key, data.model_dump(mode="json"), ttl=3600)
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
