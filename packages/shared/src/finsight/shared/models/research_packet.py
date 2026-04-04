"""Shared research packet models for collector agents."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OHLCVBar(BaseModel):
    model_config = ConfigDict(frozen=True)

    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class FundamentalsSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    market_cap: float | None = None
    pe_ratio: float | None = None
    eps: float | None = None
    revenue: float | None = None
    sector: str | None = None


class NewsItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    headline: str
    source: str | None = None
    url: str | None = None
    published_at: datetime | None = None
    relevance_score: float | None = None
    summary: str | None = None


class KnowledgeSnippet(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    content: str
    author_agent: str | None = None
    confidence: float | None = None
    tickers: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    similarity_score: float | None = None


class ResearchPacket(BaseModel):
    model_config = ConfigDict(frozen=True)

    ticker: str
    mission_id: UUID
    price_history: list[OHLCVBar] | None = None
    fundamentals: FundamentalsSnapshot | None = None
    news_items: list[NewsItem] = Field(default_factory=list)
    kb_entries: list[KnowledgeSnippet] = Field(default_factory=list)
    data_gaps: list[str] = Field(default_factory=list)
