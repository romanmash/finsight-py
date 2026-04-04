"""Shared Technician output models."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class PatternType(StrEnum):
    UPTREND = "uptrend"
    DOWNTREND = "downtrend"
    CONSOLIDATION = "consolidation"
    BREAKOUT = "breakout"
    REVERSAL = "reversal"
    ACCUMULATION = "accumulation"
    DISTRIBUTION = "distribution"
    NO_PATTERN = "no_pattern"


class PatternObservation(BaseModel):
    model_config = ConfigDict(frozen=True)

    observation: str = Field(min_length=1)
    supporting_data: str = Field(min_length=1)


class PatternReport(BaseModel):
    model_config = ConfigDict(frozen=True)

    pattern_type: PatternType
    pattern_name: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    observations: list[PatternObservation] = Field(default_factory=list)
    timeframe: str = Field(min_length=1)
    no_pattern_rationale: str | None = None
