"""Tests for AnalystAgent."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from api.agents.analyst_agent import AnalystAgent
from api.lib.tracing import TracingClient
from finsight.shared.models import (
    Assessment,
    FundamentalsSnapshot,
    KnowledgeSnippet,
    NewsItem,
    OHLCVBar,
    ResearchPacket,
    RiskItem,
    ThesisImpact,
)


@pytest.fixture()
def research_packet_fixture() -> ResearchPacket:
    return ResearchPacket(
        ticker="AAPL",
        mission_id=uuid4(),
        price_history=[
            OHLCVBar(
                date=datetime(2026, 1, 1, tzinfo=UTC),
                open=100.0,
                high=105.0,
                low=99.0,
                close=104.0,
                volume=1_000_000,
            )
        ],
        fundamentals=FundamentalsSnapshot(symbol="AAPL", pe_ratio=30.0, revenue=1_000_000_000),
        news_items=[NewsItem(headline="Revenue beat expected", source="Wire")],
        kb_entries=[KnowledgeSnippet(id="1", content="Prior quarter margins improved")],
        data_gaps=[],
    )


@pytest.fixture()
def built_assessment() -> Assessment:
    return Assessment(
        significance="Earnings momentum remains supportive.",
        thesis_impact=ThesisImpact.SUPPORTS,
        thesis_rationale="Revenue and margin trajectory align with bullish thesis.",
        risks=[RiskItem(description="Valuation elevated", severity="medium")],
        confidence=0.78,
        data_limitations=["Single-day reaction only"],
    )


@pytest.mark.asyncio
async def test_analyst_returns_assessment(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
    research_packet_fixture: ResearchPacket,
    built_assessment: Assessment,
) -> None:
    tracer = MagicMock(spec=TracingClient)
    agent = AnalystAgent(
        config=agent_configs.agents["analyst"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=tracer,
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=built_assessment)
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    result = await agent.run(research_packet_fixture, research_packet_fixture.mission_id)

    assert isinstance(result, Assessment)
    assert result.thesis_impact == ThesisImpact.SUPPORTS
    assert chain.ainvoke.call_count == 1


@pytest.mark.asyncio
async def test_analyst_records_agent_run(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
    research_packet_fixture: ResearchPacket,
    built_assessment: Assessment,
) -> None:
    tracer = MagicMock(spec=TracingClient)
    agent = AnalystAgent(
        config=agent_configs.agents["analyst"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=tracer,
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(
        return_value=built_assessment.model_copy(
            update={"usage_metadata": {"input_tokens": 1000, "output_tokens": 500}}
        )
    )
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    await agent.run(research_packet_fixture, research_packet_fixture.mission_id)

    payload = mock_agent_run_repo.create.await_args.args[0]
    assert payload["agent_name"] == "analyst"
    assert payload["status"] == "completed"
    assert payload["cost_usd"] == pricing_registry.compute_cost(
        "anthropic/claude-sonnet-4-20250514",
        1000,
        500,
    )


@pytest.mark.asyncio
async def test_analyst_handles_conflicting_signals(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
    research_packet_fixture: ResearchPacket,
) -> None:
    conflicting_packet = research_packet_fixture.model_copy(
        update={
            "news_items": [NewsItem(headline="Regulatory probe announced", source="Wire")],
        }
    )
    contradiction = Assessment(
        significance="Headline risk dominates short-term sentiment.",
        thesis_impact=ThesisImpact.CONTRADICTS,
        thesis_rationale="Regulatory risk offsets otherwise healthy fundamentals.",
        risks=[RiskItem(description="Legal exposure", severity="high")],
        confidence=0.72,
        data_limitations=[],
    )

    agent = AnalystAgent(
        config=agent_configs.agents["analyst"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=contradiction)
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    result = await agent.run(conflicting_packet, conflicting_packet.mission_id)

    assert result.thesis_impact == ThesisImpact.CONTRADICTS
