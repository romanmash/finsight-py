"""Public health route."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from api.lib.db import SessionLocal
from api.lib.redis import CacheClient

router = APIRouter()


async def _database_status() -> Literal["ok", "error"]:
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return "ok"
    except SQLAlchemyError:
        return "error"


async def _cache_status() -> Literal["ok", "error"]:
    try:
        client = CacheClient()
        await client.get("health_probe")
        return "ok"
    except Exception:
        return "error"


@router.get("/health")
async def health() -> dict[str, object]:
    database = await _database_status()
    cache = await _cache_status()
    subsystems: dict[str, str] = {
        "database": database,
        "cache": cache,
        "config": "ok",
    }
    status = "healthy" if all(value == "ok" for value in subsystems.values()) else "degraded"
    return {"status": status, "subsystems": subsystems}
