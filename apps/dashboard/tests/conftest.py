"""Dashboard test fixtures."""

from __future__ import annotations

import pytest
from dashboard.config import DashboardConfig


@pytest.fixture()
def dashboard_config() -> DashboardConfig:
    return DashboardConfig.model_validate(
        {
            "api_base_url": "http://api.test",
            "poll_interval_ms": 5000,
            "mission_poll_interval_ms": 10000,
            "auth_bypass_localhost": True,
            "page_size_missions": 20,
            "page_size_kb": 25,
            "stale_threshold_seconds": 30,
            "touch_target_min_px": 48,
        }
    )


@pytest.fixture()
def api_base_url() -> str:
    return "http://api.test"

