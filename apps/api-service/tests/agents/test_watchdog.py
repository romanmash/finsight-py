"""Watchdog agent tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from api.agents.watchdog_agent import WatchdogAgent
from api.mcp.client import MCPToolError
from pydantic import ValidationError

from config.schemas.watchdog import WatchdogConfig


@pytest.fixture()
def watchdog_config() -> WatchdogConfig:
    return WatchdogConfig.model_validate(
        {
            "poll_interval_seconds": 30,
            "alert_cooldown_seconds": 300,
            "news_spike_rate_per_hour": 5,
            "news_fetch_limit": 100,
            "dedup_window_hours": 4,
            "default_thresholds": {
                "price_change_pct": 3.0,
                "volume_spike_multiplier": 2.0,
                "rsi_overbought": 70.0,
            },
        }
    )


def _item(ticker: str, pct: float | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        ticker=ticker,
        price_change_pct_threshold=pct,
        volume_spike_multiplier=None,
    )


def _price_payload(current_price: float, prev_close: float = 100.0) -> dict[str, Any]:
    return {
        "current_price": current_price,
        "prev_close": prev_close,
        "current_volume": 100.0,
        "avg_volume": 100.0,
    }


@pytest.mark.asyncio
async def test_price_breach_creates_alert_and_mission(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("AAPL")])
    alert_repo.get_recent = AsyncMock(return_value=[])
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=uuid4()))

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=105.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.alerts_created == 1
    assert result.missions_opened == 1
    alert_repo.create.assert_called_once()
    mission_repo.create.assert_called_once()
    payload = agent_run_repo.create.await_args.args[0]
    assert payload["cost_usd"] == 0


@pytest.mark.asyncio
async def test_no_breach_creates_no_alert(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("MSFT")])
    alert_repo.get_recent = AsyncMock(return_value=[])

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=101.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.alerts_created == 0
    alert_repo.create.assert_not_called()


@pytest.mark.asyncio
async def test_dedup_prevents_duplicate_alert(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("NVDA")])
    alert_repo.get_recent = AsyncMock(return_value=[SimpleNamespace(id=uuid4())])

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=110.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.dedup_skipped == 1
    alert_repo.create.assert_not_called()
    mission_repo.create.assert_not_called()
    assert alert_repo.get_recent.await_args.kwargs["condition_type"] == "price_move"


@pytest.mark.asyncio
async def test_multiple_items_evaluated_independently(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    items = [_item("AAPL"), _item("SPY")]
    watchlist_repo.list_active = AsyncMock(return_value=items)
    alert_repo.get_recent = AsyncMock(return_value=[])
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=uuid4()))

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        symbol = params["symbol"] if tool_name == "market.get_price" else params["query"]
        if tool_name == "market.get_price" and symbol == "AAPL":
            return _price_payload(current_price=106.0)
        if tool_name == "market.get_price" and symbol == "SPY":
            return _price_payload(current_price=101.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.items_evaluated == 2
    assert result.alerts_created == 1


@pytest.mark.asyncio
async def test_per_item_threshold_overrides_yaml_default(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("TSLA", pct=1.5)])
    alert_repo.get_recent = AsyncMock(return_value=[])
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=uuid4()))

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=102.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.alerts_created == 1


@pytest.mark.asyncio
async def test_mcp_tool_failure_skips_item_gracefully(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("QQQ")])
    alert_repo.get_recent = AsyncMock(return_value=[])

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            raise MCPToolError("market.get_price", "timeout")
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.items_evaluated == 1
    assert result.alerts_created == 0


@pytest.mark.asyncio
async def test_news_spike_creates_alert(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("AMD")])
    alert_repo.get_recent = AsyncMock(return_value=[])
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=uuid4()))

    now = datetime.now(UTC)
    recent_news = [
        {"published_at": (now - timedelta(minutes=5)).isoformat(), "headline": str(i)}
        for i in range(10)
    ]

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=100.0)
        return {"items": recent_news}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.alerts_created == 1


@pytest.mark.asyncio
async def test_normal_news_volume_no_alert(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("INTC")])
    alert_repo.get_recent = AsyncMock(return_value=[])

    now = datetime.now(UTC)
    news = [{"published_at": (now - timedelta(minutes=5)).isoformat(), "headline": "n"}] * 2

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=100.0)
        return {"items": news}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    result = await agent.run(uuid4())

    assert result.alerts_created == 0


@pytest.mark.asyncio
async def test_news_spike_severity_high(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    watchlist_repo.list_active = AsyncMock(return_value=[_item("META")])
    alert_repo.get_recent = AsyncMock(return_value=[])
    mission_repo.create = AsyncMock(return_value=SimpleNamespace(id=uuid4()))

    now = datetime.now(UTC)
    news = [
        {"published_at": (now - timedelta(minutes=1)).isoformat(), "headline": str(i)}
        for i in range(30)
    ]

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=100.0)
        return {"items": news}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)

    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )
    await agent.run(uuid4())

    payload = alert_repo.create.await_args.args[0]
    assert payload["severity"] == "critical"


@pytest.mark.asyncio
async def test_watchdog_creates_run_mission_when_mission_id_missing(
    watchdog_config: WatchdogConfig,
) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    cycle_mission_id = uuid4()
    alert_mission_id = uuid4()
    watchlist_repo.list_active = AsyncMock(return_value=[_item("AAPL")])
    alert_repo.get_recent = AsyncMock(return_value=[])
    mission_repo.create = AsyncMock(
        side_effect=[
            SimpleNamespace(id=cycle_mission_id),
            SimpleNamespace(id=alert_mission_id),
        ]
    )

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=105.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)
    agent = WatchdogAgent(
        watchdog_config,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )

    await agent.run()

    run_payload = agent_run_repo.create.await_args.args[0]
    assert run_payload["mission_id"] == cycle_mission_id


def test_watchdog_config_rejects_zero_thresholds() -> None:
    with pytest.raises(ValidationError):
        WatchdogConfig.model_validate(
            {
                "poll_interval_seconds": 30,
                "alert_cooldown_seconds": 300,
                "news_spike_rate_per_hour": 5,
                "news_fetch_limit": 100,
                "dedup_window_hours": 4,
                "default_thresholds": {
                    "price_change_pct": 0.0,
                    "volume_spike_multiplier": 2.0,
                    "rsi_overbought": 70.0,
                },
            }
        )


def test_watchdog_config_rejects_zero_news_fetch_limit() -> None:
    with pytest.raises(ValidationError):
        WatchdogConfig.model_validate(
            {
                "poll_interval_seconds": 30,
                "alert_cooldown_seconds": 300,
                "news_spike_rate_per_hour": 5,
                "news_fetch_limit": 0,
                "dedup_window_hours": 4,
                "default_thresholds": {
                    "price_change_pct": 3.0,
                    "volume_spike_multiplier": 2.0,
                    "rsi_overbought": 70.0,
                },
            }
        )


@pytest.mark.asyncio
async def test_watchdog_uses_news_fetch_limit_from_config(watchdog_config: WatchdogConfig) -> None:
    watchlist_repo = AsyncMock()
    alert_repo = AsyncMock()
    mission_repo = AsyncMock()
    mcp_client = AsyncMock()
    agent_run_repo = AsyncMock()

    cfg = watchdog_config.model_copy(update={"news_fetch_limit": 17})
    watchlist_repo.list_active = AsyncMock(return_value=[_item("AAPL")])
    alert_repo.get_recent = AsyncMock(return_value=[])

    async def _tool(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_price":
            return _price_payload(current_price=100.0)
        return {"items": []}

    mcp_client.call_tool = AsyncMock(side_effect=_tool)
    agent = WatchdogAgent(
        cfg,
        watchlist_repo,
        alert_repo,
        mission_repo,
        mcp_client,
        agent_run_repo,
    )

    await agent.run(uuid4())

    assert (
        "news.get_news",
        {"query": "AAPL", "limit": 17},
    ) in [(call.args[0], call.args[1]) for call in mcp_client.call_tool.await_args_list]
