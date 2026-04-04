"""Tests for MCPClient."""

from __future__ import annotations

import httpx
import pytest
import respx
from api.mcp.client import MCPClient, MCPToolError

from config.schemas.mcp import McpConfig


def _config() -> McpConfig:
    return McpConfig.model_validate(
        {
            "servers": {
                "market-data": {
                    "url": "https://market-data-mcp:8001",
                    "timeout_seconds": 5,
                    "cache_ttl_seconds": 60,
                },
                "news-macro": {
                    "url": "https://news-macro-mcp:8002",
                    "timeout_seconds": 5,
                    "cache_ttl_seconds": 60,
                },
                "rag-retrieval": {
                    "url": "https://rag-retrieval-mcp:8003",
                    "timeout_seconds": 5,
                    "cache_ttl_seconds": 60,
                },
            }
        }
    )


@pytest.mark.asyncio
async def test_call_tool_routes_to_correct_server() -> None:
    client = MCPClient(_config())
    with respx.mock(assert_all_mocked=True) as router:
        market_route = router.post("https://market-data-mcp:8001/mcp/").respond(
            200, json={"jsonrpc": "2.0", "result": {"ok": True}, "id": 1}
        )
        news_route = router.post("https://news-macro-mcp:8002/mcp/").respond(
            200, json={"jsonrpc": "2.0", "result": {"ok": True}, "id": 1}
        )
        await client.call_tool("market.get_price", {"symbol": "AAPL"})
        await client.call_tool("news.get_news", {"query": "AAPL"})
        assert market_route.called
        assert news_route.called


@pytest.mark.asyncio
async def test_call_tool_success() -> None:
    client = MCPClient(_config())
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://market-data-mcp:8001/mcp/").respond(
            200, json={"jsonrpc": "2.0", "result": {"data": {"x": 1}}, "id": 1}
        )
        result = await client.call_tool("market.get_price", {"symbol": "AAPL"})
        assert result["data"]["x"] == 1


@pytest.mark.asyncio
async def test_call_tool_timeout() -> None:
    client = MCPClient(_config())
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://market-data-mcp:8001/mcp/").mock(
            side_effect=httpx.ConnectTimeout("timeout")
        )
        with pytest.raises(MCPToolError):
            await client.call_tool("market.get_price", {"symbol": "AAPL"})


@pytest.mark.asyncio
async def test_call_tool_jsonrpc_error() -> None:
    client = MCPClient(_config())
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://market-data-mcp:8001/mcp/").respond(
            200, json={"jsonrpc": "2.0", "error": {"code": -1, "message": "tool failed"}, "id": 1}
        )
        with pytest.raises(MCPToolError):
            await client.call_tool("market.get_price", {"symbol": "AAPL"})


@pytest.mark.asyncio
async def test_discover_caches_manifest() -> None:
    client = MCPClient(_config())
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://market-data-mcp:8001/mcp/").respond(
            200, json={"jsonrpc": "2.0", "result": {"tools": ["market.get_price"]}, "id": 1}
        )
        router.post("https://news-macro-mcp:8002/mcp/").respond(
            200, json={"jsonrpc": "2.0", "result": {"tools": ["news.get_news"]}, "id": 1}
        )
        router.post("https://rag-retrieval-mcp:8003/mcp/").respond(
            200,
            json={"jsonrpc": "2.0", "result": {"tools": ["knowledge.search_knowledge"]}, "id": 1},
        )
        manifest = await client.discover()
        assert "market-data" in manifest
        assert manifest["news-macro"] == ["news.get_news"]


@pytest.mark.asyncio
async def test_discover_server_unreachable() -> None:
    client = MCPClient(_config())
    with respx.mock(assert_all_mocked=True) as router:
        router.post("https://market-data-mcp:8001/mcp/").mock(
            side_effect=httpx.ConnectError("down")
        )
        with pytest.raises(MCPToolError):
            await client.discover()



