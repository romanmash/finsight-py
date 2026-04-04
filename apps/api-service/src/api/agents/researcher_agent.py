"""Researcher collector agent implementation."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

import structlog
from finsight.shared.models import (
    FundamentalsSnapshot,
    KnowledgeSnippet,
    NewsItem,
    OHLCVBar,
    ResearchPacket,
)
from pydantic import BaseModel

from api.db.repositories.agent_run import AgentRunRepository
from api.mcp.client import MCPClient, MCPToolError
from config.schemas.researcher import ResearcherConfig

logger = structlog.get_logger(__name__)


class ResearchInput(BaseModel):
    ticker: str
    mission_id: UUID


class ResearcherAgent:
    """Collect market/news/knowledge data and assemble ResearchPacket."""

    def __init__(
        self,
        agent_run_repo: AgentRunRepository,
        mcp_client: MCPClient,
        researcher_config: ResearcherConfig,
    ) -> None:
        self.agent_run_repo = agent_run_repo
        self.mcp_client = mcp_client
        self.researcher_config = researcher_config

    async def run(self, input_data: ResearchInput) -> ResearchPacket:
        started_at = datetime.now(UTC)

        ohlcv_task = self._call_tool(
            "market.get_ohlcv",
            {"symbol": input_data.ticker, "period": self.researcher_config.ohlcv_period},
        )
        fundamentals_task = self._call_tool(
            "market.get_fundamentals",
            {"symbol": input_data.ticker},
        )
        news_task = self._call_tool(
            "news.get_news",
            {"query": input_data.ticker, "limit": self.researcher_config.news_limit},
        )
        kb_task = self._call_tool(
            "knowledge.search_knowledge",
            {"query": input_data.ticker, "limit": self.researcher_config.kb_limit},
        )

        ohlcv_result, fundamentals_result, news_result, kb_result = await asyncio.gather(
            ohlcv_task,
            fundamentals_task,
            news_task,
            kb_task,
        )

        data_gaps: list[str] = []

        price_history = self._parse_ohlcv(ohlcv_result)
        if price_history is None:
            data_gaps.append("price_history: tool returned no data")

        fundamentals = self._parse_fundamentals(fundamentals_result)
        if fundamentals is None:
            data_gaps.append("fundamentals: tool returned no data")

        news_items = self._parse_news(news_result)
        if len(news_items) == 0:
            data_gaps.append("news_items: tool returned no data")

        kb_entries = self._parse_knowledge(kb_result)
        if len(kb_entries) == 0:
            data_gaps.append("kb_entries: tool returned no data")

        packet = ResearchPacket(
            ticker=input_data.ticker,
            mission_id=input_data.mission_id,
            price_history=price_history,
            fundamentals=fundamentals,
            news_items=news_items,
            kb_entries=kb_entries,
            data_gaps=data_gaps,
        )

        await self.agent_run_repo.create(
            {
                "mission_id": input_data.mission_id,
                "agent_name": "researcher",
                "status": "completed",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": Decimal("0.00"),
                "provider": None,
                "model": None,
                "duration_ms": self._duration_ms(started_at, datetime.now(UTC)),
                "input_snapshot": input_data.model_dump(mode="json"),
                "output_snapshot": packet.model_dump(mode="json"),
                "error_message": None,
                "started_at": started_at,
                "completed_at": datetime.now(UTC),
            }
        )

        return packet

    async def _call_tool(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any] | None:
        try:
            return await self.mcp_client.call_tool(tool_name, params)
        except MCPToolError as exc:
            logger.error("mcp_tool_error", tool=tool_name, detail=str(exc))
            return None

    def _parse_ohlcv(self, payload: dict[str, Any] | None) -> list[OHLCVBar] | None:
        if payload is None:
            return None
        raw = payload.get("items", payload.get("bars", []))
        if not isinstance(raw, list):
            return None
        parsed: list[OHLCVBar] = []
        for row in raw:
            if isinstance(row, dict):
                try:
                    parsed.append(OHLCVBar.model_validate(row))
                except Exception:
                    continue
        return parsed if parsed else None

    def _parse_fundamentals(self, payload: dict[str, Any] | None) -> FundamentalsSnapshot | None:
        if payload is None:
            return None
        raw = payload.get("item", payload)
        if not isinstance(raw, dict):
            return None
        try:
            return FundamentalsSnapshot.model_validate(raw)
        except Exception:
            return None

    def _parse_news(self, payload: dict[str, Any] | None) -> list[NewsItem]:
        if payload is None:
            return []
        raw = payload.get("items", payload.get("articles", payload.get("news", [])))
        if not isinstance(raw, list):
            return []
        parsed: list[NewsItem] = []
        for item in raw:
            if isinstance(item, dict):
                try:
                    parsed.append(NewsItem.model_validate(item))
                except Exception:
                    continue
        return parsed

    def _parse_knowledge(self, payload: dict[str, Any] | None) -> list[KnowledgeSnippet]:
        if payload is None:
            return []
        raw = payload.get("items", payload.get("results", []))
        if not isinstance(raw, list):
            return []
        parsed: list[KnowledgeSnippet] = []
        for item in raw:
            if isinstance(item, dict):
                try:
                    parsed.append(KnowledgeSnippet.model_validate(item))
                except Exception:
                    continue
        return parsed

    @staticmethod
    def _duration_ms(started_at: datetime, completed_at: datetime) -> int:
        return int((completed_at - started_at).total_seconds() * 1000)
