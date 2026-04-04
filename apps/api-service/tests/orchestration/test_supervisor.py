"""Routing tests for the LangGraph supervisor."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from api.agents.manager_agent import PipelineClassification
from api.graphs.nodes import OrchestrationAgents
from api.graphs.supervisor import build_supervisor_graph
from finsight.shared.models import (
    Assessment,
    FormattedReport,
    PatternReport,
    PatternType,
    ReportSection,
    ResearchPacket,
    RiskItem,
    ThesisImpact,
)


def _assessment() -> Assessment:
    return Assessment(
        significance="Test significance",
        thesis_impact=ThesisImpact.NEUTRAL,
        thesis_rationale="Test rationale",
        risks=[RiskItem(description="Test risk", severity="medium")],
        confidence=0.7,
        data_limitations=[],
    )


def _pattern() -> PatternReport:
    return PatternReport(
        pattern_type=PatternType.NO_PATTERN,
        confidence=0.0,
        observations=[],
        timeframe="n/a",
        no_pattern_rationale="n/a",
    )


def _report(mission_id) -> FormattedReport:
    return FormattedReport(
        title="Mission report",
        sections=[ReportSection(title="Summary", content="Done")],
        full_text="Done",
        ticker="AAPL",
        mission_id=mission_id,
        generated_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_supervisor_investigation_pipeline_order(checkpointer: object) -> None:
    mission_id = uuid4()
    manager = AsyncMock()
    manager.run = AsyncMock(
        return_value=PipelineClassification(
            pipeline_type="investigation",
            ticker="AAPL",
            confidence=0.9,
        )
    )

    researcher = AsyncMock()
    researcher.run = AsyncMock(
        return_value=ResearchPacket(
            ticker="AAPL",
            mission_id=mission_id,
            price_history=[],
            fundamentals=None,
            news_items=[],
            kb_entries=[],
            data_gaps=[],
        )
    )
    analyst = AsyncMock()
    analyst.run = AsyncMock(return_value=_assessment())
    technician = AsyncMock()
    technician.run = AsyncMock(return_value=_pattern())
    bookkeeper = AsyncMock()
    bookkeeper.run = AsyncMock(return_value=AsyncMock())
    reporter = AsyncMock()
    reporter.run = AsyncMock(return_value=_report(mission_id))
    watchdog = AsyncMock()
    watchdog.run = AsyncMock()

    graph = build_supervisor_graph(
        checkpointer=checkpointer,
        manager=manager,
        agents=OrchestrationAgents(
            researcher=researcher,
            analyst=analyst,
            technician=technician,
            bookkeeper=bookkeeper,
            reporter=reporter,
            watchdog=watchdog,
        ),
    )
    result = await graph.ainvoke(
        {
            "mission_id": mission_id,
            "query": "analyze AAPL",
            "pipeline_type": "unknown",
            "ticker": None,
            "research_packet": None,
            "assessment": None,
            "pattern_report": None,
            "formatted_report": None,
            "error": None,
            "completed_nodes": [],
        },
        config={"configurable": {"thread_id": str(mission_id)}},
    )

    assert result["completed_nodes"] == [
        "researcher",
        "analyst",
        "technician",
        "bookkeeper",
        "reporter",
    ]
    assert manager.run.await_count == 1


@pytest.mark.asyncio
async def test_supervisor_daily_brief_pipeline_order(checkpointer: object) -> None:
    mission_id = uuid4()
    manager = AsyncMock()
    manager.run = AsyncMock(
        return_value=PipelineClassification(
            pipeline_type="daily_brief",
            ticker=None,
            confidence=0.9,
        )
    )

    researcher = AsyncMock()
    researcher.run = AsyncMock(
        return_value=ResearchPacket(
            ticker="SPY",
            mission_id=mission_id,
            price_history=[],
            fundamentals=None,
            news_items=[],
            kb_entries=[],
            data_gaps=[],
        )
    )
    analyst = AsyncMock()
    analyst.run = AsyncMock(return_value=_assessment())
    technician = AsyncMock()
    technician.run = AsyncMock(return_value=_pattern())
    bookkeeper = AsyncMock()
    bookkeeper.run = AsyncMock(return_value=AsyncMock())
    reporter = AsyncMock()
    reporter.run = AsyncMock(return_value=_report(mission_id))
    watchdog = AsyncMock()
    watchdog.run = AsyncMock()

    graph = build_supervisor_graph(
        checkpointer=checkpointer,
        manager=manager,
        agents=OrchestrationAgents(
            researcher=researcher,
            analyst=analyst,
            technician=technician,
            bookkeeper=bookkeeper,
            reporter=reporter,
            watchdog=watchdog,
        ),
    )
    result = await graph.ainvoke(
        {
            "mission_id": mission_id,
            "query": "morning brief",
            "pipeline_type": "unknown",
            "ticker": None,
            "research_packet": None,
            "assessment": None,
            "pattern_report": None,
            "formatted_report": None,
            "error": None,
            "completed_nodes": [],
        },
        config={"configurable": {"thread_id": str(mission_id)}},
    )

    assert result["completed_nodes"] == ["researcher", "analyst", "reporter"]
    assert manager.run.await_count == 1


@pytest.mark.asyncio
async def test_supervisor_checkpointer_persists_completed_state(checkpointer: object) -> None:
    mission_id = uuid4()
    manager = AsyncMock()
    manager.run = AsyncMock(
        return_value=PipelineClassification(
            pipeline_type="investigation",
            ticker="AAPL",
            confidence=0.9,
        )
    )

    researcher = AsyncMock()
    researcher.run = AsyncMock(
        return_value=ResearchPacket(
            ticker="AAPL",
            mission_id=mission_id,
            price_history=[],
            fundamentals=None,
            news_items=[],
            kb_entries=[],
            data_gaps=[],
        )
    )
    analyst = AsyncMock()
    analyst.run = AsyncMock(return_value=_assessment())
    technician = AsyncMock()
    technician.run = AsyncMock(return_value=_pattern())
    bookkeeper = AsyncMock()
    bookkeeper.run = AsyncMock(return_value=AsyncMock())
    reporter = AsyncMock()
    reporter.run = AsyncMock(return_value=_report(mission_id))
    watchdog = AsyncMock()
    watchdog.run = AsyncMock()

    graph = build_supervisor_graph(
        checkpointer=checkpointer,
        manager=manager,
        agents=OrchestrationAgents(
            researcher=researcher,
            analyst=analyst,
            technician=technician,
            bookkeeper=bookkeeper,
            reporter=reporter,
            watchdog=watchdog,
        ),
    )
    config = {"configurable": {"thread_id": str(mission_id)}}

    await graph.ainvoke(
        {
            "mission_id": mission_id,
            "query": "analyze AAPL",
            "pipeline_type": "unknown",
            "ticker": None,
            "research_packet": None,
            "assessment": None,
            "pattern_report": None,
            "formatted_report": None,
            "error": None,
            "completed_nodes": [],
        },
        config=config,
    )

    snapshot = graph.get_state(config)
    persisted = snapshot.values
    assert persisted["completed_nodes"] == [
        "researcher",
        "analyst",
        "technician",
        "bookkeeper",
        "reporter",
    ]
