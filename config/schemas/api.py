"""API runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ApiConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    access_token_ttl_minutes: int
    refresh_token_ttl_days: int
    service_token_ttl_days: int = 3650
    cors_origins: list[str]
    rate_limit_login: str
    rate_limit_refresh: str
