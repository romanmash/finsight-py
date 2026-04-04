# Implementation Plan: MCP Platform

**Branch**: `004-mcp-platform` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Build three independent FastMCP servers (market-data, news-macro, rag-retrieval), each with its
own tool registry, Redis-backed response caching (TTLs from mcp.yaml), typed Pydantic response
models, health endpoint, and fail-fast startup. Add an MCP client in apps/api-service that routes tool
calls to the correct server by name. All tools are testable offline via respx HTTP mocking.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: fastmcp>=0.4, openbb>=4.0, openbb-yfinance, finnhub-python, httpx, redis[hiredis], respx
**Storage**: Redis 7 (response cache) + PostgreSQL/pgvector (rag-retrieval reads KnowledgeEntry)
**Testing**: pytest + pytest-asyncio + respx (offline HTTP mocking)
**Target Platform**: Linux server (Docker) — 3 separate containers
**Project Type**: 3 independent FastMCP microservices + API MCP client
**Performance Goals**: Cached tool response < 20 ms; uncached market data < 3 s; RAG search < 500 ms
**Constraints**: mypy --strict; ruff zero warnings; tests offline; servers must NOT import from apps/api-service
**Scale/Scope**: 3 servers, ~12 tools total, Redis TTL cache per tool

## Constitution Check

- [x] Everything-as-Code — tool cache TTLs, server URLs, provider config in config/runtime/mcp.yaml
- [x] Agent Boundaries — N/A (MCP servers are tool providers, not agents)
- [x] MCP Server Independence — each server is a separate Python package; zero cross-imports
- [x] Cost Observability — N/A (MCP servers make no LLM calls)
- [x] Fail-Safe Defaults — fail-fast if Redis or required provider unavailable at startup
- [x] Test-First — all tools tested offline with respx-mocked external HTTP
- [x] Simplicity Over Cleverness — FastMCP auto-generates tool manifest from typed functions

## Project Structure

### Source Code

```text
apps/mcp-servers/market-data/src/market_data/
├── __init__.py
├── server.py            # FastMCP app + startup health check
├── cache.py             # Redis cache helpers (get/set with TTL)
└── tools/
    ├── price.py         # get_price(symbol) → PriceData
    ├── history.py       # get_ohlcv(symbol, period) → OHLCVData
    ├── fundamentals.py  # get_fundamentals(symbol) → FundamentalsData
    ├── etf.py           # get_etf_holdings(symbol) → ETFData
    └── options.py       # get_options_chain(symbol) → OptionsData

apps/mcp-servers/news-macro/src/news_macro/
├── __init__.py
├── server.py
├── cache.py
└── tools/
    ├── news.py          # get_news(query, limit) → list[NewsItem]
    ├── sentiment.py     # get_sentiment(symbol) → SentimentData
    └── macro.py         # get_macro_signals() → MacroSignals

apps/mcp-servers/rag-retrieval/src/rag_retrieval/
├── __init__.py
├── server.py
├── cache.py
└── tools/
    ├── search.py        # search_knowledge(query, limit, filters) → list[KnowledgeResult]
    └── retrieve.py      # get_knowledge_entry(id) → KnowledgeResult

apps/api-service/src/api/mcp/
├── __init__.py
└── client.py            # MCPClient: tool routing, typed responses, timeout handling

config/runtime/mcp.yaml  # server URLs, cache TTLs per tool
config/schemas/mcp.py    # Pydantic v2 schema

apps/mcp-servers/market-data/tests/test_tools.py
apps/mcp-servers/news-macro/tests/test_tools.py
apps/mcp-servers/rag-retrieval/tests/test_tools.py
apps/api-service/tests/mcp/test_client.py
```

## Implementation Phases

### Phase 1: Config + Shared Cache Helper

**Files**: `config/runtime/mcp.yaml`, `config/schemas/mcp.py`, `cache.py` in each server

**Key decisions**:
- `mcp.yaml` structure: `servers.{name}.url`, optional `servers.{name}.tools.{tool_name}.cache_ttl_seconds`
- Cache key: `f"{server_name}:{tool_name}:{hashlib.sha256(json.dumps(params)).hexdigest()[:16]}"`
- Cache miss → fetch → cache result as JSON → return

### Phase 2: Market Data Server

**Files**: `apps/mcp-servers/market-data/src/market_data/`

**Key decisions**:
- **OpenBB provider**: OpenBB provider selection remains config-driven (`openbb_provider` in
  `mcp.yaml`), but tool implementations call provider HTTP endpoints via `httpx.AsyncClient` so
  `respx` can fully mock offline tests.
- Default provider for development is `yfinance`; production can switch provider via YAML only.
- Tool functions are `@mcp.tool()` decorated async functions with typed Pydantic return types
- `ToolResponse[T]` envelope: `{"data": T, "error": str | None, "cache_hit": bool, "latency_ms": int}`

### Phase 3: News + Macro Server

**Files**: `apps/mcp-servers/news-macro/src/news_macro/`

**Key decisions**:
- Finnhub client for news and sentiment; GDELT API for macro signals
- All external HTTP via httpx (allows respx mocking in tests)

### Phase 4: RAG Retrieval Server

**Files**: `apps/mcp-servers/rag-retrieval/src/rag_retrieval/`

**Key decisions**:
- Connects to the shared PostgreSQL + pgvector database (read-only)
- Uses SQLAlchemy async + `<=>` vector operator for similarity search
- Never writes to knowledge base (constitution: only Bookkeeper writes)

### Phase 5: MCP Client

**Files**: `apps/api-service/src/api/mcp/client.py`

**Key decisions**:
- **Transport protocol**: FastMCP servers are accessed via HTTP (not stdio). Each server is a
  standalone ASGI app served by uvicorn and exposes FastMCP's streamable-HTTP transport at
  `POST /mcp/` (FastMCP ≥2.0 default). The MCP client sends JSON-RPC 2.0 messages to this
  endpoint using `httpx.AsyncClient`.
- **Tool routing**: `MCPClient` holds a mapping of tool-name prefixes to base URLs loaded from
  `mcp.yaml` (e.g. `market.*` → `http://market-data-mcp:8001`). `call_tool(tool_name, params)`
  selects the correct server, constructs a `{"method": "tools/call", "params": {...}}` JSON-RPC
  payload, and POSTs it.
- **Tool discovery**: On startup, `MCPClient.discover()` calls `GET /mcp/` (or equivalent
  `tools/list` JSON-RPC call) on each server and caches the tool manifests. This enables
  fail-fast if a server is unreachable.
- Timeout loaded from `mcp.yaml`; raises `MCPToolError` on connection failure, timeout, or
  JSON-RPC error response.

### Phase 6: Tests

- respx mocks all external HTTP (OpenBB, Finnhub, GDELT)
- Cache hit/miss tested with fakeredis
- MCPClient timeout tested with respx raising `httpx.ConnectTimeout` on `POST /mcp/`
- MCPClient tool routing tested: assert correct base URL selected per tool name prefix
- MCPClient discovery tested: respx returns `tools/list` JSON-RPC response; verify manifest cached

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MCP transport | FastMCP HTTP (streamable-HTTP at POST /mcp/) | Containerised services; testable with respx |
| External HTTP in MCP servers | httpx (not SDK clients directly) | Allows respx mocking for offline tests |
| Tool response envelope | ToolResponse[T] Pydantic generic | Consistent shape; cache_hit flag; typed |
| Server independence | Separate pyproject.toml per server | Constitution: no cross-imports |
| Cache backend | Redis via redis-py asyncio | Same instance used by API; configurable TTLs |

## Testing Strategy

- respx patches `httpx.AsyncClient` transport at the test level
- Each tool tested with valid response, error response, and timeout
- Cache hit tested: call once (miss), call again (hit from fakeredis)

## Dependencies

- **Requires**: 001 (monorepo), 002 (or equivalent migration that provides `knowledge_entries`)
- **Required by**: 005-agent-infrastructure (MCP client used by all agents)
