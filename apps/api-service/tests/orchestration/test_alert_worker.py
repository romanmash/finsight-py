"""Tests for alert polling worker."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from api.workers import alert_worker


class _SessionContext:
    def __init__(self, session: AsyncMock) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncMock:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
        return None


@pytest.mark.asyncio
async def test_alert_worker_creates_mission_and_dispatches(monkeypatch: pytest.MonkeyPatch) -> None:
    session = AsyncMock()
    events: list[str] = []

    async def _commit() -> None:
        events.append("commit")

    session.commit = AsyncMock(side_effect=_commit)
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    watchlist_repo = AsyncMock()
    mission_id = uuid4()
    watchlist_item_id = uuid4()
    alert = SimpleNamespace(
        id=uuid4(),
        watchlist_item_id=watchlist_item_id,
        trigger_condition="AAPL moved above threshold",
    )
    alert_repo.list_unprocessed = AsyncMock(return_value=[alert])
    alert_repo.set_mission_id = AsyncMock()
    watchlist_repo.get_by_id = AsyncMock(return_value=SimpleNamespace(ticker="AAPL"))
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=mission_id))
    delay_mock = MagicMock(side_effect=lambda *_args, **_kwargs: events.append("delay"))

    monkeypatch.setattr(alert_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(alert_worker, "AlertRepository", lambda _: alert_repo)
    monkeypatch.setattr(alert_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(alert_worker, "WatchlistItemRepository", lambda _: watchlist_repo)
    monkeypatch.setattr(alert_worker.run_mission_pipeline, "delay", delay_mock)

    await alert_worker._poll_alerts_async()

    mission_repo.create.assert_awaited_once()
    create_payload = mission_repo.create.await_args.args[0]
    assert create_payload["ticker"] == "AAPL"
    alert_repo.set_mission_id.assert_awaited_once_with(alert.id, mission_id)
    delay_mock.assert_called_once_with(str(mission_id))
    assert events == ["commit", "delay"]


@pytest.mark.asyncio
async def test_alert_worker_skips_when_no_unprocessed_alerts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    watchlist_repo = AsyncMock()
    alert_repo.list_unprocessed = AsyncMock(return_value=[])
    alert_repo.set_mission_id = AsyncMock()
    watchlist_repo.get_by_id = AsyncMock()
    mission_repo.create = AsyncMock()
    delay_mock = MagicMock()

    monkeypatch.setattr(alert_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(alert_worker, "AlertRepository", lambda _: alert_repo)
    monkeypatch.setattr(alert_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(alert_worker, "WatchlistItemRepository", lambda _: watchlist_repo)
    monkeypatch.setattr(alert_worker.run_mission_pipeline, "delay", delay_mock)

    await alert_worker._poll_alerts_async()

    mission_repo.create.assert_not_called()
    delay_mock.assert_not_called()


@pytest.mark.asyncio
async def test_alert_worker_does_not_create_for_already_linked_alerts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    watchlist_repo = AsyncMock()
    # Already-linked alerts are filtered out by repository query and should not be returned.
    alert_repo.list_unprocessed = AsyncMock(return_value=[])
    watchlist_repo.get_by_id = AsyncMock()
    mission_repo.create = AsyncMock()
    delay_mock = MagicMock()

    monkeypatch.setattr(alert_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(alert_worker, "AlertRepository", lambda _: alert_repo)
    monkeypatch.setattr(alert_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(alert_worker, "WatchlistItemRepository", lambda _: watchlist_repo)
    monkeypatch.setattr(alert_worker.run_mission_pipeline, "delay", delay_mock)

    await alert_worker._poll_alerts_async()

    mission_repo.create.assert_not_called()
    delay_mock.assert_not_called()


@pytest.mark.asyncio
async def test_alert_worker_extracts_ticker_from_trigger_when_watchlist_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    watchlist_repo = AsyncMock()
    mission_id = uuid4()
    alert = SimpleNamespace(
        id=uuid4(),
        watchlist_item_id=uuid4(),
        trigger_condition="$TSLA price moved 5.2% exceeding threshold",
    )
    alert_repo.list_unprocessed = AsyncMock(return_value=[alert])
    alert_repo.set_mission_id = AsyncMock()
    watchlist_repo.get_by_id = AsyncMock(return_value=None)
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=mission_id))
    delay_mock = MagicMock()

    monkeypatch.setattr(alert_worker, "SessionLocal", lambda: _SessionContext(session))
    monkeypatch.setattr(alert_worker, "AlertRepository", lambda _: alert_repo)
    monkeypatch.setattr(alert_worker, "MissionRepository", lambda _: mission_repo)
    monkeypatch.setattr(alert_worker, "WatchlistItemRepository", lambda _: watchlist_repo)
    monkeypatch.setattr(alert_worker.run_mission_pipeline, "delay", delay_mock)

    await alert_worker._poll_alerts_async()

    payload = mission_repo.create.await_args.args[0]
    assert payload["ticker"] == "TSLA"
