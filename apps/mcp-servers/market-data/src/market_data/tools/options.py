"""Options chain tool."""

from __future__ import annotations

import os
import time
from datetime import date
from decimal import Decimal

import httpx
from redis.asyncio import Redis

from market_data.cache import CacheHelper
from market_data.models import OptionsContract, OptionsData, ToolResponse
from market_data.settings import tool_ttl

_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("OPENBB_BASE_URL", "https://openbb.invalid")


async def get_options_chain(symbol: str, expiry: str | None = None) -> ToolResponse[OptionsData]:
    started = time.perf_counter()
    params = {"symbol": symbol, "expiry": expiry}
    key = _cache.make_key("market-data", "get_options_chain", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = OptionsData.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{_base_url}/market/options", params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_options_chain failed: {exc}", latency_ms=latency)

    rows = payload.get("contracts", []) if isinstance(payload, dict) else []
    contracts = [
        OptionsContract(
            strike=Decimal(str(row.get("strike", 0))),
            expiry=date.fromisoformat(str(row.get("expiry", "1970-01-01"))),
            call_put="put" if str(row.get("call_put", "call")).lower() == "put" else "call",
            bid=Decimal(str(row.get("bid", 0))),
            ask=Decimal(str(row.get("ask", 0))),
            iv=float(row["iv"]) if row.get("iv") is not None else None,
            open_interest=int(row["open_interest"])
            if row.get("open_interest") is not None
            else None,
        )
        for row in rows
        if isinstance(row, dict)
    ]
    data = OptionsData(symbol=symbol, contracts=contracts)
    await _cache.set(key, data.model_dump(mode="json"), ttl=tool_ttl("get_options_chain"))
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
