"""ASGI app for market-data MCP server."""

from __future__ import annotations

import os
from collections.abc import Callable
from inspect import isawaitable
from pathlib import Path
from typing import Any

import httpx
import structlog
import yaml
from fastapi import FastAPI
from pydantic import BaseModel
from redis.asyncio import Redis
from redis.exceptions import RedisError

from config.schemas.mcp import McpConfig
from market_data.tools.etf import get_etf_holdings
from market_data.tools.fundamentals import get_fundamentals
from market_data.tools.history import get_ohlcv
from market_data.tools.options import get_options_chain
from market_data.tools.price import get_price

logger = structlog.get_logger(__name__)


def _load_config() -> McpConfig:
    path = Path("config/runtime/mcp.yaml")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        return McpConfig.model_validate(raw)
    except Exception as exc:
        raise SystemExit(f"Invalid MCP config at {path}: {exc}") from exc


_config = _load_config()
_server_cfg = _config.servers["market-data"]
_provider_name = _server_cfg.openbb_provider or "unknown"
_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_provider_probe_url = os.getenv(
    "OPENBB_PROVIDER_PROBE_URL", "https://openbb.invalid/market/provider-health"
)

_tool_registry: dict[str, Callable[..., Any]] = {
    "market.get_price": get_price,
    "market.get_ohlcv": get_ohlcv,
    "market.get_fundamentals": get_fundamentals,
    "market.get_etf_holdings": get_etf_holdings,
    "market.get_options_chain": get_options_chain,
}


async def _ping_redis() -> None:
    ping_result = _redis.ping()
    if isawaitable(ping_result):
        await ping_result


async def startup_health_check() -> None:
    try:
        await _ping_redis()
    except (RedisError, OSError) as exc:
        raise SystemExit(f"Redis unavailable: {exc}") from exc

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(_provider_probe_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise SystemExit(f"OpenBB provider '{_provider_name}' unavailable: {exc}") from exc

    logger.info("startup health check passed", server="market-data", provider=_provider_name)


app = FastAPI(title="market-data-mcp")


@app.on_event("startup")
async def _on_startup() -> None:
    await startup_health_check()


@app.get("/health")
async def health() -> dict[str, str]:
    cache = "healthy"
    try:
        await _ping_redis()
    except Exception:
        cache = "unhealthy"
    status = "healthy" if cache == "healthy" else "unhealthy"
    return {"status": status, "provider": _provider_name, "cache": cache}


class JsonRpcRequest(BaseModel):
    method: str
    params: dict[str, Any]
    id: int | str | None = None


@app.post("/mcp/")
async def mcp_endpoint(request: JsonRpcRequest) -> dict[str, Any]:
    if request.method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "result": {"tools": sorted(_tool_registry.keys())},
            "id": request.id,
        }

    if request.method != "tools/call":
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32601, "message": f"Unsupported method: {request.method}"},
            "id": request.id,
        }

    name = str(request.params.get("name", ""))
    args = request.params.get("arguments", {})
    if name not in _tool_registry or not isinstance(args, dict):
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32602, "message": "Invalid tool call"},
            "id": request.id,
        }

    try:
        result = await _tool_registry[name](**args)
    except Exception as exc:
        return {"jsonrpc": "2.0", "error": {"code": -32000, "message": str(exc)}, "id": request.id}

    return {"jsonrpc": "2.0", "result": result.model_dump(mode="json"), "id": request.id}
