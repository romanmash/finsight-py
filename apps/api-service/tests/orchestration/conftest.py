"""Fixtures for orchestration tests."""

from __future__ import annotations

import os
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")


@pytest.fixture(autouse=True)
def celery_eager_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.lib.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "true")


@pytest.fixture()
def checkpointer() -> object:
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver

        return SqliteSaver(":memory:")
    except Exception:
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()


@pytest.fixture()
def mock_mission_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.create = AsyncMock(return_value=SimpleNamespace(id=uuid4()))
    repo.get_by_id = AsyncMock()
    repo.update_status = AsyncMock()
    repo.list = AsyncMock(return_value=[])
    return repo


@pytest.fixture()
def mock_alert_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.list_unprocessed = AsyncMock(return_value=[])
    repo.set_mission_id = AsyncMock()
    return repo


@pytest.fixture()
def mock_manager_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_watchdog_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_researcher_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_analyst_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_technician_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_trader_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_screener_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_bookkeeper_agent() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def mock_reporter_agent() -> AsyncMock:
    return AsyncMock()
