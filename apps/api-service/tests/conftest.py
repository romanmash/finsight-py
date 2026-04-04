"""Shared pytest fixtures for config tests."""

from __future__ import annotations

import shutil
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest


@pytest.fixture()
def tmp_config_dir() -> Iterator[Path]:
    """Return a writable temporary config directory path inside repository."""
    base = Path(".cache/tests")
    base.mkdir(parents=True, exist_ok=True)
    temp_dir = base / f"config-{uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)
    try:
        yield temp_dir
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture()
def mock_env(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Provide monkeypatch fixture alias for env vars."""
    return monkeypatch


@pytest.fixture()
def agents_yaml_fixture() -> dict[str, object]:
    return {
        "agents": {
            "manager": {
                "model": "gpt-4o-mini",
                "provider": "openai",
                "temperature": 0.2,
                "max_tokens": 2048,
                "max_retries": 2,
                "timeout_seconds": 30,
                "base_url": None,
            }
        }
    }


@pytest.fixture()
def mcp_yaml_fixture() -> dict[str, object]:
    return {
        "servers": {
            "market-data": {
                "url": "https://market-data-mcp:8001",
                "timeout_seconds": 10,
                "cache_ttl_seconds": 300,
            }
        }
    }


@pytest.fixture()
def pricing_yaml_fixture() -> dict[str, object]:
    return {
        "models": {
            "openai/gpt-4o": {
                "input_cost_per_1k": 0.005,
                "output_cost_per_1k": 0.015,
            }
        }
    }


@pytest.fixture()
def watchdog_yaml_fixture() -> dict[str, object]:
    return {
        "poll_interval_seconds": 60,
        "alert_cooldown_seconds": 900,
        "default_thresholds": {
            "price_change_pct": 3.0,
            "volume_spike_multiplier": 2.0,
            "rsi_overbought": 70.0,
        },
    }


@pytest.fixture()
def scheduler_yaml_fixture() -> dict[str, object]:
    return {
        "screener_cron": "*/15 * * * *",
        "brief_cron": "0 8 * * 1-5",
        "earnings_lookback_days": 7,
        "timezone": "Europe/Copenhagen",
    }
