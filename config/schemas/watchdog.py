"""Watchdog runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ThresholdDefaults(BaseModel):
    model_config = ConfigDict(frozen=True)

    price_change_pct: float = Field(gt=0)
    volume_spike_multiplier: float = Field(gt=0)
    rsi_overbought: float = Field(gt=0, le=100)


class WatchdogConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    poll_interval_seconds: int = Field(gt=0)
    alert_cooldown_seconds: int = Field(ge=0)
    news_spike_rate_per_hour: int = Field(default=5, gt=0)
    news_fetch_limit: int = Field(default=100, gt=0)
    dedup_window_hours: int = Field(default=4, gt=0)
    default_thresholds: ThresholdDefaults
