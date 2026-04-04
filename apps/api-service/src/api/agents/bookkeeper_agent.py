"""Bookkeeper deterministic knowledge writer."""

from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from finsight.shared.models import KnowledgeEntry, ProvenanceRecord
from pydantic import BaseModel, Field
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.knowledge_entry import KnowledgeEntryORM
from api.db.repositories.agent_run import AgentRunRepository
from api.lib.tracing import TracingClient


class BookkeeperInput(BaseModel):
    ticker: str
    entry_type: str
    content_summary: str
    source_agent: str
    mission_id: UUID
    confidence: float = Field(ge=0.0, le=1.0)
    freshness_date: date | None = None
    tickers: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class BookkeeperAgent:
    """Write or update curated knowledge entries without LLM calls."""

    def __init__(
        self,
        session: AsyncSession,
        agent_run_repo: AgentRunRepository,
        tracer: TracingClient,
    ) -> None:
        self._session = session
        self._agent_run_repo = agent_run_repo
        self._tracer = tracer

    async def run(self, input_data: BookkeeperInput, mission_id: UUID) -> KnowledgeEntry:
        started_at = datetime.now(UTC)
        run_id = self._tracer.create_run("bookkeeper", input_data.model_dump(mode="json"))

        content_hash = self._content_hash(
            ticker=input_data.ticker,
            entry_type=input_data.entry_type,
            content_summary=input_data.content_summary,
        )

        existing_by_hash = await self._get_by_hash(content_hash)
        existing_by_entity = await self._get_latest_by_entity(
            input_data.ticker,
            input_data.entry_type,
        )
        existing = existing_by_hash or existing_by_entity

        freshness_at = self._freshness_at(input_data.freshness_date)
        freshness_date = input_data.freshness_date or freshness_at.date()
        merged_tickers = self._normalized_tickers(input_data)
        merged_tags = self._normalized_tags(input_data)
        provenance_entry = ProvenanceRecord(
            source_agent=input_data.source_agent,
            mission_id=input_data.mission_id,
            confidence=input_data.confidence,
            freshness_at=freshness_at,
        )

        if existing is None:
            entity = KnowledgeEntryORM(
                ticker=input_data.ticker,
                entry_type=input_data.entry_type,
                content_summary=input_data.content_summary,
                content_hash=content_hash,
                content=input_data.content_summary,
                source_type=input_data.entry_type,
                author_agent="bookkeeper",
                confidence=input_data.confidence,
                tickers=merged_tickers,
                freshness_at=freshness_at,
                freshness_date=freshness_date,
                provenance_history=[provenance_entry.model_dump(mode="json")],
                conflict_markers=[],
                tags=merged_tags,
                embedding=None,
                deleted_at=None,
            )
            self._session.add(entity)
            await self._session.flush()
        else:
            conflicts = list(existing.conflict_markers)
            if self._is_conflict(existing.content_summary or "", existing.confidence, input_data):
                conflicts.append(
                    f"Conflict with entry {existing.id}: divergent content for {input_data.ticker}"
                )
            provenance = list(existing.provenance_history)
            provenance.append(provenance_entry.model_dump(mode="json"))
            existing.content_summary = input_data.content_summary
            existing.content_hash = content_hash
            existing.content = input_data.content_summary
            existing.source_type = input_data.entry_type
            existing.author_agent = "bookkeeper"
            existing.confidence = input_data.confidence
            existing.tickers = merged_tickers
            existing.freshness_at = freshness_at
            existing.freshness_date = freshness_date
            existing.provenance_history = provenance
            existing.conflict_markers = conflicts
            existing.tags = merged_tags
            existing.deleted_at = None
            entity = existing
            await self._session.flush()

        completed_at = datetime.now(UTC)
        await self._agent_run_repo.create(
            {
                "mission_id": mission_id,
                "agent_name": "bookkeeper",
                "status": "completed",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": Decimal("0.00"),
                "provider": None,
                "model": None,
                "duration_ms": self._duration_ms(started_at, completed_at),
                "input_snapshot": input_data.model_dump(mode="json"),
                "output_snapshot": self._serialize_entry(entity),
                "error_message": None,
                "started_at": started_at,
                "completed_at": completed_at,
            }
        )

        result = self._to_domain(entity)
        self._tracer.end_run(run_id, outputs=result.model_dump(mode="json"), error=None)
        return result

    async def _get_by_hash(self, content_hash: str) -> KnowledgeEntryORM | None:
        stmt = select(KnowledgeEntryORM).where(KnowledgeEntryORM.content_hash == content_hash)
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def _get_latest_by_entity(self, ticker: str, entry_type: str) -> KnowledgeEntryORM | None:
        stmt: Select[tuple[KnowledgeEntryORM]] = (
            select(KnowledgeEntryORM)
            .where(KnowledgeEntryORM.ticker == ticker, KnowledgeEntryORM.entry_type == entry_type)
            .order_by(KnowledgeEntryORM.updated_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    @staticmethod
    def _freshness_at(value: date | None) -> datetime:
        if value is None:
            return datetime.now(UTC)
        return datetime.combine(value, time.min, tzinfo=UTC)

    @staticmethod
    def _content_hash(ticker: str, entry_type: str, content_summary: str) -> str:
        source = f"{ticker}:{entry_type}:{content_summary}".encode()
        return hashlib.sha256(source).hexdigest()

    @staticmethod
    def _tokenize(content: str) -> set[str]:
        parts = [segment.strip().lower() for segment in content.split() if segment.strip()]
        return set(parts)

    def _is_conflict(
        self,
        existing_summary: str,
        existing_confidence: float,
        incoming: BookkeeperInput,
    ) -> bool:
        if existing_confidence <= 0.7 or incoming.confidence <= 0.7:
            return False
        existing_tokens = self._tokenize(existing_summary)
        incoming_tokens = self._tokenize(incoming.content_summary)
        if not existing_tokens and not incoming_tokens:
            return False
        overlap = len(existing_tokens & incoming_tokens)
        union = len(existing_tokens | incoming_tokens)
        similarity = (overlap / union) if union else 1.0
        return similarity < 0.5

    @staticmethod
    def _normalized_tickers(input_data: BookkeeperInput) -> list[str]:
        merged = list(dict.fromkeys([*input_data.tickers, input_data.ticker]))
        return [ticker for ticker in merged if ticker]

    @staticmethod
    def _normalized_tags(input_data: BookkeeperInput) -> list[str]:
        merged = list(dict.fromkeys([*input_data.tags, *input_data.tickers, input_data.ticker]))
        return [tag for tag in merged if tag]

    @staticmethod
    def _duration_ms(started_at: datetime, completed_at: datetime) -> int:
        return int((completed_at - started_at).total_seconds() * 1000)

    @staticmethod
    def _serialize_entry(entity: KnowledgeEntryORM) -> dict[str, Any]:
        freshness_at = entity.freshness_at
        return {
            "id": str(entity.id),
            "ticker": entity.ticker,
            "entry_type": entity.entry_type,
            "content_summary": entity.content_summary,
            "content_hash": entity.content_hash,
            "content": entity.content,
            "source_type": entity.source_type,
            "author_agent": entity.author_agent,
            "confidence": entity.confidence,
            "tickers": entity.tickers or [],
            "freshness_date": (
                entity.freshness_date.isoformat() if entity.freshness_date is not None else None
            ),
            "freshness_at": freshness_at.isoformat() if freshness_at is not None else None,
            "provenance_history": entity.provenance_history,
            "conflict_markers": entity.conflict_markers,
            "tags": entity.tags,
            "embedding": entity.embedding,
        }

    @staticmethod
    def _to_domain(entity: KnowledgeEntryORM) -> KnowledgeEntry:
        provenance: list[ProvenanceRecord] = []
        for item in entity.provenance_history:
            if isinstance(item, dict):
                provenance.append(ProvenanceRecord.model_validate(item))

        ticker = entity.ticker or "UNKNOWN"
        entry_type = entity.entry_type or "unknown"
        summary = entity.content_summary or entity.content or "[missing-content]"
        content_hash = entity.content_hash or BookkeeperAgent._content_hash(
            ticker=ticker,
            entry_type=entry_type,
            content_summary=summary,
        )

        freshness_at = entity.freshness_at
        if freshness_at is None:
            fallback_date = entity.freshness_date or datetime.now(UTC).date()
            freshness_at = datetime.combine(fallback_date, time.min, tzinfo=UTC)
        return KnowledgeEntry(
            ticker=ticker,
            entry_type=entry_type,
            content_summary=summary,
            content_hash=content_hash,
            confidence=entity.confidence,
            freshness_at=freshness_at,
            provenance_history=provenance,
            conflict_markers=list(entity.conflict_markers or []),
            tags=list(entity.tags or []),
            embedding=None if entity.embedding is None else [float(x) for x in entity.embedding],
        )
