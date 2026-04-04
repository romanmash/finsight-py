"""Shared Bookkeeper models."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProvenanceRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_agent: str = Field(min_length=1)
    mission_id: UUID
    confidence: float = Field(ge=0.0, le=1.0)
    freshness_at: datetime
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class KnowledgeEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    ticker: str = Field(min_length=1, max_length=16)
    entry_type: str = Field(min_length=1, max_length=32)
    content_summary: str = Field(min_length=1)
    content_hash: str = Field(min_length=64, max_length=64)
    confidence: float = Field(ge=0.0, le=1.0)
    freshness_at: datetime
    provenance_history: list[ProvenanceRecord] = Field(default_factory=list)
    conflict_markers: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    embedding: list[float] | None = None
