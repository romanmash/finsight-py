"""Runtime settings helpers for news-macro MCP server."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from config.schemas.mcp import McpConfig


@lru_cache(maxsize=1)
def load_mcp_config() -> McpConfig:
    path = Path("config/runtime/mcp.yaml")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return McpConfig.model_validate(raw)


def tool_ttl(tool_name: str) -> int:
    server = load_mcp_config().servers["news-macro"]
    if server.tools and tool_name in server.tools:
        return server.tools[tool_name].cache_ttl_seconds
    return server.cache_ttl_seconds
