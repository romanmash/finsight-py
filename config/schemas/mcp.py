"""MCP runtime schema."""

from __future__ import annotations

import os

from pydantic import AnyUrl, BaseModel, ConfigDict, field_validator


class ToolCacheConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    cache_ttl_seconds: int


class McpServerConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    url: AnyUrl
    timeout_seconds: int
    cache_ttl_seconds: int
    openbb_provider: str | None = None
    tools: dict[str, ToolCacheConfig] | None = None

    @field_validator("url")
    @classmethod
    def enforce_https_url(cls, value: AnyUrl) -> AnyUrl:
        scheme = value.scheme.lower()
        if scheme not in {"http", "https"}:
            raise ValueError("MCP server URL must use http:// or https://")

        environment = os.getenv("ENVIRONMENT", "dev").strip().lower()
        if scheme == "http" and environment in {"prod", "production"}:
            raise ValueError("MCP server URL must use https:// in production")
        return value


class McpConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    servers: dict[str, McpServerConfig]
