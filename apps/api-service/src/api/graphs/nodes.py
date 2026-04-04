"""LangGraph node wrappers for orchestration agents."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from finsight.shared.models import PatternReport, PatternType

from api.agents.analyst_agent import AnalystAgent
from api.agents.bookkeeper_agent import BookkeeperAgent, BookkeeperInput
from api.agents.pattern_agent import PatternAgent, PatternInput
from api.agents.reporter_agent import ReporterAgent, ReporterInput
from api.agents.researcher_agent import ResearcherAgent, ResearchInput
from api.agents.watchdog_agent import WatchdogAgent
from api.graphs.state import GraphState


@dataclass(frozen=True)
class OrchestrationAgents:
    researcher: ResearcherAgent
    analyst: AnalystAgent
    technician: PatternAgent
    bookkeeper: BookkeeperAgent
    reporter: ReporterAgent
    watchdog: WatchdogAgent


def _append_completed(state: GraphState, node: str) -> list[str]:
    return [*state["completed_nodes"], node]


def _resolve_ticker(state: GraphState) -> str:
    explicit = state["ticker"]
    if explicit is not None and explicit.strip():
        return explicit
    # Conservative fallback: only accept explicit ticker marker from query.
    query = state["query"]
    marker = "$"
    marker_idx = query.find(marker)
    if marker_idx >= 0:
        suffix = query[marker_idx + 1 : marker_idx + 6]
        ticker = "".join(ch for ch in suffix if ch.isalpha()).upper()
        if 1 <= len(ticker) <= 5:
            return ticker
    return "SPY"


async def researcher_node(state: GraphState, agents: OrchestrationAgents) -> dict[str, Any]:
    ticker = _resolve_ticker(state)
    packet = await agents.researcher.run(
        ResearchInput(ticker=ticker, mission_id=state["mission_id"])
    )
    return {
        "research_packet": packet,
        "ticker": ticker,
        "completed_nodes": _append_completed(state, "researcher"),
    }


async def analyst_node(state: GraphState, agents: OrchestrationAgents) -> dict[str, Any]:
    research_packet = state["research_packet"]
    if research_packet is None:
        raise RuntimeError("research_packet_missing")
    assessment = await agents.analyst.run(research_packet, state["mission_id"])
    return {"assessment": assessment, "completed_nodes": _append_completed(state, "analyst")}


async def pattern_node(state: GraphState, agents: OrchestrationAgents) -> dict[str, Any]:
    research_packet = state["research_packet"]
    ticker = _resolve_ticker(state)
    if research_packet is None:
        raise RuntimeError("research_packet_missing")
    report = await agents.technician.run(
        PatternInput(
            ticker=ticker,
            price_history=research_packet.price_history or [],
            mission_id=state["mission_id"],
        ),
        state["mission_id"],
    )
    return {"pattern_report": report, "completed_nodes": _append_completed(state, "technician")}


async def bookkeeper_node(state: GraphState, agents: OrchestrationAgents) -> dict[str, Any]:
    assessment = state["assessment"]
    if assessment is None:
        raise RuntimeError("assessment_missing")
    ticker = _resolve_ticker(state)
    await agents.bookkeeper.run(
        BookkeeperInput(
            ticker=ticker,
            entry_type="assessment",
            content_summary=assessment.significance,
            source_agent="analyst",
            mission_id=state["mission_id"],
            confidence=assessment.confidence,
            tickers=[ticker],
            tags=["orchestration", "investigation"],
        ),
        state["mission_id"],
    )
    return {"completed_nodes": _append_completed(state, "bookkeeper")}


async def reporter_node(state: GraphState, agents: OrchestrationAgents) -> dict[str, Any]:
    assessment = state["assessment"]
    pattern_report = state["pattern_report"]
    ticker = _resolve_ticker(state)
    if assessment is None:
        raise RuntimeError("assessment_missing")
    if pattern_report is None:
        pattern_report = PatternReport(
            pattern_type=PatternType.NO_PATTERN,
            confidence=0.0,
            observations=[],
            timeframe="n/a",
            no_pattern_rationale="No technical pattern step in pipeline",
        )
    report = await agents.reporter.run(
        ReporterInput(
            assessment=assessment,
            pattern_report=pattern_report,
            ticker=ticker,
            mission_id=state["mission_id"],
        ),
        state["mission_id"],
    )
    return {"formatted_report": report, "completed_nodes": _append_completed(state, "reporter")}


async def watchdog_node(state: GraphState, agents: OrchestrationAgents) -> dict[str, Any]:
    await agents.watchdog.run(mission_id=state["mission_id"])
    return {"completed_nodes": _append_completed(state, "watchdog")}
