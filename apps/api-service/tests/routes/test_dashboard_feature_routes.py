"""Route tests for dashboard support endpoints."""

from __future__ import annotations

from collections.abc import AsyncGenerator, Generator
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from pytest import MonkeyPatch


@dataclass
class _FakeWatchlistItem:
    id: UUID
    ticker: str
    name: str | None
    sector: str | None
    list_type: str | None
    is_active: bool
    price_change_pct_threshold: float | None
    volume_spike_multiplier: float | None
    created_at: datetime
    updated_at: datetime


@dataclass
class _FakeAlert:
    id: UUID
    watchlist_item_id: UUID
    mission_id: UUID | None
    condition_type: str
    severity: str
    trigger_condition: str
    observed_value: float | None
    threshold_value: float | None
    acknowledged_at: datetime | None
    created_at: datetime


@dataclass
class _FakeKnowledgeEntry:
    id: UUID
    ticker: str | None
    entry_type: str | None
    content_summary: str | None
    confidence: float
    freshness_at: datetime | None
    freshness_date: date | None
    source_type: str | None
    author_agent: str | None
    conflict_markers: list[str]
    tags: list[str]
    updated_at: datetime


@dataclass
class _FakeMission:
    id: UUID
    mission_type: str
    status: str
    query: str
    ticker: str | None
    updated_at: datetime


@dataclass
class _FakeAgentRun:
    id: UUID
    mission_id: UUID
    agent_name: str
    status: str
    duration_ms: int | None
    started_at: datetime


class _FakeSession:
    async def commit(self) -> None:
        return None


class _FakeWatchlistRepo:
    def __init__(self) -> None:
        now = datetime.now(UTC)
        self.item = _FakeWatchlistItem(
            id=uuid4(),
            ticker="AAPL",
            name="Apple Inc",
            sector="Technology",
            list_type="core",
            is_active=True,
            price_change_pct_threshold=3.0,
            volume_spike_multiplier=2.0,
            created_at=now,
            updated_at=now,
        )

    async def list(self, *, include_inactive: bool = True) -> list[_FakeWatchlistItem]:
        _ = include_inactive
        return [self.item]

    async def create(self, data: dict[str, object]) -> _FakeWatchlistItem:
        now = datetime.now(UTC)
        ticker = str(data["ticker"])
        price_change_obj = data.get("price_change_pct_threshold")
        volume_spike_obj = data.get("volume_spike_multiplier")
        self.item = _FakeWatchlistItem(
            id=uuid4(),
            ticker=ticker,
            name=(str(data["name"]) if "name" in data and isinstance(data["name"], str) else None),
            sector=(
                str(data["sector"])
                if "sector" in data and isinstance(data["sector"], str)
                else None
            ),
            list_type=(
                str(data["list_type"])
                if "list_type" in data and isinstance(data["list_type"], str)
                else None
            ),
            is_active=bool(data.get("is_active", True)),
            price_change_pct_threshold=(
                float(price_change_obj) if isinstance(price_change_obj, (int, float)) else None
            ),
            volume_spike_multiplier=(
                float(volume_spike_obj) if isinstance(volume_spike_obj, (int, float)) else None
            ),
            created_at=now,
            updated_at=now,
        )
        return self.item

    async def update(self, item_id: UUID, data: dict[str, object]) -> _FakeWatchlistItem | None:
        if item_id != self.item.id:
            return None
        if isinstance(data.get("ticker"), str):
            self.item.ticker = str(data["ticker"])
        if "name" in data:
            self.item.name = str(data["name"]) if isinstance(data.get("name"), str) else None
        if "sector" in data:
            self.item.sector = str(data["sector"]) if isinstance(data.get("sector"), str) else None
        if "list_type" in data:
            self.item.list_type = (
                str(data["list_type"]) if isinstance(data.get("list_type"), str) else None
            )
        self.item.updated_at = datetime.now(UTC)
        return self.item

    async def soft_delete(self, item_id: UUID) -> bool:
        return item_id == self.item.id


class _FakeAlertRepo:
    def __init__(self) -> None:
        self.alert = _FakeAlert(
            id=uuid4(),
            watchlist_item_id=uuid4(),
            mission_id=None,
            condition_type="price_change",
            severity="high",
            trigger_condition="AAPL moved 5%",
            observed_value=5.0,
            threshold_value=3.0,
            acknowledged_at=None,
            created_at=datetime.now(UTC),
        )

    async def list(
        self, *, unacknowledged_only: bool = False, limit: int = 100
    ) -> list[_FakeAlert]:
        _ = unacknowledged_only
        _ = limit
        return [self.alert]

    async def acknowledge(self, alert_id: UUID) -> _FakeAlert | None:
        if alert_id == self.alert.id:
            return self.alert
        return None


class _FakeKnowledgeRepo:
    async def search(
        self,
        *,
        query: str | None,
        limit: int,
        offset: int,
    ) -> list[_FakeKnowledgeEntry]:
        _ = query
        _ = limit
        _ = offset
        return [
            _FakeKnowledgeEntry(
                id=uuid4(),
                ticker="AAPL",
                entry_type="thesis_current",
                content_summary="Apple momentum remains strong",
                confidence=0.85,
                freshness_at=datetime.now(UTC),
                freshness_date=date.today(),
                source_type="analysis",
                author_agent="bookkeeper",
                conflict_markers=["valuation divergence"],
                tags=["tech", "momentum"],
                updated_at=datetime.now(UTC),
            )
        ]


class _FakeMissionRepo:
    async def list(
        self,
        *,
        status: str | None = None,
        source: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[_FakeMission]:
        _ = source
        _ = offset
        base = [
            _FakeMission(
                id=uuid4(),
                mission_type="unknown",
                status="running",
                query="analyze AAPL",
                ticker="AAPL",
                updated_at=datetime.now(UTC),
            ),
            _FakeMission(
                id=uuid4(),
                mission_type="unknown",
                status="pending",
                query="analyze MSFT",
                ticker="MSFT",
                updated_at=datetime.now(UTC),
            ),
        ]
        if status is not None:
            base = [entry for entry in base if entry.status == status]
        return base[:limit]


class _FakeAgentRunRepo:
    async def list_recent(self, *, limit: int) -> list[_FakeAgentRun]:
        return [
            _FakeAgentRun(
                id=uuid4(),
                mission_id=uuid4(),
                agent_name="analyst",
                status="completed",
                duration_ms=1200,
                started_at=datetime.now(UTC),
            )
        ][:limit]


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def _override_session_dependency() -> Generator[None]:
    from api.lib.db import get_session
    from api.main import app

    async def _fake_get_session() -> AsyncGenerator[_FakeSession]:
        yield _FakeSession()

    app.dependency_overrides[get_session] = _fake_get_session
    yield
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture()
def _override_watchlist_repo(monkeypatch: MonkeyPatch) -> _FakeWatchlistRepo:
    from api.routes import watchlist as watchlist_routes

    fake = _FakeWatchlistRepo()
    monkeypatch.setattr(watchlist_routes, "WatchlistItemRepository", lambda _session: fake)
    return fake


@pytest.fixture()
def _override_alert_repo(monkeypatch: MonkeyPatch) -> _FakeAlertRepo:
    from api.routes import alerts as alerts_routes

    fake = _FakeAlertRepo()
    monkeypatch.setattr(alerts_routes, "AlertRepository", lambda _session: fake)
    return fake


@pytest.fixture()
def _override_knowledge_repo(monkeypatch: MonkeyPatch) -> None:
    from api.routes import knowledge as knowledge_routes

    monkeypatch.setattr(
        knowledge_routes,
        "KnowledgeEntryRepository",
        lambda _session: _FakeKnowledgeRepo(),
    )


@pytest.fixture()
def _override_dashboard_deps(monkeypatch: MonkeyPatch) -> None:
    from api.routes import dashboard as dashboard_routes

    async def _fake_health() -> dict[str, object]:
        return {
            "status": "healthy",
            "subsystems": {"database": "ok", "cache": "ok", "config": "ok"},
        }

    monkeypatch.setattr(dashboard_routes, "MissionRepository", lambda _session: _FakeMissionRepo())
    monkeypatch.setattr(
        dashboard_routes,
        "WatchlistItemRepository",
        lambda _session: _FakeWatchlistRepo(),
    )
    monkeypatch.setattr(dashboard_routes, "AlertRepository", lambda _session: _FakeAlertRepo())
    monkeypatch.setattr(
        dashboard_routes, "AgentRunRepository", lambda _session: _FakeAgentRunRepo()
    )
    monkeypatch.setattr(dashboard_routes, "system_health", _fake_health)


@pytest.mark.asyncio()
async def test_watchlist_viewer_list_only(
    app_client: AsyncClient,
    viewer_token: str,
    _override_watchlist_repo: _FakeWatchlistRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_session_dependency
    fake_repo = _override_watchlist_repo

    list_response = await app_client.get("/watchlist", headers=_auth_header(viewer_token))
    assert list_response.status_code == 200
    assert isinstance(list_response.json().get("items"), list)

    create_response = await app_client.post(
        "/watchlist",
        headers=_auth_header(viewer_token),
        json={"ticker": "NVDA", "is_active": True},
    )
    assert create_response.status_code == 403

    patch_response = await app_client.patch(
        f"/watchlist/{fake_repo.item.id}",
        headers=_auth_header(viewer_token),
        json={"ticker": "TSLA", "is_active": True},
    )
    assert patch_response.status_code == 403


@pytest.mark.asyncio()
async def test_watchlist_admin_crud_access(
    app_client: AsyncClient,
    admin_token: str,
    _override_watchlist_repo: _FakeWatchlistRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_session_dependency
    fake_repo = _override_watchlist_repo

    create_response = await app_client.post(
        "/watchlist",
        headers=_auth_header(admin_token),
        json={"ticker": "NVDA", "is_active": True},
    )
    assert create_response.status_code == 201

    patch_response = await app_client.patch(
        f"/watchlist/{fake_repo.item.id}",
        headers=_auth_header(admin_token),
        json={"ticker": "TSLA", "is_active": True},
    )
    assert patch_response.status_code == 200

    delete_response = await app_client.delete(
        f"/watchlist/{fake_repo.item.id}",
        headers=_auth_header(admin_token),
    )
    assert delete_response.status_code == 204


@pytest.mark.asyncio()
async def test_watchlist_rejects_invalid_list_type(
    app_client: AsyncClient,
    admin_token: str,
    _override_watchlist_repo: _FakeWatchlistRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_watchlist_repo
    _ = _override_session_dependency
    response = await app_client.post(
        "/watchlist",
        headers=_auth_header(admin_token),
        json={"ticker": "NVDA", "list_type": "portfolio", "is_active": True},
    )
    assert response.status_code == 422


@pytest.mark.asyncio()
async def test_watchlist_service_forbidden(
    app_client: AsyncClient,
    service_token: str,
) -> None:
    response = await app_client.get("/watchlist", headers=_auth_header(service_token))
    assert response.status_code == 403


@pytest.mark.asyncio()
async def test_dashboard_local_bypass_requires_token(
    app_client: AsyncClient,
    _override_watchlist_repo: _FakeWatchlistRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_watchlist_repo
    _ = _override_session_dependency

    allowed = await app_client.get(
        "/watchlist",
        headers={
            "X-Dashboard-Bypass": "1",
            "X-Dashboard-Bypass-Token": "test-dashboard-bypass-token",
        },
    )
    assert allowed.status_code == 200

    denied_wrong_token = await app_client.get(
        "/watchlist",
        headers={
            "X-Dashboard-Bypass": "1",
            "X-Dashboard-Bypass-Token": "wrong-token",
        },
    )
    assert denied_wrong_token.status_code == 401

    denied_spoofed_forwarded_for = await app_client.get(
        "/watchlist",
        headers={
            "X-Dashboard-Bypass": "1",
            "X-Forwarded-For": "127.0.0.1",
        },
    )
    assert denied_spoofed_forwarded_for.status_code == 401


@pytest.mark.asyncio()
async def test_alert_routes(
    app_client: AsyncClient,
    viewer_token: str,
    _override_alert_repo: _FakeAlertRepo,
    _override_session_dependency: None,
) -> None:
    _ = _override_alert_repo
    _ = _override_session_dependency
    list_response = await app_client.get(
        "/alerts",
        headers=_auth_header(viewer_token),
        params={"unacknowledged_only": "true"},
    )
    assert list_response.status_code == 200
    items = list_response.json().get("items")
    assert isinstance(items, list)
    alert_id = items[0]["id"]

    ack_response = await app_client.post(
        f"/alerts/{alert_id}/acknowledge",
        headers=_auth_header(viewer_token),
    )
    assert ack_response.status_code == 200


@pytest.mark.asyncio()
async def test_knowledge_list_viewer_allowed(
    app_client: AsyncClient,
    viewer_token: str,
    _override_knowledge_repo: None,
) -> None:
    _ = _override_knowledge_repo
    response = await app_client.get(
        "/knowledge",
        headers=_auth_header(viewer_token),
        params={"query": "AAPL", "limit": 10, "offset": 0},
    )
    assert response.status_code == 200
    items = response.json().get("items")
    assert isinstance(items, list)
    assert items[0]["ticker"] == "AAPL"


@pytest.mark.asyncio()
async def test_dashboard_overview_and_health(
    app_client: AsyncClient,
    viewer_token: str,
    _override_dashboard_deps: None,
) -> None:
    _ = _override_dashboard_deps
    overview = await app_client.get("/dashboard/overview", headers=_auth_header(viewer_token))
    assert overview.status_code == 200
    body = overview.json()
    assert isinstance(body.get("counts"), dict)
    assert isinstance(body.get("recent_missions"), list)
    assert isinstance(body.get("recent_agent_runs"), list)
    counts = body.get("counts")
    assert isinstance(counts, dict)
    assert "watchlist_active" in counts
    assert "unacknowledged_alerts" in counts

    health = await app_client.get("/dashboard/health", headers=_auth_header(viewer_token))
    assert health.status_code == 200
    health_body = health.json()
    assert isinstance(health_body.get("services"), dict)
