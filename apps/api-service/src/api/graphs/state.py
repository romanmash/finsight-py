"""LangGraph state model for orchestration."""

from __future__ import annotations

from typing import TypedDict
from uuid import UUID

from finsight.shared.models import Assessment, FormattedReport, PatternReport, ResearchPacket


class GraphState(TypedDict):
    mission_id: UUID
    query: str
    pipeline_type: str
    ticker: str | None
    research_packet: ResearchPacket | None
    assessment: Assessment | None
    pattern_report: PatternReport | None
    formatted_report: FormattedReport | None
    error: str | None
    completed_nodes: list[str]
