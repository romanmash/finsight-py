"""Tests for PatternAgent."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from api.agents.pattern_agent import PatternAgent, PatternInput
from api.lib.tracing import TracingClient
from finsight.shared.models import OHLCVBar, PatternObservation, PatternReport, PatternType


@pytest.fixture()
def pattern_input_fixture() -> PatternInput:
    return PatternInput(
        ticker="MSFT",
        mission_id=uuid4(),
        price_history=[
            OHLCVBar(
                date=datetime(2026, 1, day, tzinfo=UTC),
                open=100.0 + day,
                high=101.0 + day,
                low=99.0 + day,
                close=100.5 + day,
                volume=1_000_000 + day,
            )
            for day in range(1, 9)
        ],
    )


@pytest.mark.asyncio
async def test_pattern_found(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
    pattern_input_fixture: PatternInput,
) -> None:
    expected = PatternReport(
        pattern_type=PatternType.UPTREND,
        pattern_name="Rising channel",
        confidence=0.80,
        observations=[
            PatternObservation(observation="Higher highs", supporting_data="8 consecutive bars")
        ],
        timeframe="1 month",
        no_pattern_rationale=None,
    )
    agent = PatternAgent(
        config=agent_configs.agents["technician"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=expected)
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    result = await agent.run(pattern_input_fixture, pattern_input_fixture.mission_id)

    assert result.pattern_type == PatternType.UPTREND
    assert len(result.observations) > 0
    assert chain.ainvoke.call_count == 1


@pytest.mark.asyncio
async def test_no_pattern_returned_for_unclear_history(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
) -> None:
    short_input = PatternInput(ticker="MSFT", mission_id=uuid4(), price_history=[])
    agent = PatternAgent(
        config=agent_configs.agents["technician"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )

    result = await agent.run(short_input, short_input.mission_id)

    assert result.pattern_type == PatternType.NO_PATTERN
    assert result.no_pattern_rationale == "Insufficient price history"


def test_pattern_report_has_no_investment_advice_fields() -> None:
    assert "recommendation" not in PatternReport.model_fields
    assert "action" not in PatternReport.model_fields
    assert "buy" not in PatternReport.model_fields
    assert "sell" not in PatternReport.model_fields
    assert "price_target" not in PatternReport.model_fields
