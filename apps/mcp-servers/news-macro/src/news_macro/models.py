"""Pydantic models for news-macro MCP server."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ToolResponse[T](BaseModel):
    model_config = ConfigDict(frozen=True)

    data: T | None
    error: str | None = None
    cache_hit: bool = False
    latency_ms: int = 0


class NewsItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    headline: str
    source: str
    url: str | None
    published_at: datetime
    relevance_score: float | None
    summary: str | None


class SentimentData(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: str
    score: float
    label: Literal["bullish", "bearish", "neutral"]
    as_of: datetime


class MacroSignals(BaseModel):
    model_config = ConfigDict(frozen=True)

    market_sentiment: float
    volatility_regime: Literal["low", "medium", "high"]
    geopolitical_risk_index: float | None
    updated_at: datetime
