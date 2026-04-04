"""Pydantic models for rag-retrieval MCP server."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ToolResponse[T](BaseModel):
    model_config = ConfigDict(frozen=True)

    data: T | None
    error: str | None = None
    cache_hit: bool = False
    latency_ms: int = 0


class KnowledgeResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: UUID
    content: str
    source_type: str | None
    author_agent: str
    confidence: float
    tickers: list[str]
    tags: list[str]
    freshness_date: date | None
    similarity_score: float | None
