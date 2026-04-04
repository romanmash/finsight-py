"""Price tool."""

from __future__ import annotations

import os
import time
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import httpx
from redis.asyncio import Redis

from config.schemas.mcp import McpConfig
from market_data.cache import CacheHelper
from market_data.models import PriceData, ToolResponse


def _load_mcp_config() -> McpConfig:
    import yaml

    path = Path("config/runtime/mcp.yaml")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return McpConfig.model_validate(raw)


def _tool_ttl() -> int:
    cfg = _load_mcp_config()
    server = cfg.servers["market-data"]
    if server.tools and "get_price" in server.tools:
        return server.tools["get_price"].cache_ttl_seconds
    return server.cache_ttl_seconds


_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_cache = CacheHelper(_redis)
_base_url = os.getenv("OPENBB_BASE_URL", "https://openbb.invalid")


async def get_price(symbol: str) -> ToolResponse[PriceData]:
    started = time.perf_counter()
    params = {"symbol": symbol}
    key = _cache.make_key("market-data", "get_price", params)
    cached = await _cache.get(key)
    if cached is not None:
        try:
            data = PriceData.model_validate(cached)
            latency = int((time.perf_counter() - started) * 1000)
            return ToolResponse(data=data, cache_hit=True, latency_ms=latency)
        except Exception:
            pass

    url = f"{_base_url}/market/price"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(data=None, error=f"get_price failed: {exc}", latency_ms=latency)

    if not isinstance(payload, dict):
        latency = int((time.perf_counter() - started) * 1000)
        return ToolResponse(
            data=None, error="get_price failed: invalid payload", latency_ms=latency
        )

    data = PriceData(
        symbol=str(payload.get("symbol", symbol)),
        price=Decimal(str(payload.get("price", "0"))),
        change_pct=float(payload.get("change_pct", 0.0)),
        volume=int(payload.get("volume", 0)),
        timestamp=datetime.fromisoformat(
            str(payload.get("timestamp", datetime.now(UTC).isoformat()))
        ),
    )
    await _cache.set(key, data.model_dump(mode="json"), ttl=_tool_ttl())
    latency = int((time.perf_counter() - started) * 1000)
    return ToolResponse(data=data, cache_hit=False, latency_ms=latency)
