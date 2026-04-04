"""Tests for mission worker lifecycle and checkpoint behavior."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from api.workers import mission_worker
from finsight.shared.models import FormattedReport, ReportSection


def _checkpointer() -> SimpleNamespace:
    return SimpleNamespace(close=lambda: None)


class _SessionContext:
    def __init__(self, session: AsyncMock) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncMock:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
        return None


def _mission(mission_id: UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=mission_id,
        mission_type="investigation",
        source="operator",
        status="pending",
        query="analyze AAPL",
        ticker="AAPL",
    )


@pytest.mark.asyncio
async def test_mission_worker_status_transitions_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    mission_id = uuid4()
    session = AsyncMock()
    status_calls: list[str] = []
    mission_repo = AsyncMock()
    mission_repo.get_by_id = AsyncMock(return_value=_mission(mission_id))

    async def _update_status(_: UUID, status: str) -> SimpleNamespace:
        status_calls.append(status)
        return _mission(mission_id)

    mission_repo.update_status = AsyncMock(side_effect=_update_status)
    report = FormattedReport(
        title="Done",
        sections=[ReportSection(title="Summary", content="ok")],
        full_text="ok",
        ticker="AAPL",
        mission_id=mission_id,
        generated_at=datetime.now(UTC),
    )
    graph = AsyncMock()
    graph.ainvoke = AsyncMock(return_value={"formatted_report": report})

    monkeypatch.setattr(mission_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(mission_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(mission_worker, "_build_checkpointer", _checkpointer)
    monkeypatch.setattr(mission_worker, "_build_agents", lambda _: (AsyncMock(), AsyncMock()))
    monkeypatch.setattr(mission_worker, "build_supervisor_graph", lambda **_: graph)
    send_task_mock = MagicMock()
    monkeypatch.setattr(mission_worker.celery_app, "send_task", send_task_mock)

    await mission_worker._run_pipeline_async(mission_id)

    assert status_calls == ["running", "completed"]
    send_task_mock.assert_called_once()


@pytest.mark.asyncio
async def test_mission_worker_marks_failed_on_graph_error(monkeypatch: pytest.MonkeyPatch) -> None:
    mission_id = uuid4()
    session = AsyncMock()
    status_calls: list[str] = []
    mission_repo = AsyncMock()
    mission_repo.get_by_id = AsyncMock(return_value=_mission(mission_id))

    async def _update_status(_: UUID, status: str) -> SimpleNamespace:
        status_calls.append(status)
        return _mission(mission_id)

    mission_repo.update_status = AsyncMock(side_effect=_update_status)
    graph = AsyncMock()
    graph.ainvoke = AsyncMock(side_effect=RuntimeError("boom"))

    monkeypatch.setattr(mission_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(mission_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(mission_worker, "_build_checkpointer", _checkpointer)
    monkeypatch.setattr(mission_worker, "_build_agents", lambda _: (AsyncMock(), AsyncMock()))
    monkeypatch.setattr(mission_worker, "build_supervisor_graph", lambda **_: graph)

    with pytest.raises(RuntimeError, match="boom"):
        await mission_worker._run_pipeline_async(mission_id)

    assert status_calls == ["running", "failed"]


@pytest.mark.asyncio
async def test_mission_worker_skips_completed_mission(monkeypatch: pytest.MonkeyPatch) -> None:
    mission_id = uuid4()
    session = AsyncMock()
    completed_mission = SimpleNamespace(
        id=mission_id,
        mission_type="investigation",
        source="operator",
        status="completed",
        query="analyze AAPL",
        ticker="AAPL",
    )
    mission_repo = AsyncMock()
    mission_repo.get_by_id = AsyncMock(return_value=completed_mission)
    mission_repo.update_status = AsyncMock()
    graph = AsyncMock()
    graph.ainvoke = AsyncMock()

    monkeypatch.setattr(mission_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(mission_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(mission_worker, "_build_checkpointer", _checkpointer)
    monkeypatch.setattr(mission_worker, "_build_agents", lambda _: (AsyncMock(), AsyncMock()))
    monkeypatch.setattr(mission_worker, "build_supervisor_graph", lambda **_: graph)

    await mission_worker._run_pipeline_async(mission_id)

    mission_repo.update_status.assert_not_called()
    graph.ainvoke.assert_not_called()


def test_build_checkpointer_fails_fast_when_postgres_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CELERY_TASK_ALWAYS_EAGER", raising=False)
    monkeypatch.setenv("LANGGRAPH_CHECKPOINT_DB_URL", "postgresql://invalid")

    class _BrokenPostgresSaver:
        @classmethod
        def from_conn_string(cls, _: str) -> object:
            raise RuntimeError("connection failed")

    import sys
    import types

    fake_module = types.ModuleType("langgraph.checkpoint.postgres")
    fake_module.PostgresSaver = _BrokenPostgresSaver
    monkeypatch.setitem(sys.modules, "langgraph.checkpoint.postgres", fake_module)

    with pytest.raises(
        RuntimeError,
        match="Failed to initialize Postgres LangGraph checkpointer",
    ):
        mission_worker._build_checkpointer()
