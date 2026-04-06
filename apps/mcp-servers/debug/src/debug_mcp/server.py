"""ASGI app for debug MCP server."""

from __future__ import annotations

import os
from collections.abc import Callable
from inspect import isawaitable
from pathlib import Path
from typing import Any

import asyncpg  # type: ignore[import-untyped]
import docker  # type: ignore[import-untyped]
import structlog
import yaml
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from redis.exceptions import RedisError

from debug_mcp.auth import require_auth
from debug_mcp.tools import agents, db, infra, redis_tools
from debug_mcp.tools.agents import agent_runs, alert_inspect, celery_inspect, mission_status
from debug_mcp.tools.db import db_query, db_recent_rows, db_table_info
from debug_mcp.tools.infra import compose_status, service_health, tail_logs
from debug_mcp.tools.redis_tools import redis_get, redis_inspect, redis_keys

logger = structlog.get_logger(__name__)


class JsonRpcRequest(BaseModel):
    method: str
    params: dict[str, Any] = Field(default_factory=dict)
    id: int | str | None = None


class DebugConfig(BaseModel):
    health_endpoints: dict[str, str]


class RuntimeConfig(BaseModel):
    debug: DebugConfig


def _load_config() -> RuntimeConfig:
    path = Path("config/runtime/mcp.yaml")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        return RuntimeConfig.model_validate(raw)
    except Exception as exc:
        raise SystemExit(f"Invalid MCP config at {path}: {exc}") from exc


_config = _load_config()
_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_docker = docker.from_env()
_db_pool: asyncpg.Pool | None = None

_tool_registry: dict[str, Callable[..., Any]] = {
    "debug.service_health": service_health,
    "debug.compose_status": compose_status,
    "debug.tail_logs": tail_logs,
    "debug.db_query": db_query,
    "debug.db_table_info": db_table_info,
    "debug.db_recent_rows": db_recent_rows,
    "debug.redis_get": redis_get,
    "debug.redis_keys": redis_keys,
    "debug.redis_inspect": redis_inspect,
    "debug.agent_runs": agent_runs,
    "debug.mission_status": mission_status,
    "debug.celery_inspect": celery_inspect,
    "debug.alert_inspect": alert_inspect,
}

app = FastAPI(title="debug-mcp")


def _env_database_url() -> str:
    database_url = os.getenv("DEBUG_DB_URL", "").strip()
    if not database_url:
        raise SystemExit("DEBUG_DB_URL is required")
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return database_url


async def _ping_redis() -> None:
    ping_result = _redis.ping()
    if isawaitable(ping_result):
        await ping_result


async def startup_health_check() -> None:
    global _db_pool

    try:
        _db_pool = await asyncpg.create_pool(dsn=_env_database_url(), min_size=1, max_size=5)
        async with _db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as exc:
        raise SystemExit(f"Debug DB unavailable: {exc}") from exc

    try:
        await _ping_redis()
    except (RedisError, OSError) as exc:
        raise SystemExit(f"Redis unavailable: {exc}") from exc

    try:
        _docker.ping()
    except Exception as exc:
        raise SystemExit(f"Docker unavailable: {exc}") from exc

    infra.set_dependencies(health_endpoints=_config.debug.health_endpoints, docker_client=_docker)
    db.set_db_pool(_db_pool)
    redis_tools.set_redis_client(_redis)
    agents.set_dependencies(db_pool=_db_pool, redis_client=_redis)

    logger.info("startup health check passed", server="debug-mcp")


@app.on_event("startup")
async def _on_startup() -> None:
    await startup_health_check()


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    if _db_pool is not None:
        await _db_pool.close()
    await _redis.aclose()


@app.get("/health")
async def health() -> dict[str, str]:
    status = "healthy"
    try:
        if _db_pool is None:
            raise RuntimeError("db pool missing")
        async with _db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        await _ping_redis()
        _docker.ping()
    except Exception:
        status = "unhealthy"
    return {"status": status}


@app.post("/mcp/")
async def mcp_endpoint(
    request: JsonRpcRequest,
    _: None = Depends(require_auth),
) -> dict[str, Any]:
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
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32000, "message": str(exc)},
            "id": request.id,
        }

    return {"jsonrpc": "2.0", "result": result.model_dump(mode="json"), "id": request.id}
