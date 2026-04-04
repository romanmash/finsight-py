"""Application settings and runtime config loading."""

from __future__ import annotations

import functools
from dataclasses import dataclass
from pathlib import Path
from typing import NoReturn

import yaml
from pydantic import BaseModel, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from config.schemas.agents import AgentsConfig
from config.schemas.api import ApiConfig
from config.schemas.mcp import McpConfig
from config.schemas.pricing import PricingConfig
from config.schemas.scheduler import SchedulerConfig
from config.schemas.watchdog import WatchdogConfig


class Settings(BaseSettings):
    """Environment-driven settings loaded from .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    finnhub_api_key: str | None = None
    telegram_bot_token: str | None = None
    secret_key: str
    environment: str = "dev"
    log_level: str = "INFO"
    langchain_tracing_v2: bool = False
    langchain_api_key: str | None = None


@dataclass(frozen=True)
class AllConfigs:
    """Loaded YAML runtime configuration set."""

    agents: AgentsConfig
    mcp: McpConfig
    pricing: PricingConfig
    watchdog: WatchdogConfig
    scheduler: SchedulerConfig
    api: ApiConfig


def _exit_config_error(path: Path, detail: str) -> NoReturn:
    raise SystemExit(f"{path.name}: {detail}")


def load_yaml_config[T: BaseModel](path: Path, model: type[T]) -> T:
    """Load one YAML file and validate against a Pydantic model."""
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        _exit_config_error(path, f"yaml parse error: {exc}")
    except OSError as exc:
        _exit_config_error(path, f"read error: {exc}")

    try:
        return model.model_validate(raw)
    except ValidationError as exc:
        first = exc.errors()[0]
        location = ".".join(str(part) for part in first.get("loc", ()))
        message = first.get("msg", "validation error")
        _exit_config_error(path, f"{location}: {message}")


def load_all_configs(config_dir: Path = Path("config/runtime")) -> AllConfigs:
    """Load all foundational YAML config files for startup."""
    return AllConfigs(
        agents=load_yaml_config(config_dir / "agents.yaml", AgentsConfig),
        mcp=load_yaml_config(config_dir / "mcp.yaml", McpConfig),
        pricing=load_yaml_config(config_dir / "pricing.yaml", PricingConfig),
        watchdog=load_yaml_config(config_dir / "watchdog.yaml", WatchdogConfig),
        scheduler=load_yaml_config(config_dir / "scheduler.yaml", SchedulerConfig),
        api=load_yaml_config(config_dir / "api.yaml", ApiConfig),
    )


@functools.lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()  # type: ignore[call-arg]
