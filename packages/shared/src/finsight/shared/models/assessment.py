"""Shared Analyst output models."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ThesisImpact(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    NEUTRAL = "neutral"


class RiskItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    description: str = Field(min_length=1)
    severity: Literal["low", "medium", "high"]


class Assessment(BaseModel):
    model_config = ConfigDict(frozen=True)

    significance: str = Field(min_length=1)
    thesis_impact: ThesisImpact
    thesis_rationale: str = Field(min_length=1)
    risks: list[RiskItem] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    data_limitations: list[str] = Field(default_factory=list)
