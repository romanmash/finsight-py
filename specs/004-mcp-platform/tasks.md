# Tasks: MCP Platform

**Input**: Design documents from `/specs/004-mcp-platform/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 39

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- Exact file paths are included in every description

---

## Phase 1: Setup (Package Structure + Shared Primitives)

**Purpose**: Create all `pyproject.toml` files with correct dependencies, all `__init__.py` stubs,
and a consistent per-server `ToolResponse[T]` Pydantic envelope. No tool logic yet.

- [X] T001 Update `apps/mcp-servers/market-data/pyproject.toml` with dependencies: `fastmcp>=0.4`, `openbb>=4.0`, `openbb-yfinance`, `httpx`, `redis[hiredis]`, `pydantic>=2.0`, `pyyaml>=6.0`, `structlog>=24.1`, `fakeredis` (dev) in `apps/mcp-servers/market-data/pyproject.toml`
- [X] T002 [P] Update `apps/mcp-servers/news-macro/pyproject.toml` with dependencies: `fastmcp>=0.4`, `finnhub-python`, `httpx`, `redis[hiredis]`, `pydantic>=2.0`, `pyyaml>=6.0`, `structlog>=24.1`, `fakeredis` (dev) in `apps/mcp-servers/news-macro/pyproject.toml`
- [X] T003 [P] Update `apps/mcp-servers/rag-retrieval/pyproject.toml` with dependencies: `fastmcp>=0.4`, `sqlalchemy[asyncio]>=2.0`, `asyncpg`, `pgvector`, `httpx`, `redis[hiredis]`, `pydantic>=2.0`, `pyyaml>=6.0`, `structlog>=24.1`, `fakeredis`, `aiosqlite` (dev) in `apps/mcp-servers/rag-retrieval/pyproject.toml`
- [X] T004 [P] Add `respx` to root `pyproject.toml` `[dependency-groups.dev]` (used across all MCP server tests) in `pyproject.toml`
- [X] T005 [P] Create all package `__init__.py` stubs: `apps/mcp-servers/market-data/src/market_data/__init__.py`, `apps/mcp-servers/market-data/src/market_data/tools/__init__.py`, `apps/mcp-servers/news-macro/src/news_macro/__init__.py`, `apps/mcp-servers/news-macro/src/news_macro/tools/__init__.py`, `apps/mcp-servers/rag-retrieval/src/rag_retrieval/__init__.py`, `apps/mcp-servers/rag-retrieval/src/rag_retrieval/tools/__init__.py`, `apps/api-service/src/api/mcp/__init__.py` (all empty)
- [X] T006 [P] Create test directories: `apps/mcp-servers/market-data/tests/__init__.py`, `apps/mcp-servers/news-macro/tests/__init__.py`, `apps/mcp-servers/rag-retrieval/tests/__init__.py`, `apps/api-service/tests/mcp/__init__.py` (all empty)
- [X] T007 Create per-server `ToolResponse[T]` generic Pydantic model (one independent copy per server) in each server `models.py`:
  ```python
  class ToolResponse(BaseModel, Generic[T]):
      data: T | None
      error: str | None = None
      cache_hit: bool = False
      latency_ms: int = 0
  ```
  Create `apps/mcp-servers/market-data/src/market_data/models.py`, `apps/mcp-servers/news-macro/src/news_macro/models.py`, `apps/mcp-servers/rag-retrieval/src/rag_retrieval/models.py` — each with its own copy of `ToolResponse[T]` and all server-specific Pydantic response types (no cross-imports between servers)

**Checkpoint**: `uv sync` completes; all three server packages importable; `ToolResponse` types correct.

---

## Phase 2: Foundational (Config Schema + Cache Helper)

**Purpose**: The `mcp.yaml` config schema and Redis cache helper (`cache.py`) are shared across
all three servers. Must exist before any tool implementation.

**⚠️ CRITICAL**: All MCP server user stories depend on this phase.

- [X] T008 Extend `config/runtime/mcp.yaml` to add per-tool TTL structure:
  ```yaml
  servers:
    market-data:
      url: "http://market-data-mcp:8001"
      openbb_provider: "yfinance"
      timeout_seconds: 10
      tools:
        get_price: {cache_ttl_seconds: 60}
        get_ohlcv: {cache_ttl_seconds: 300}
        get_fundamentals: {cache_ttl_seconds: 3600}
        get_etf_holdings: {cache_ttl_seconds: 3600}
        get_options_chain: {cache_ttl_seconds: 120}
    news-macro:
      url: "http://news-macro-mcp:8002"
      timeout_seconds: 15
      tools:
        get_news: {cache_ttl_seconds: 300}
        get_sentiment: {cache_ttl_seconds: 300}
        get_macro_signals: {cache_ttl_seconds: 600}
    rag-retrieval:
      url: "http://rag-retrieval-mcp:8003"
      timeout_seconds: 10
      tools:
        search_knowledge: {cache_ttl_seconds: 60}
        get_knowledge_entry: {cache_ttl_seconds: 300}
  ```
  in `config/runtime/mcp.yaml`
- [X] T009 Update `config/schemas/mcp.py` to extend `McpServerConfig` with `openbb_provider: str = "yfinance"` and `tools: dict[str, ToolCacheConfig]` where `ToolCacheConfig(BaseModel)` has `cache_ttl_seconds: int`; update `McpConfig` accordingly — `frozen=True` in `config/schemas/mcp.py`
- [X] T010 [P] Create `apps/mcp-servers/market-data/src/market_data/cache.py` with:
  - `CacheHelper` class wrapping `redis.asyncio.Redis`
  - `get(key: str) -> dict | None` — deserialise JSON
  - `set(key: str, value: dict, ttl: int) -> None` — serialise JSON + EXPIRE
  - `make_key(server: str, tool: str, params: dict) -> str` — `f"{server}:{tool}:{hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]}"`
  in `apps/mcp-servers/market-data/src/market_data/cache.py`
- [X] T011 [P] Create identical `cache.py` for news-macro server in `apps/mcp-servers/news-macro/src/news_macro/cache.py`
- [X] T012 [P] Create identical `cache.py` for rag-retrieval server in `apps/mcp-servers/rag-retrieval/src/rag_retrieval/cache.py`

**Checkpoint**: All three `cache.py` files importable; `CacheHelper` type-checks under mypy --strict.

---

## Phase 3: User Story 1 — Agent Fetches Market Data via a Tool Call (Priority: P1) 🎯 MVP

**Goal**: `market-data-mcp` server with all 5 tools (`get_price`, `get_ohlcv`, `get_fundamentals`,
`get_etf_holdings`, `get_options_chain`), Redis cache, health endpoint, and offline tests via respx.

**Independent Test**: `uv run pytest apps/mcp-servers/market-data/tests/test_tools.py` — all pass offline.

- [X] T013 [US1] Create response Pydantic types in `apps/mcp-servers/market-data/src/market_data/models.py`:
  - `PriceData`: symbol, price (Decimal), change_pct (float), volume (int), timestamp (datetime)
  - `OHLCVBar`: date (date), open, high, low, close (all Decimal), volume (int)
  - `OHLCVData`: symbol, bars (list[OHLCVBar])
  - `FundamentalsData`: symbol, market_cap (Decimal | None), pe_ratio (float | None), eps (float | None), revenue (Decimal | None), sector (str | None)
  - `ETFHolding`: ticker (str), weight (float), name (str | None)
  - `ETFData`: symbol, holdings (list[ETFHolding]), as_of_date (date | None)
  - `OptionsContract`: strike (Decimal), expiry (date), call_put (Literal["call","put"]), bid (Decimal), ask (Decimal), iv (float | None), open_interest (int | None)
  - `OptionsData`: symbol, contracts (list[OptionsContract])
  in `apps/mcp-servers/market-data/src/market_data/models.py`
- [X] T014 [US1] Implement `apps/mcp-servers/market-data/src/market_data/tools/price.py` with `async def get_price(symbol: str) -> ToolResponse[PriceData]`:
  - Check cache (`CacheHelper.get`) → if hit return with `cache_hit=True`
  - Call `httpx.AsyncClient` to fetch from OpenBB HTTP endpoint (or mock-friendly URL pattern); map response to `PriceData`
  - On any `httpx.HTTPError` or OpenBB error → return `ToolResponse(data=None, error="description")`
  - Cache result with TTL from config; return with `cache_hit=False`, `latency_ms` measured
  in `apps/mcp-servers/market-data/src/market_data/tools/price.py`
- [X] T015 [P] [US1] Implement `apps/mcp-servers/market-data/src/market_data/tools/history.py` with `async def get_ohlcv(symbol: str, period: str = "1mo") -> ToolResponse[OHLCVData]` — same cache/error pattern as get_price in `apps/mcp-servers/market-data/src/market_data/tools/history.py`
- [X] T016 [P] [US1] Implement `apps/mcp-servers/market-data/src/market_data/tools/fundamentals.py` with `async def get_fundamentals(symbol: str) -> ToolResponse[FundamentalsData]` in `apps/mcp-servers/market-data/src/market_data/tools/fundamentals.py`
- [X] T017 [P] [US1] Implement `apps/mcp-servers/market-data/src/market_data/tools/etf.py` with `async def get_etf_holdings(symbol: str) -> ToolResponse[ETFData]` in `apps/mcp-servers/market-data/src/market_data/tools/etf.py`
- [X] T018 [P] [US1] Implement `apps/mcp-servers/market-data/src/market_data/tools/options.py` with `async def get_options_chain(symbol: str, expiry: str | None = None) -> ToolResponse[OptionsData]` in `apps/mcp-servers/market-data/src/market_data/tools/options.py`
- [X] T019 [US1] Create `apps/mcp-servers/market-data/src/market_data/server.py` with:
  - `mcp = FastMCP("market-data")` app instance
  - Register all 5 tools via `@mcp.tool()` decorators (import from tools/*)
  - Startup health check: attempt Redis ping + OpenBB provider check; `sys.exit(1)` with error on failure
  - `GET /health` route returning `{"status": "healthy"|"unhealthy", "provider": str, "cache": str}`
  - Config loaded from `config/runtime/mcp.yaml` at module level; `sys.exit(1)` on validation error
  in `apps/mcp-servers/market-data/src/market_data/server.py`
- [X] T020 [US1] Write `apps/mcp-servers/market-data/tests/test_tools.py` with respx fixtures:
  - `test_get_price_success` — respx mocks OpenBB HTTP response → assert `PriceData` fields correct
  - `test_get_price_cache_hit` — call once (respx returns data), call again (respx raises `ConnectError` — must not fire because cache serves it) → assert `cache_hit=True`
  - `test_get_price_invalid_symbol` — respx returns 404/error → assert `ToolResponse(data=None, error=...)`
  - `test_get_price_timeout` — respx raises `httpx.ConnectTimeout` → assert `ToolResponse(data=None, error=...)`
  - `test_get_ohlcv_success` — respx mock → assert bars list non-empty
  - `test_get_fundamentals_success` — respx mock → assert fields populated
  - `test_get_etf_holdings_success` — respx mock → assert holdings list
  - `test_get_options_chain_success` — respx mock → assert contracts list
  - All tests use `fakeredis.aioredis.FakeRedis()` fixture for cache
  in `apps/mcp-servers/market-data/tests/test_tools.py`

**Checkpoint**: `uv run pytest apps/mcp-servers/market-data/tests/test_tools.py` — all pass offline.

---

## Phase 4: User Story 2 — Agent Retrieves News and Macro Signals (Priority: P1)

**Goal**: `news-macro-mcp` server with `get_news`, `get_sentiment`, `get_macro_signals` tools,
Redis cache, and offline tests via respx. All external HTTP via httpx (no Finnhub SDK direct calls).

**Independent Test**: `uv run pytest apps/mcp-servers/news-macro/tests/test_tools.py` — all pass offline.

- [X] T021 [US2] Create response Pydantic types in `apps/mcp-servers/news-macro/src/news_macro/models.py`:
  - `NewsItem`: headline (str), source (str), url (str | None), published_at (datetime), relevance_score (float | None), summary (str | None)
  - `SentimentData`: symbol (str), score (float), label (Literal["bullish","bearish","neutral"]), as_of (datetime)
  - `MacroSignals`: market_sentiment (float), volatility_regime (Literal["low","medium","high"]), geopolitical_risk_index (float | None), updated_at (datetime)
  in `apps/mcp-servers/news-macro/src/news_macro/models.py`
- [X] T022 [US2] Implement `apps/mcp-servers/news-macro/src/news_macro/tools/news.py` with `async def get_news(query: str, limit: int = 10) -> ToolResponse[list[NewsItem]]`:
  - httpx GET to Finnhub `/news` endpoint (URL from config, API key from env)
  - Cache with `get_news` TTL from mcp.yaml; structured error on any HTTP failure
  in `apps/mcp-servers/news-macro/src/news_macro/tools/news.py`
- [X] T023 [P] [US2] Implement `apps/mcp-servers/news-macro/src/news_macro/tools/sentiment.py` with `async def get_sentiment(symbol: str) -> ToolResponse[SentimentData]` — httpx GET to Finnhub sentiment endpoint in `apps/mcp-servers/news-macro/src/news_macro/tools/sentiment.py`
- [X] T024 [P] [US2] Implement `apps/mcp-servers/news-macro/src/news_macro/tools/macro.py` with `async def get_macro_signals() -> ToolResponse[MacroSignals]` — httpx GET to GDELT API; map to `MacroSignals`; cache with TTL in `apps/mcp-servers/news-macro/src/news_macro/tools/macro.py`
- [X] T025 [US2] Create `apps/mcp-servers/news-macro/src/news_macro/server.py` — same pattern as market-data server: FastMCP instance, register 3 tools, startup health check, `/health` endpoint, sys.exit(1) on bad config in `apps/mcp-servers/news-macro/src/news_macro/server.py`
- [X] T026 [US2] Write `apps/mcp-servers/news-macro/tests/test_tools.py`:
  - `test_get_news_success` — respx mocks Finnhub response → assert list of NewsItem
  - `test_get_news_cache_hit` — second call hits fakeredis → `cache_hit=True`
  - `test_get_news_source_unavailable` — respx returns 503 → `ToolResponse(data=None, error=...)`
  - `test_get_sentiment_success` — respx mock → assert SentimentData label is one of the Literal values
  - `test_get_macro_signals_success` — respx mocks GDELT → assert MacroSignals fields populated
  - `test_get_macro_signals_unavailable` — respx raises ConnectTimeout → structured error returned
  in `apps/mcp-servers/news-macro/tests/test_tools.py`

**Checkpoint**: `uv run pytest apps/mcp-servers/news-macro/tests/test_tools.py` — all pass offline.

---

## Phase 5: User Story 3 — Agent Retrieves Semantically Relevant Knowledge (Priority: P1)

**Goal**: `rag-retrieval-mcp` server with `search_knowledge` and `get_knowledge_entry` tools,
read-only DB access (SQLAlchemy async), Redis cache, and offline tests (SQLite + fakeredis).

**Independent Test**: `uv run pytest apps/mcp-servers/rag-retrieval/tests/test_tools.py` — all pass offline.

- [X] T027 [US3] Create response Pydantic types in `apps/mcp-servers/rag-retrieval/src/rag_retrieval/models.py`:
  - `KnowledgeResult`: id (UUID), content (str), source_type (str | None), author_agent (str), confidence (float), tickers (list[str]), tags (list[str]), freshness_date (date | None), similarity_score (float | None)
  in `apps/mcp-servers/rag-retrieval/src/rag_retrieval/models.py`
- [X] T028 [US3] Implement `apps/mcp-servers/rag-retrieval/src/rag_retrieval/tools/search.py` with `async def search_knowledge(query: str, limit: int = 10, tickers: list[str] | None = None, tags: list[str] | None = None) -> ToolResponse[list[KnowledgeResult]]`:
  - Generate query embedding via httpx POST to OpenAI embeddings API (allows respx mocking)
  - SQLAlchemy async session → `SELECT ... ORDER BY embedding <=> :vec LIMIT :limit WHERE embedding IS NOT NULL AND deleted_at IS NULL` with optional ticker/tag filters
  - Cache result keyed on query+filters+limit
  - On empty DB → return `ToolResponse(data=[], error=None)` (not an error)
  in `apps/mcp-servers/rag-retrieval/src/rag_retrieval/tools/search.py`
- [X] T029 [P] [US3] Implement `apps/mcp-servers/rag-retrieval/src/rag_retrieval/tools/retrieve.py` with `async def get_knowledge_entry(entry_id: str) -> ToolResponse[KnowledgeResult]` — simple SELECT by PK; cache with TTL in `apps/mcp-servers/rag-retrieval/src/rag_retrieval/tools/retrieve.py`
- [X] T030 [US3] Create `apps/mcp-servers/rag-retrieval/src/rag_retrieval/server.py` — FastMCP instance, register 2 tools, startup health check (DB ping + Redis ping), `/health` endpoint, sys.exit(1) on bad config in `apps/mcp-servers/rag-retrieval/src/rag_retrieval/server.py`
- [X] T031 [US3] Write `apps/mcp-servers/rag-retrieval/tests/test_tools.py` with in-memory SQLite fixtures (same pattern as Feature 002 test conftest):
  - `test_search_knowledge_returns_results` — insert 3 KnowledgeEntry rows with embeddings, respx mocks OpenAI embeddings API, assert results non-empty and fields correct
  - `test_search_knowledge_empty_db` — empty DB → `ToolResponse(data=[], error=None)` (no exception)
  - `test_search_knowledge_with_ticker_filter` — insert entries for AAPL and MSFT, filter `tickers=["AAPL"]`, assert only AAPL entries returned
  - `test_search_knowledge_cache_hit` — second identical query hits fakeredis → `cache_hit=True`
  - `test_get_knowledge_entry_found` — insert entry, retrieve by ID → `KnowledgeResult` correct
  - `test_get_knowledge_entry_not_found` — non-existent UUID → `ToolResponse(data=None, error="Not found")`
  in `apps/mcp-servers/rag-retrieval/tests/test_tools.py`

**Checkpoint**: `uv run pytest apps/mcp-servers/rag-retrieval/tests/test_tools.py` — all pass offline.

---

## Phase 6: User Story 4 — MCP Server Fails Fast if Required Source Unavailable (Priority: P2)

**Goal**: Each server's `startup_health_check()` raises `SystemExit(1)` with a descriptive error
when Redis or the required provider is unreachable. Tested via patching.

**Independent Test**: Patch Redis to raise `ConnectionError`; assert `SystemExit` raised by `startup_health_check()`.

- [X] T032 [US4] Add `startup_health_check()` function to each server's `server.py` — already partially in T019/T025/T030; ensure all three implementations:
  - Attempt `redis_client.ping()` — on `ConnectionError` → `sys.exit(1)` with `"Redis unavailable: {detail}"`
  - Attempt provider-specific probe (OpenBB: small test call; Finnhub: API status; rag-retrieval: `SELECT 1`) — on failure → `sys.exit(1)` with provider name + detail
  - On success → log "startup health check passed" via structlog
  Update all three server files: `apps/mcp-servers/market-data/src/market_data/server.py`, `apps/mcp-servers/news-macro/src/news_macro/server.py`, `apps/mcp-servers/rag-retrieval/src/rag_retrieval/server.py`
- [X] T033 [P] [US4] Add startup health check tests to `apps/mcp-servers/market-data/tests/test_tools.py`:
  - `test_startup_health_check_redis_unavailable` — patch `redis_client.ping` to raise `ConnectionError` → assert `SystemExit`
  - `test_startup_health_check_all_ok` — patch both probes to succeed → assert no exception
  in `apps/mcp-servers/market-data/tests/test_tools.py`
- [X] T034 [P] [US4] Add equivalent startup health check tests to `apps/mcp-servers/news-macro/tests/test_tools.py` and `apps/mcp-servers/rag-retrieval/tests/test_tools.py`

**Checkpoint**: `uv run pytest apps/mcp-servers/` — all startup tests pass; each server exits on bad deps.

---

## Phase 7: MCP Client (Cross-Story — Used by Feature 005)

**Purpose**: `MCPClient` in `apps/api-service` routes tool calls to correct server by name prefix,
handles timeouts, and discovers tool manifests at startup. Tests use respx to mock `POST /mcp/`.

- [X] T035 Create `apps/api-service/src/api/mcp/client.py` with `MCPClient`:
  - `__init__(self, configs: McpConfig)` — builds `{prefix: base_url}` routing map from config
  - `async def discover(self) -> dict[str, list[str]]` — for each server sends JSON-RPC `{"method":"tools/list","params":{}}` to `POST /mcp/`; caches manifest; raises `MCPToolError` if unreachable
  - `async def call_tool(self, tool_name: str, params: dict) -> dict` — selects server URL by prefix match, sends JSON-RPC `{"method":"tools/call","params":{"name":tool_name,"arguments":params}}` to `POST /mcp/`; raises `MCPToolError` on timeout, connection error, or JSON-RPC error field
  - `MCPToolError(Exception)` with `tool_name: str`, `detail: str` fields
  - Timeout loaded from per-server `timeout_seconds` in McpConfig
  in `apps/api-service/src/api/mcp/client.py`
- [X] T036 Write `apps/api-service/tests/mcp/test_client.py`:
  - `test_call_tool_routes_to_correct_server` — assert market.* tool sends POST to `market-data-mcp:8001/mcp/`; assert news.* sends to `news-macro-mcp:8002/mcp/`
  - `test_call_tool_success` — respx mocks POST /mcp/ returning JSON-RPC result → assert result dict returned
  - `test_call_tool_timeout` — respx raises `httpx.ConnectTimeout` → assert `MCPToolError` raised with tool_name
  - `test_call_tool_jsonrpc_error` — respx returns `{"error":{"code":-1,"message":"tool failed"}}` → assert `MCPToolError`
  - `test_discover_caches_manifest` — respx returns `{"result":{"tools":[...]}}` → assert manifest dict keyed by server name
  - `test_discover_server_unreachable` — respx raises `ConnectError` → assert `MCPToolError`
  in `apps/api-service/tests/mcp/test_client.py`

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T037 [P] Run `uv run mypy --strict apps/mcp-servers/market-data/src apps/mcp-servers/news-macro/src apps/mcp-servers/rag-retrieval/src apps/api-service/src/api/mcp/` — fix all type errors until zero errors remain
- [X] T038 [P] Run `uv run ruff check apps/mcp-servers/ apps/api-service/src/api/mcp/` — fix all warnings; run `uv run ruff format` for consistent formatting
- [X] T039 Run full test suite: `uv run pytest apps/mcp-servers/ apps/api-service/tests/mcp/` — all offline, all pass; confirm zero network calls escape (no `respx.mock` leaks)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001–T006 parallelisable; T007 after T001–T003
- **Foundational (Phase 2)**: Depends on Phase 1; T008→T009 sequential; T010–T012 parallel after T009
- **US1 (Phase 3)**: Depends on Phase 2 (cache.py, config); T013 → [T014–T018 parallel] → T019 → T020
- **US2 (Phase 4)**: Depends on Phase 2; independent of US1; T021 → [T022–T024 parallel] → T025 → T026
- **US3 (Phase 5)**: Depends on Phase 2; independent of US1/US2; T027 → T028 → T029 → T030 → T031
- **US4 (Phase 6)**: Depends on T019, T025, T030 (server.py files must exist); T032 → [T033, T034 parallel]
- **MCP Client (Phase 7)**: Depends on Phase 2 (McpConfig from mcp.yaml schema); independent of US1–US4 server implementations; T035 → T036
- **Polish (Phase 8)**: Depends on all phases; [T037, T038] parallel → T039

### User Story Dependencies

- **US1, US2, US3**: All depend only on Foundational phase; can run in parallel (different packages)
- **US4**: Depends on US1+US2+US3 `server.py` files existing (startup checks are added there)
- **MCP Client**: Depends only on McpConfig schema (Phase 2); parallel with US1–US3

### Parallel Execution Map

```
Phase 1: T001 → [T002, T003, T004, T005, T006] parallel → T007
Phase 2: T008 → T009 → [T010, T011, T012] parallel
Phase 3+4+5: All three server implementations fully parallel (different packages):
  US1: T013 → [T014,T015,T016,T017,T018] → T019 → T020
  US2: T021 → [T022,T023,T024] → T025 → T026
  US3: T027 → T028 → [T029] → T030 → T031
MCP Client: T035 → T036 (parallel with US1-3)
Phase 6: T032 → [T033, T034] parallel
Phase 8: [T037, T038] → T039
```

---

## Parallel Example: Three Servers (US1 + US2 + US3)

```
# All three servers are in independent packages — fully parallelisable:
Workstream A (US1): market-data server — 5 tools + tests
Workstream B (US2): news-macro server — 3 tools + tests
Workstream C (US3): rag-retrieval server — 2 tools + tests
Workstream D: MCPClient in apps/api-service — routing + tests
```

---

## Implementation Strategy

### MVP First (User Story 1 — Market Data)

1. Complete Phase 1: Setup (all three pyproject.toml + __init__.py)
2. Complete Phase 2: Foundational (mcp.yaml extended + cache.py)
3. Complete Phase 3: US1 (market-data server — all 5 tools + tests)
4. **STOP and VALIDATE**: `uv run pytest apps/mcp-servers/market-data/` passes offline
5. Market data flowing — Feature 005 can begin using `MCPClient` calls to market-data

### Incremental Delivery

1. Setup + Foundational → cache + config ready for all servers
2. US1 → market-data server tested → collectors (Feature 006) can mock market tool calls
3. US2 → news-macro server → Researcher agent (Feature 007) has news context
4. US3 → rag-retrieval server → Bookkeeper/Analyst (Feature 007) can search KB
5. US4 → startup fail-fast → reliable container orchestration
6. MCP Client → agents (Feature 005) can call tools by name without knowing server addresses

---

## Notes

- Tests are **required** by spec (FR-010: all tool behaviour testable offline)
- `respx` intercepts `httpx.AsyncClient` — all external HTTP (OpenBB, Finnhub, GDELT, OpenAI embeddings) must use `httpx`, never SDK-level HTTP
- `fakeredis.aioredis.FakeRedis()` used for cache in all tests — inject via fixture
- RAG server uses SQLite in-memory for tests (same pattern as Feature 002 db/conftest.py)
- Each server's `cache.py` is deliberately copied (not imported from a shared package) to maintain server independence (constitution: FR-009)
- OpenBB calls must use httpx wrapper pattern — do NOT call `obb.*` functions directly in tool tests (respx cannot mock them)
- `MCPClient.call_tool()` prefix routing: `"market.*"` → market-data URL; `"news.*"` / `"sentiment.*"` / `"macro.*"` → news-macro URL; `"knowledge.*"` / `"search.*"` → rag-retrieval URL
- `startup_health_check()` is called in FastMCP lifespan, not at import time — tests call it directly
- When running SpecKit from `main`, set `SPECIFY_FEATURE=004-mcp-platform` first so scripts do not resolve to `specs/main`
- RAG retrieval requires `knowledge_entries` in Postgres; if absent, `startup_health_check()` must `sys.exit(1)` with explicit dependency error

