"""Scheduler runtime schema."""

from __future__ import annotations

from croniter import croniter
from pydantic import BaseModel, ConfigDict, field_validator


class SchedulerConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    screener_cron: str
    brief_cron: str
    earnings_lookback_days: int
    timezone: str

    @field_validator("screener_cron", "brief_cron")
    @classmethod
    def validate_cron(cls, value: str) -> str:
        if not croniter.is_valid(value):
            raise ValueError(f"invalid cron expression: {value}")
        return value
