"""Tests for ReporterAgent."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from api.agents.reporter_agent import ReporterAgent, ReporterInput
from api.lib.tracing import TracingClient
from finsight.shared.models import (
    Assessment,
    FormattedReport,
    PatternObservation,
    PatternReport,
    PatternType,
    ReportSection,
    RiskItem,
    ThesisImpact,
)


@pytest.fixture()
def reporter_input_fixture() -> ReporterInput:
    mission_id = uuid4()
    assessment = Assessment(
        significance="Macro trend remains supportive.",
        thesis_impact=ThesisImpact.SUPPORTS,
        thesis_rationale="Improving breadth and earnings revisions.",
        risks=[
            RiskItem(description="Inflation surprise", severity="medium"),
            RiskItem(description="Policy uncertainty", severity="medium"),
        ],
        confidence=0.74,
        data_limitations=[],
    )
    pattern = PatternReport(
        pattern_type=PatternType.CONSOLIDATION,
        pattern_name="Range",
        confidence=0.66,
        observations=[
            PatternObservation(observation="Price bounded", supporting_data="100-105 band")
        ],
        timeframe="1 month",
        no_pattern_rationale=None,
    )
    return ReporterInput(
        assessment=assessment,
        pattern_report=pattern,
        ticker="AAPL",
        mission_id=mission_id,
    )


@pytest.mark.asyncio
async def test_reporter_formats_all_key_points(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
    reporter_input_fixture: ReporterInput,
) -> None:
    expected = FormattedReport(
        title="AAPL Mission Summary",
        sections=[
            ReportSection(title="Assessment", content="Supportive with medium risks"),
            ReportSection(title="Technical Pattern", content="Consolidation range detected"),
        ],
        full_text="Assessment: Supportive with medium risks\nPattern: Consolidation range detected",
        ticker="AAPL",
        mission_id=reporter_input_fixture.mission_id,
        generated_at=datetime.now(UTC),
    )
    agent = ReporterAgent(
        config=agent_configs.agents["reporter"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=expected)
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    result = await agent.run(reporter_input_fixture, reporter_input_fixture.mission_id)

    assert result.title
    assert result.sections
    assert result.full_text
    assert len(result.full_text) <= 4096


@pytest.mark.asyncio
async def test_reporter_adds_no_new_analysis(
    mock_agent_run_repo: AsyncMock,
    mock_mcp_client: AsyncMock,
    pricing_registry: Any,
    session_mock: Any,
    agent_configs: Any,
    reporter_input_fixture: ReporterInput,
) -> None:
    expected = FormattedReport(
        title="AAPL Mission Summary",
        sections=[ReportSection(title="Assessment", content="Neutral")],
        full_text="Assessment: Neutral",
        ticker="AAPL",
        mission_id=reporter_input_fixture.mission_id,
        generated_at=datetime.now(UTC),
    )
    agent = ReporterAgent(
        config=agent_configs.agents["reporter"],
        session=session_mock,
        agent_run_repo=mock_agent_run_repo,
        mcp_client=mock_mcp_client,
        pricing=pricing_registry,
        tracer=MagicMock(spec=TracingClient),
    )

    chain = AsyncMock()
    chain.ainvoke = AsyncMock(return_value=expected)
    agent._build_chain = MagicMock(return_value=chain)  # type: ignore[method-assign]

    result = await agent.run(reporter_input_fixture, reporter_input_fixture.mission_id)

    assert "recommendation" not in FormattedReport.model_fields
    assert "analysis" not in FormattedReport.model_fields
    assert "conclusion" not in FormattedReport.model_fields
    assert "opinion" not in FormattedReport.model_fields
    assert "action" not in FormattedReport.model_fields
    assert "Neutral" in result.full_text
