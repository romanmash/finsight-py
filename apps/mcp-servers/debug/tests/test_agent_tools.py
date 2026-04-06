"""Tests for agent and mission debug tools."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from debug_mcp.tools import agents


class _FakeDbPool:
    async def fetch(self, sql: str, *args: object) -> list[dict[str, object]]:
        if "FROM agent_runs" in sql and "WHERE mission_id" in sql:
            return [
                {
                    "id": "r1",
                    "agent_name": "researcher",
                    "status": "completed",
                    "started_at": datetime.now(UTC),
                    "completed_at": datetime.now(UTC),
                    "error_message": None,
                }
            ]
        if "FROM agent_runs" in sql:
            return [
                {
                    "id": "r1",
                    "agent_name": "researcher",
                    "status": "completed",
                    "started_at": datetime.now(UTC),
                    "completed_at": datetime.now(UTC),
                    "error_message": None,
                }
            ]
        return []

    async def fetchval(self, sql: str, *args: object) -> object:
        if "COUNT(*)" in sql:
            return 1
        return 0

    async def fetchrow(self, sql: str, *args: object) -> dict[str, object] | None:
        if "FROM missions" in sql:
            mission_id = str(args[0]) if args else ""
            if mission_id == "missing":
                return None
            return {"id": mission_id, "status": "running", "created_at": datetime.now(UTC)}
        if "FROM alerts" in sql:
            alert_id = str(args[0]) if args else ""
            if alert_id == "missing":
                return None
            return {
                "id": alert_id,
                "condition_type": "price_change",
                "acknowledged_at": None,
                "created_at": datetime.now(UTC),
            }
        return None


class _FakeRedis:
    async def llen(self, key: str) -> int:
        if key.endswith("mission"):
            return 2
        return 0


@pytest.mark.asyncio
async def test_agent_runs_without_status_filter() -> None:
    agents.set_dependencies(db_pool=_FakeDbPool(), redis_client=_FakeRedis())
    result = await agents.agent_runs(limit=20)
    assert result.data is not None
    assert result.data.total_count == 1
    assert len(result.data.runs) == 1


@pytest.mark.asyncio
async def test_agent_runs_with_status_filter() -> None:
    agents.set_dependencies(db_pool=_FakeDbPool(), redis_client=_FakeRedis())
    result = await agents.agent_runs(status="completed", limit=20)
    assert result.data is not None
    assert result.data.total_count == 1


@pytest.mark.asyncio
async def test_mission_status_missing_id() -> None:
    agents.set_dependencies(db_pool=_FakeDbPool(), redis_client=_FakeRedis())
    result = await agents.mission_status("missing")
    assert result.data is None
    assert result.error is not None


@pytest.mark.asyncio
async def test_celery_inspect_queue_depths() -> None:
    agents.set_dependencies(db_pool=_FakeDbPool(), redis_client=_FakeRedis())
    result = await agents.celery_inspect()
    assert result.data is not None
    assert any(queue.depth >= 2 for queue in result.data.queues)


@pytest.mark.asyncio
async def test_alert_inspect_missing_id() -> None:
    agents.set_dependencies(db_pool=_FakeDbPool(), redis_client=_FakeRedis())
    result = await agents.alert_inspect("missing")
    assert result.data is None
    assert result.error is not None
