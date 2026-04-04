"""Historical OHLCV tool."""

from __future__ import annotations

import os
import time
from datetime import date
from decimal import Decimal

import httpx
from redis.asyncio import Redis

from market_data.cache import CacheHelper
from market_data.models import OHLCVBar, OHLCVData, ToolResponse

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("OPENBB_BASE_URL", "https://openbb.invalid")


async def get_ohlcv(symbol: str, period: str = "1mo") -> ToolResponse[OHLCVData]:
    started = time.perf_counter()
    params = {"symbol": symbol, "period": period}
    key = _cache.make_key("market-data", "get_ohlcv", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = OHLCVData.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/market/ohlcv", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_ohlcv failed: {exc}", latency_ms=latency)

    bars_raw = payload.get("bars", []) if isinstance(payload, dict) else []
    bars = [
        OHLCVBar(
            date=date.fromisoformat(str(row["date"])),
            open=Decimal(str(row["open"])),
            high=Decimal(str(row["high"])),
            low=Decimal(str(row["low"])),
            close=Decimal(str(row["close"])),
            volume=int(row["volume"]),
        )
        for row in bars_raw
        if isinstance(row, dict)
    ]
    data = OHLCVData(symbol=symbol, bars=bars)
    await _cache.set(key, data.model_dump(mode="json"), ttl=300)
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
