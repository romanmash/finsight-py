"""Watchdog runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ThresholdDefaults(BaseModel):
    model_config = ConfigDict(frozen=True)

    price_change_pct: float
    volume_spike_multiplier: float
    rsi_overbought: float


class WatchdogConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    poll_interval_seconds: int
    alert_cooldown_seconds: int
    default_thresholds: ThresholdDefaults
