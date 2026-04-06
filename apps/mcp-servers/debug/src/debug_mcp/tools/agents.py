"""Agent and mission debugging tools."""

from __future__ import annotations

import time
from collections.abc import Mapping
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol, cast
from uuid import UUID

from debug_mcp.models import (
    AgentRunResult,
    AgentRunSummary,
    AlertInspectResult,
    CeleryInspectResult,
    CeleryQueue,
    MissionStatusResult,
    ToolResponse,
)

AGENT_RUN_CAP = 100
_QUEUE_NAMES: tuple[str, ...] = (
    "watchdog",
    "brief",
    "screener",
    "mission",
    "alert",
    "telegram",
)

_db_pool: object | None = None
_redis: object | None = None


class DbPoolProtocol(Protocol):
    async def fetch(self, query: str, *args: object) -> list[Mapping[str, Any]]: ...

    async def fetchval(self, query: str, *args: object) -> object: ...

    async def fetchrow(self, query: str, *args: object) -> Mapping[str, Any] | None: ...


class RedisQueueProtocol(Protocol):
    async def llen(self, key: str) -> object: ...


def set_dependencies(*, db_pool: object, redis_client: object) -> None:
    """Configure DB and Redis dependencies for agent tools."""
    global _db_pool, _redis
    _db_pool = db_pool
    _redis = redis_client


def _now_ms() -> float:
    return time.perf_counter() * 1000


def _elapsed_ms(start_ms: float) -> int:
    return int(_now_ms() - start_ms)


def _to_text(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    return str(value)


def _to_int(value: object | None, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        return int(value)
    return default


def _row_value(row: object, key: str) -> object | None:
    if not isinstance(row, Mapping):
        return None
    return row.get(key)


def _row_to_summary(row: object) -> AgentRunSummary:
    return AgentRunSummary(
        id=str(_row_value(row, "id") or ""),
        agent_type=str(_row_value(row, "agent_name") or ""),
        status=str(_row_value(row, "status") or ""),
        started_at=_to_text(_row_value(row, "started_at")) or "",
        finished_at=_to_text(_row_value(row, "completed_at")),
        error=_to_text(_row_value(row, "error_message")),
    )


async def agent_runs(status: str | None = None, limit: int = 20) -> ToolResponse[AgentRunResult]:
    """Return recent agent runs with optional status filter."""
    started = _now_ms()

    if _db_pool is None:
        return ToolResponse(
            data=None,
            error="Database pool is not configured",
            latency_ms=_elapsed_ms(started),
        )
    db_pool = cast(DbPoolProtocol, _db_pool)

    bounded_limit = max(1, min(limit, AGENT_RUN_CAP))
    if status:
        rows = await db_pool.fetch(
            """
            SELECT id, agent_name, status, started_at, completed_at, error_message
            FROM agent_runs
            WHERE status = $1
            ORDER BY started_at DESC
            LIMIT $2
            """,
            status,
            bounded_limit,
        )
        total = await db_pool.fetchval("SELECT COUNT(*) FROM agent_runs WHERE status = $1", status)
    else:
        rows = await db_pool.fetch(
            """
            SELECT id, agent_name, status, started_at, completed_at, error_message
            FROM agent_runs
            ORDER BY started_at DESC
            LIMIT $1
            """,
            bounded_limit,
        )
        total = await db_pool.fetchval("SELECT COUNT(*) FROM agent_runs")

    typed_rows = cast(list[Mapping[str, object]], rows)
    summaries = [_row_to_summary(row) for row in typed_rows]
    return ToolResponse(
        data=AgentRunResult(runs=summaries, total_count=_to_int(total, default=0)),
        latency_ms=_elapsed_ms(started),
    )


async def mission_status(mission_id: str) -> ToolResponse[MissionStatusResult]:
    """Return mission record and related agent runs."""
    started = _now_ms()

    if _db_pool is None:
        return ToolResponse(
            data=None,
            error="Database pool is not configured",
            latency_ms=_elapsed_ms(started),
        )
    db_pool = cast(DbPoolProtocol, _db_pool)

    mission = await db_pool.fetchrow(
        """
        SELECT id, status, created_at
        FROM missions
        WHERE id = $1 AND deleted_at IS NULL
        """,
        mission_id,
    )
    if mission is None:
        return ToolResponse(
            data=None,
            error=f"Mission '{mission_id}' not found",
            latency_ms=_elapsed_ms(started),
        )

    runs = await db_pool.fetch(
        """
        SELECT id, agent_name, status, started_at, completed_at, error_message
        FROM agent_runs
        WHERE mission_id = $1
        ORDER BY started_at ASC
        """,
        mission_id,
    )

    typed_runs = cast(list[Mapping[str, object]], runs)
    return ToolResponse(
        data=MissionStatusResult(
            mission_id=str(_row_value(mission, "id") or mission_id),
            status=str(_row_value(mission, "status") or "unknown"),
            created_at=_to_text(_row_value(mission, "created_at")) or "",
            agent_runs=[_row_to_summary(row) for row in typed_runs],
        ),
        latency_ms=_elapsed_ms(started),
    )


async def celery_inspect() -> ToolResponse[CeleryInspectResult]:
    """Return queue depth summary from Redis-backed Celery queues."""
    started = _now_ms()

    if _redis is None:
        return ToolResponse(
            data=None,
            error="Redis client is not configured",
            latency_ms=_elapsed_ms(started),
        )
    redis_client = cast(RedisQueueProtocol, _redis)

    queues: list[CeleryQueue] = []
    active_tasks = 0

    for queue in _QUEUE_NAMES:
        depth = 0
        for key in (queue, f"celery:{queue}"):
            try:
                depth = max(depth, _to_int(await redis_client.llen(key), default=0))
            except Exception:
                continue
        queues.append(CeleryQueue(name=queue, depth=depth))
        active_tasks += depth

    return ToolResponse(
        data=CeleryInspectResult(active_tasks=active_tasks, queues=queues),
        latency_ms=_elapsed_ms(started),
    )


async def alert_inspect(alert_id: str) -> ToolResponse[AlertInspectResult]:
    """Return alert status details."""
    started = _now_ms()

    if _db_pool is None:
        return ToolResponse(
            data=None,
            error="Database pool is not configured",
            latency_ms=_elapsed_ms(started),
        )
    db_pool = cast(DbPoolProtocol, _db_pool)

    row = await db_pool.fetchrow(
        """
        SELECT id, condition_type, acknowledged_at, created_at
        FROM alerts
        WHERE id = $1 AND deleted_at IS NULL
        """,
        alert_id,
    )
    if row is None:
        return ToolResponse(
            data=None,
            error=f"Alert '{alert_id}' not found",
            latency_ms=_elapsed_ms(started),
        )

    acknowledged_at = _to_text(_row_value(row, "acknowledged_at"))
    status = "acknowledged" if acknowledged_at is not None else "open"

    return ToolResponse(
        data=AlertInspectResult(
            alert_id=str(_row_value(row, "id") or alert_id),
            condition_type=str(_row_value(row, "condition_type") or "unknown"),
            status=status,
            acknowledged_at=acknowledged_at,
            triggered_at=_to_text(_row_value(row, "created_at")),
        ),
        latency_ms=_elapsed_ms(started),
    )
