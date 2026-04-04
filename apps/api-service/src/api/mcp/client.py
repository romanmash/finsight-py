"""MCP client for routing tool calls across MCP servers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from config.schemas.mcp import McpConfig


@dataclass
class MCPToolError(Exception):
    """Error raised when MCP interaction fails."""

    tool_name: str
    detail: str

    def __str__(self) -> str:
        return f"{self.tool_name}: {self.detail}"


class MCPClient:
    """JSON-RPC client for MCP servers configured in mcp.yaml."""

    def __init__(self, configs: McpConfig) -> None:
        self._configs = configs
        self._manifest: dict[str, list[str]] = {}
        self._prefix_to_server = {
            "market.": "market-data",
            "news.": "news-macro",
            "sentiment.": "news-macro",
            "macro.": "news-macro",
            "knowledge.": "rag-retrieval",
            "search.": "rag-retrieval",
        }

    def _select_server(self, tool_name: str) -> str:
        for prefix, server_name in self._prefix_to_server.items():
            if tool_name.startswith(prefix):
                return server_name
        raise MCPToolError(tool_name=tool_name, detail="No server route for tool prefix")

    async def discover(self) -> dict[str, list[str]]:
        manifests: dict[str, list[str]] = {}
        for server_name, server in self._configs.servers.items():
            payload = {"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1}
            try:
                async with httpx.AsyncClient(timeout=server.timeout_seconds) as client:
                    response = await client.post(f"{server.url}/mcp/", json=payload)
                    response.raise_for_status()
                    body = response.json()
            except httpx.HTTPError as exc:
                raise MCPToolError(tool_name=f"{server_name}.discover", detail=str(exc)) from exc

            if not isinstance(body, dict) or "error" in body:
                raise MCPToolError(
                    tool_name=f"{server_name}.discover", detail="Invalid JSON-RPC response"
                )

            result = body.get("result", {})
            tools = result.get("tools", []) if isinstance(result, dict) else []
            manifests[server_name] = [str(tool) for tool in tools]

        self._manifest = manifests
        return manifests

    async def call_tool(self, tool_name: str, params: dict[str, Any]) -> dict[str, Any]:
        server_name = self._select_server(tool_name)
        server = self._configs.servers[server_name]
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": params},
            "id": 1,
        }
        try:
            async with httpx.AsyncClient(timeout=server.timeout_seconds) as client:
                response = await client.post(f"{server.url}/mcp/", json=payload)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPError as exc:
            raise MCPToolError(tool_name=tool_name, detail=str(exc)) from exc

        if not isinstance(body, dict):
            raise MCPToolError(tool_name=tool_name, detail="Invalid JSON-RPC response")
        if "error" in body:
            message = (
                body["error"].get("message", "Tool call failed")
                if isinstance(body["error"], dict)
                else str(body["error"])
            )
            raise MCPToolError(tool_name=tool_name, detail=message)
        result = body.get("result", {})
        return result if isinstance(result, dict) else {}
