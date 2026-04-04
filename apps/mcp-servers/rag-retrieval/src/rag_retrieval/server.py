"""ASGI app for rag-retrieval MCP server."""

from __future__ import annotations

import os
from collections.abc import Callable
from inspect import isawaitable
from pathlib import Path
from typing import Any

import structlog
import yaml
from fastapi import FastAPI
from pydantic import BaseModel
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config.schemas.mcp import McpConfig
from rag_retrieval.tools.retrieve import get_knowledge_entry
from rag_retrieval.tools.search import search_knowledge

logger = structlog.get_logger(__name__)


def _load_config() -> McpConfig:
    path = Path("config/runtime/mcp.yaml")
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        return McpConfig.model_validate(raw)
    except Exception as exc:
        raise SystemExit(f"Invalid MCP config at {path}: {exc}") from exc


_config = _load_config()
_server_cfg = _config.servers["rag-retrieval"]
_redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=False)
_engine = create_async_engine(
    os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./.cache/tests/rag.db")
)
_session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)

_tool_registry: dict[str, Callable[..., Any]] = {
    "knowledge.search_knowledge": search_knowledge,
    "knowledge.get_knowledge_entry": get_knowledge_entry,
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
        async with _session_factory() as session:
            await session.execute(text("SELECT 1"))
            await session.execute(text("SELECT 1 FROM knowledge_entries LIMIT 1"))
    except Exception as exc:
        raise SystemExit(f"knowledge_entries dependency unavailable: {exc}") from exc

    logger.info("startup health check passed", server="rag-retrieval")


app = FastAPI(title="rag-retrieval-mcp")


@app.on_event("startup")
async def _on_startup() -> None:
    await startup_health_check()


@app.get("/health")
async def health() -> dict[str, str]:
    cache = "healthy"
    database = "healthy"
    try:
        await _ping_redis()
    except Exception:
        cache = "unhealthy"
    try:
        async with _session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        database = "unhealthy"
    status = "healthy" if cache == "healthy" and database == "healthy" else "unhealthy"
    return {
        "status": status,
        "provider": "postgresql+pgvector",
        "cache": cache,
        "database": database,
    }


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
