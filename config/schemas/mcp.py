"""MCP runtime schema."""

from __future__ import annotations

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
        if value.scheme != "https":
            raise ValueError("MCP server URL must use https://")
        return value


class McpConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    servers: dict[str, McpServerConfig]
