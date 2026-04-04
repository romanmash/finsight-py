# Research: MCP Platform

## Decision: FastMCP vs raw MCP SDK vs custom HTTP

**Chosen**: FastMCP (Python)
**Rationale**: FastMCP wraps the MCP protocol into a FastAPI-style decorator API. Tool definitions become simple `@mcp.tool()` decorated async functions with Pydantic input/output typing. It handles the JSON-RPC transport, tool discovery (`tools/list`), and health endpoint boilerplate automatically. Each server is a standalone ASGI app runnable with uvicorn.
**Alternatives considered**:
- Raw `mcp` SDK: More control but far more boilerplate for each tool definition and transport setup. No benefit for this use case.
- Plain FastAPI with custom tool registry: Would need to reimplement the MCP protocol. Rejected — the spec requires MCP-protocol compliance so agents can enumerate tools via standard discovery.

---

## Decision: Redis caching strategy for tool responses

**Chosen**: `redis.asyncio` (included in `redis[asyncio]`) with a cache-aside pattern. Cache key = `sha256(tool_name + sorted(json(params)))`. TTL per tool from `mcp.yaml`. Deserialization from JSON on hit; skip external call entirely.
**Rationale**: Cache-aside is simpler to reason about than write-through. The thundering-herd risk for short TTLs is mitigated by a Redis `SET NX PX` lock pattern (acquire lock before fetch, release after write). All TTLs live in `config/runtime/mcp.yaml` — no hardcoded values.
**Alternatives considered**:
- In-process LRU (functools.lru_cache): Does not survive process restarts and does not share across replicas. Rejected.
- Write-through (always write on fetch): More complex; no benefit for read-only tool responses. Rejected.

---

## Decision: OpenBB-backed market data via httpx transport

**Chosen**: `httpx.AsyncClient` calls to OpenBB-compatible HTTP endpoints (provider chosen from config).
**Rationale**: Keeps market-data tools fully mockable with `respx` in offline tests while preserving provider selection through YAML (`openbb_provider`). This aligns with the project-wide rule that external HTTP must be transport-mockable.
**Alternatives considered**:
- Direct `openbb` Python SDK (`obb.*`): difficult to intercept transport with `respx` and less deterministic offline tests. Rejected.
- `yfinance` direct library calls: no provider abstraction and harder to standardize across tools. Rejected.

---

## Decision: News and macro data backend

**Chosen**: Finnhub REST API (via `httpx` async client) for news and sentiment; GDELT GKG API (via `httpx`) for macro/geopolitical signals.
**Rationale**: Finnhub provides company-specific news, insider sentiment, and recommendation trends via a single API key. GDELT provides real-time geopolitical risk index and conflict data at no cost with no authentication. Both are JSON over HTTPS, trivially mockable with `respx`.
**Alternatives considered**:
- NewsAPI: Free tier rate-limited; no sentiment scoring. Rejected.
- OpenBB for news: Possible, but would create a cross-server dependency. Rejected to keep server independence.

---

## Decision: RAG retrieval backend

**Chosen**: SQLAlchemy 2.x async with `pgvector` extension. Queries use `asyncpg` driver. Vector similarity via `<=>` cosine distance operator. LangChain `PGVector` store NOT used — direct SQL queries for full control and mypy compatibility.
**Rationale**: Direct SQL with pgvector is simpler, fully typed, and does not pull in the full LangChain dependency into the RAG server. The RAG server is read-only: it queries the `knowledge_entries` table written by the Bookkeeper agent.
**Alternatives considered**:
- LangChain PGVector: Adds LangChain as a dependency to the MCP server layer. Spec says servers must NOT import from api app; LangChain belongs in the api app (RAG pipeline). Rejected.
- ChromaDB: Separate vector store requires separate container. Rejected — pgvector is already in the stack.

---

## Decision: MCP client in api app

**Chosen**: `httpx.AsyncClient` calling each server's JSON-RPC endpoint directly. Tool-to-server routing map loaded from `mcp.yaml` at startup. Client wraps responses in `ToolResponse[T]` Pydantic generics.
**Rationale**: FastMCP servers expose a standard `POST /mcp` JSON-RPC endpoint. A thin `httpx` wrapper is sufficient — no MCP client SDK needed. Routing map in YAML means adding a new tool to a server requires only a config entry, not a code change.
**Alternatives considered**:
- Official MCP Python client SDK: Heavier dependency; no benefit over direct httpx for same-network server calls. Rejected.
- gRPC: Overkill for same-datacenter tool calls. Rejected.

---

## Decision: Offline test strategy

**Chosen**: `respx` to intercept all `httpx` calls at the transport level. Fixtures defined in `conftest.py` as `respx.mock` context managers returning JSON matching the real API response shape.
**Rationale**: `respx` works with `httpx.AsyncClient` out of the box, requires no network, and fails loudly if an unmocked request is made (configured with `assert_all_called=False, assert_all_mocked=True`).
**Alternatives considered**:
- `responses` library: Designed for the `requests` library, not `httpx`. Rejected.
- VCR cassettes: Cassette recording requires a real network call at least once. Offline-first requirement means cassettes cannot be generated in CI. Rejected.
