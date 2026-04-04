"""MCP runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ToolCacheConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    cache_ttl_seconds: int


class McpServerConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    url: str
    timeout_seconds: int
    cache_ttl_seconds: int
    openbb_provider: str | None = None
    tools: dict[str, ToolCacheConfig] | None = None


class McpConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    servers: dict[str, McpServerConfig]
