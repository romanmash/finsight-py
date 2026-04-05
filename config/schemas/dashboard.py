"""Dashboard runtime config schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DashboardConfig(BaseModel):
    """Dashboard configuration loaded from YAML."""

    api_base_url: str = "http://api:8000"
    poll_interval_ms: int = Field(default=5000, ge=500, le=60000)
    mission_poll_interval_ms: int = Field(default=10000, ge=500, le=120000)
    auth_bypass_localhost: bool = True
    page_size_missions: int = Field(default=20, ge=1, le=100)
    page_size_kb: int = Field(default=25, ge=1, le=100)
    stale_threshold_seconds: int = Field(default=30, ge=5, le=600)
    touch_target_min_px: int = Field(default=48, ge=40, le=96)
