"""Mission routes tests."""

from __future__ import annotations

from collections.abc import AsyncGenerator, Generator
from dataclasses import dataclass
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from pytest import MonkeyPatch


@dataclass
class _FakeMission:
    id: UUID
    mission_type: str
    source: str
    status: str
    query: str
    ticker: str | None
    created_at: datetime
    updated_at: datetime


class _FakeMissionRepo:
    def __init__(self) -> None:
        now = datetime.now(UTC)
        self._stored = _FakeMission(
            id=uuid4(),
            mission_type="unknown",
            source="operator",
            status="pending",
            query="seed",
            ticker=None,
            created_at=now,
            updated_at=now,
        )

    async def create(self, data: dict[str, object]) -> _FakeMission:
        now = datetime.now(UTC)
        ticker_obj = data.get("ticker")
        ticker = ticker_obj if isinstance(ticker_obj, str) else None
        mission = _FakeMission(
            id=uuid4(),
            mission_type=str(data["mission_type"]),
            source=str(data["source"]),
            status=str(data["status"]),
            query=str(data["query"]),
            ticker=ticker,
            created_at=now,
            updated_at=now,
        )
        self._stored = mission
        return mission

    async def get_by_id(self, mission_id: UUID) -> _FakeMission | None:
        if mission_id == self._stored.id:
            return self._stored
        return None

    async def list(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[_FakeMission]:
        _ = offset
        if status is not None and self._stored.status != status:
            return []
        if source is not None and self._stored.source != source:
            return []
        return [self._stored][:limit]


class _FakeAgentRunRepo:
    async def list_by_mission(self, mission_id: UUID) -> list[Any]:
        _ = mission_id
        return []


class _FakeSession:
    async def commit(self) -> None:
        return None


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def _override_mission_deps(monkeypatch: MonkeyPatch) -> _FakeMissionRepo:
    from api.routes import missions as missions_routes

    fake_mission_repo = _FakeMissionRepo()

    monkeypatch.setattr(missions_routes, "MissionRepository", lambda _session: fake_mission_repo)
    monkeypatch.setattr(missions_routes, "AgentRunRepository", lambda _session: _FakeAgentRunRepo())
    monkeypatch.setattr(
        missions_routes,
        "run_mission_pipeline",
        SimpleNamespace(delay=lambda _mission_id: None),
    )

    return fake_mission_repo


@pytest.fixture()
def _override_session_dependency() -> Generator[None]:
    from api.lib.db import get_session
    from api.main import app

    async def _fake_get_session() -> AsyncGenerator[_FakeSession]:
        yield _FakeSession()

    app.dependency_overrides[get_session] = _fake_get_session
    yield
    app.dependency_overrides.pop(get_session, None)


async def test_create_mission_viewer_allowed(
    app_client: AsyncClient,
    viewer_token: str,
    _override_mission_deps: _FakeMissionRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_mission_deps
    _ = _override_session_dependency
    response = await app_client.post(
        "/missions",
        json={"query": "analyze AAPL"},
        headers=_auth_header(viewer_token),
    )
    assert response.status_code == 202
    assert isinstance(response.json().get("mission_id"), str)


async def test_create_mission_service_allowed(
    app_client: AsyncClient,
    service_token: str,
    _override_mission_deps: _FakeMissionRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_mission_deps
    _ = _override_session_dependency
    response = await app_client.post(
        "/missions",
        json={"query": "analyze AAPL"},
        headers=_auth_header(service_token),
    )
    assert response.status_code == 202
    assert isinstance(response.json().get("mission_id"), str)


async def test_list_missions_service_forbidden(
    app_client: AsyncClient,
    service_token: str,
    _override_mission_deps: _FakeMissionRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_mission_deps
    _ = _override_session_dependency
    response = await app_client.get(
        "/missions",
        headers=_auth_header(service_token),
    )
    assert response.status_code == 403


async def test_list_recent_missions_for_service_allowed(
    app_client: AsyncClient,
    service_token: str,
    _override_mission_deps: _FakeMissionRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_mission_deps
    _ = _override_session_dependency
    response = await app_client.get(
        "/missions/service/recent",
        headers=_auth_header(service_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body.get("items"), list)


async def test_list_recent_missions_for_service_viewer_forbidden(
    app_client: AsyncClient,
    viewer_token: str,
    _override_mission_deps: _FakeMissionRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_mission_deps
    _ = _override_session_dependency
    response = await app_client.get(
        "/missions/service/recent",
        headers=_auth_header(viewer_token),
    )
    assert response.status_code == 403
