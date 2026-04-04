"""MCP runtime schema."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class McpServerConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    url: str
    timeout_seconds: int
    cache_ttl_seconds: int


class McpConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    servers: dict[str, McpServerConfig]
