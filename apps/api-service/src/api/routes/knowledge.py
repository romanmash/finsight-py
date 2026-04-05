"""Knowledge browser routes for dashboard."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.repositories.knowledge_entry import KnowledgeEntryRepository
from api.lib.db import get_session
from api.routes.dashboard_auth import DashboardViewerOrAdminOperator

router = APIRouter()


class KnowledgeEntryResponse(BaseModel):
    id: UUID
    ticker: str | None
    entry_type: str | None
    content_summary: str | None
    confidence: float
    freshness_at: datetime | None
    freshness_date: date | None
    source_type: str | None
    author_agent: str | None
    conflict_markers: list[str]
    tags: list[str]
    updated_at: datetime


class _KnowledgeEntryLike(Protocol):
    id: UUID
    ticker: str | None
    entry_type: str | None
    content_summary: str | None
    confidence: float
    freshness_at: datetime | None
    freshness_date: date | None
    source_type: str | None
    author_agent: str | None
    conflict_markers: list[str]
    tags: list[str]
    updated_at: datetime


def _serialize(entity: _KnowledgeEntryLike) -> KnowledgeEntryResponse:
    return KnowledgeEntryResponse(
        id=entity.id,
        ticker=entity.ticker,
        entry_type=entity.entry_type,
        content_summary=entity.content_summary,
        confidence=entity.confidence,
        freshness_at=entity.freshness_at,
        freshness_date=entity.freshness_date,
        source_type=entity.source_type,
        author_agent=entity.author_agent,
        conflict_markers=list(entity.conflict_markers),
        tags=list(entity.tags),
        updated_at=entity.updated_at,
    )


@router.get("")
async def list_knowledge(
    _: DashboardViewerOrAdminOperator,
    session: Annotated[AsyncSession, Depends(get_session)],
    query: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, object]:
    repo = KnowledgeEntryRepository(session)
    entries = await repo.search(query=query, limit=limit, offset=offset)
    return {
        "items": [_serialize(entry).model_dump(mode="json") for entry in entries],
        "limit": limit,
        "offset": offset,
    }
