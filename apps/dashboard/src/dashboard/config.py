"""Dashboard runtime config loader."""

from __future__ import annotations

from pathlib import Path
from typing import NoReturn

import yaml
from pydantic import BaseModel, Field, ValidationError


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


def _exit_config_error(path: Path, detail: str) -> NoReturn:
    raise SystemExit(f"{path.name}: {detail}")


def load_dashboard_config(path: Path = Path("config/runtime/dashboard.yaml")) -> DashboardConfig:
    """Load and validate dashboard runtime config from YAML."""
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        _exit_config_error(path, f"yaml parse error: {exc}")
    except OSError as exc:
        _exit_config_error(path, f"read error: {exc}")

    try:
        return DashboardConfig.model_validate(raw)
    except ValidationError as exc:
        first = exc.errors()[0]
        location = ".".join(str(part) for part in first.get("loc", ()))
        message = first.get("msg", "validation error")
        _exit_config_error(path, f"{location}: {message}")
