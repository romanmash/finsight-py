"""Tests for configuration loading and settings."""

from __future__ import annotations

from pathlib import Path

import pytest
from api.lib.config import get_settings, load_all_configs, load_yaml_config

from config.schemas.agents import AgentsConfig
from config.schemas.api import ApiConfig
from config.schemas.mcp import McpConfig
from config.schemas.pricing import ModelPricing, PricingConfig
from config.schemas.researcher import ResearcherConfig


def _write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def test_valid_config_loads(tmp_config_dir: Path) -> None:
    path = tmp_config_dir / "agents.yaml"
    _write(
        path,
        """
agents:
  manager:
    model: gpt-4o-mini
    provider: openai
    temperature: 0.2
    max_tokens: 2048
    max_retries: 2
    timeout_seconds: 30
    base_url: null
""".strip(),
    )

    config = load_yaml_config(path, AgentsConfig)
    assert config.agents["manager"].provider == "openai"


def test_invalid_yaml_type_exits(tmp_config_dir: Path) -> None:
    path = tmp_config_dir / "agents.yaml"
    _write(
        path,
        """
agents:
  manager:
    model: gpt-4o-mini
    provider: openai
    temperature: hot
    max_tokens: 2048
    max_retries: 2
    timeout_seconds: 30
    base_url: null
""".strip(),
    )

    with pytest.raises(SystemExit) as exc:
        load_yaml_config(path, AgentsConfig)

    message = str(exc.value)
    assert "agents.yaml" in message
    assert "temperature" in message
    assert "valid number" in message


def test_missing_required_field_exits(tmp_config_dir: Path) -> None:
    path = tmp_config_dir / "agents.yaml"
    _write(
        path,
        """
agents:
  manager:
    model: gpt-4o-mini
    provider: openai
    temperature: 0.2
    max_tokens: 2048
    max_retries: 2
    base_url: null
""".strip(),
    )

    with pytest.raises(SystemExit) as exc:
        load_yaml_config(path, AgentsConfig)

    message = str(exc.value)
    assert "agents.yaml" in message
    assert "timeout_seconds" in message
    assert "Field required" in message


def test_unparseable_yaml_exits(tmp_config_dir: Path) -> None:
    path = tmp_config_dir / "agents.yaml"
    _write(path, "agents: [bad")

    with pytest.raises(SystemExit) as exc:
        load_yaml_config(path, AgentsConfig)

    message = str(exc.value)
    assert "agents.yaml" in message
    assert "yaml parse error" in message


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://x:y@localhost:5432/finsight")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SECRET_KEY", "secret-key")
    monkeypatch.setenv("ENVIRONMENT", "test")

    settings = get_settings()

    assert settings.environment == "test"
    assert settings.secret_key == "secret-key"


def test_extra_env_vars_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://x:y@localhost:5432/finsight")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SECRET_KEY", "secret-key")
    monkeypatch.setenv("UNUSED_EXTRA_VAR", "ignored")

    settings = get_settings()

    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_unknown_pricing_model_returns_zero() -> None:
    pricing = PricingConfig(
        models={"openai/gpt-4o": ModelPricing(input_cost_per_1k=0.005, output_cost_per_1k=0.015)}
    )

    assert pricing.get_cost("openai", "does-not-exist") == (0.0, 0.0)


def test_load_all_configs_includes_api(tmp_config_dir: Path) -> None:
    _write(
        tmp_config_dir / "agents.yaml",
        """
agents:
  manager:
    model: gpt-4o-mini
    provider: openai
    temperature: 0.2
    max_tokens: 2048
    max_retries: 2
    timeout_seconds: 30
    base_url: null
""".strip(),
    )
    _write(
        tmp_config_dir / "mcp.yaml",
        """
servers:
  market-data:
    url: https://market-data-mcp:8001
    timeout_seconds: 5
    cache_ttl_seconds: 60
""".strip(),
    )
    _write(
        tmp_config_dir / "pricing.yaml",
        """
models:
  openai/gpt-4o:
    input_cost_per_1k: 0.005
    output_cost_per_1k: 0.015
""".strip(),
    )
    _write(
        tmp_config_dir / "watchdog.yaml",
        """
poll_interval_seconds: 30
alert_cooldown_seconds: 300
default_thresholds:
  price_change_pct: 2.0
  volume_spike_multiplier: 2.5
  rsi_overbought: 70.0
""".strip(),
    )
    _write(
        tmp_config_dir / "scheduler.yaml",
        """
screener_cron: "0 7 * * 1-5"
brief_cron: "0 6 * * *"
earnings_lookback_days: 3
timezone: "Europe/Copenhagen"
""".strip(),
    )
    _write(
        tmp_config_dir / "api.yaml",
        """
access_token_ttl_minutes: 15
refresh_token_ttl_days: 30
service_token_ttl_days: 3650
cors_origins:
  - http://localhost:8050
rate_limit_login: "10/minute"
rate_limit_refresh: "30/minute"
""".strip(),
    )
    _write(
        tmp_config_dir / "researcher.yaml",
        """
ohlcv_period: 1mo
news_limit: 10
kb_limit: 5
""".strip(),
    )

    configs = load_all_configs(tmp_config_dir)
    assert isinstance(configs.api, ApiConfig)
    assert isinstance(configs.researcher, ResearcherConfig)


def test_mcp_config_rejects_http_url(tmp_config_dir: Path) -> None:
    path = tmp_config_dir / "mcp.yaml"
    _write(
        path,
        """
servers:
  market-data:
    url: http://market-data-mcp:8001
    timeout_seconds: 5
    cache_ttl_seconds: 60
""".strip(),
    )

    with pytest.raises(SystemExit) as exc:
        load_yaml_config(path, McpConfig)

    assert "MCP server URL must use https://" in str(exc.value)
