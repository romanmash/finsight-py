"""Researcher runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ResearcherConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    ohlcv_period: str = Field(min_length=1)
    news_limit: int = Field(gt=0)
    kb_limit: int = Field(gt=0)
