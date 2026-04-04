"""Researcher agent tests."""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from api.agents.researcher_agent import ResearcherAgent, ResearchInput
from api.mcp.client import MCPToolError
from finsight.shared.models import ResearchPacket

from config.schemas.researcher import ResearcherConfig


def _tool_payloads() -> dict[str, dict[str, object]]:
    return {
        "market.get_ohlcv": {
            "items": [
                {
                    "date": "2026-04-01T00:00:00+00:00",
                    "open": 100.0,
                    "high": 101.0,
                    "low": 99.5,
                    "close": 100.5,
                    "volume": 1000000.0,
                }
            ]
        },
        "market.get_fundamentals": {
            "symbol": "AAPL",
            "market_cap": 100.0,
            "pe_ratio": 20.0,
            "eps": 5.0,
            "revenue": 50.0,
            "sector": "Technology",
        },
        "news.get_news": {
            "items": [
                {
                    "headline": "Apple launches update",
                    "source": "Newswire",
                    "url": "https://example.com",
                    "published_at": "2026-04-01T00:00:00+00:00",
                    "relevance_score": 0.8,
                    "summary": "Update summary",
                }
            ]
        },
        "knowledge.search_knowledge": {
            "items": [
                {
                    "id": "k1",
                    "content": "Past note",
                    "author_agent": "bookkeeper",
                    "confidence": 0.7,
                    "tickers": ["AAPL"],
                    "tags": ["earnings"],
                    "similarity_score": 0.9,
                }
            ]
        },
    }


@pytest.fixture()
def researcher_config() -> ResearcherConfig:
    return ResearcherConfig.model_validate(
        {
            "ohlcv_period": "1mo",
            "news_limit": 10,
            "kb_limit": 5,
        }
    )


@pytest.mark.asyncio
async def test_all_tools_called_concurrently(
    mock_agent_run_repo: AsyncMock,
    researcher_config: ResearcherConfig,
) -> None:
    payloads = _tool_payloads()
    mcp_client = AsyncMock()

    async def _call(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        return payloads[tool_name]

    mcp_client.call_tool = AsyncMock(side_effect=_call)
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, researcher_config)

    await agent.run(ResearchInput(ticker="AAPL", mission_id=uuid4()))

    called_tools = {call.args[0] for call in mcp_client.call_tool.await_args_list}
    assert called_tools == {
        "market.get_ohlcv",
        "market.get_fundamentals",
        "news.get_news",
        "knowledge.search_knowledge",
    }


@pytest.mark.asyncio
async def test_packet_fields_populated(
    mock_agent_run_repo: AsyncMock,
    researcher_config: ResearcherConfig,
) -> None:
    payloads = _tool_payloads()
    mcp_client = AsyncMock()
    mcp_client.call_tool = AsyncMock(side_effect=lambda tool_name, params: payloads[tool_name])
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, researcher_config)

    packet = await agent.run(ResearchInput(ticker="AAPL", mission_id=uuid4()))

    assert packet.price_history is not None
    assert packet.fundamentals is not None
    assert len(packet.news_items) > 0
    assert len(packet.kb_entries) > 0
    assert packet.data_gaps == []


@pytest.mark.asyncio
async def test_absent_news_recorded_in_data_gaps(
    mock_agent_run_repo: AsyncMock,
    researcher_config: ResearcherConfig,
) -> None:
    payloads = _tool_payloads()
    payloads["news.get_news"] = {"items": []}
    mcp_client = AsyncMock()
    mcp_client.call_tool = AsyncMock(side_effect=lambda tool_name, params: payloads[tool_name])
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, researcher_config)

    packet = await agent.run(ResearchInput(ticker="AAPL", mission_id=uuid4()))

    assert any("news_items" in gap for gap in packet.data_gaps)


@pytest.mark.asyncio
async def test_absent_fundamentals_recorded_in_data_gaps(
    mock_agent_run_repo: AsyncMock,
    researcher_config: ResearcherConfig,
) -> None:
    payloads = _tool_payloads()
    payloads["market.get_fundamentals"] = {}
    mcp_client = AsyncMock()
    mcp_client.call_tool = AsyncMock(side_effect=lambda tool_name, params: payloads[tool_name])
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, researcher_config)

    packet = await agent.run(ResearchInput(ticker="AAPL", mission_id=uuid4()))

    assert any("fundamentals" in gap for gap in packet.data_gaps)


def test_no_analytical_fields_in_output() -> None:
    forbidden = {"analysis", "recommendation", "conclusion", "interpretation", "opinion"}
    fields = set(ResearchPacket.model_fields.keys())
    assert forbidden.isdisjoint(fields)


@pytest.mark.asyncio
async def test_agent_run_recorded_with_zero_cost(
    mock_agent_run_repo: AsyncMock,
    researcher_config: ResearcherConfig,
) -> None:
    payloads = _tool_payloads()
    mcp_client = AsyncMock()
    mcp_client.call_tool = AsyncMock(side_effect=lambda tool_name, params: payloads[tool_name])
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, researcher_config)

    mission_id = uuid4()
    await agent.run(ResearchInput(ticker="AAPL", mission_id=mission_id))

    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["cost_usd"] == Decimal("0.00")
    assert payload["tokens_in"] == 0
    assert payload["mission_id"] == mission_id


@pytest.mark.asyncio
async def test_partial_tool_failure_still_completes(
    mock_agent_run_repo: AsyncMock,
    researcher_config: ResearcherConfig,
) -> None:
    payloads = _tool_payloads()
    mcp_client = AsyncMock()

    async def _call(tool_name: str, params: dict[str, object]) -> dict[str, object]:
        if tool_name == "market.get_ohlcv":
            raise MCPToolError("market.get_ohlcv", "timeout")
        return payloads[tool_name]

    mcp_client.call_tool = AsyncMock(side_effect=_call)
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, researcher_config)

    packet = await agent.run(ResearchInput(ticker="AAPL", mission_id=uuid4()))

    assert any("price_history" in gap for gap in packet.data_gaps)


@pytest.mark.asyncio
async def test_tool_limits_and_period_from_config(mock_agent_run_repo: AsyncMock) -> None:
    payloads = _tool_payloads()
    mcp_client = AsyncMock()
    mcp_client.call_tool = AsyncMock(side_effect=lambda tool_name, params: payloads[tool_name])
    custom_config = ResearcherConfig.model_validate(
        {
            "ohlcv_period": "3mo",
            "news_limit": 25,
            "kb_limit": 12,
        }
    )
    agent = ResearcherAgent(mock_agent_run_repo, mcp_client, custom_config)

    await agent.run(ResearchInput(ticker="AAPL", mission_id=uuid4()))

    await_args = list(mcp_client.call_tool.await_args_list)
    assert ("market.get_ohlcv", {"symbol": "AAPL", "period": "3mo"}) in [
        (call.args[0], call.args[1]) for call in await_args
    ]
    assert ("news.get_news", {"query": "AAPL", "limit": 25}) in [
        (call.args[0], call.args[1]) for call in await_args
    ]
    assert ("knowledge.search_knowledge", {"query": "AAPL", "limit": 12}) in [
        (call.args[0], call.args[1]) for call in await_args
    ]
