# Feature Specification: MCP Platform

**Feature**: `004-mcp-platform`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/constitution.md`](../../.specify/constitution.md)
**Depends on**: `001-foundation-config`, `002-data-layer`

## Overview

Create the reusable MCP server factory (`createMcpServer`), then implement all 6 MCP tool servers as independent Hono microservices. Each server exposes a health endpoint, a tool manifest, and a tool invocation endpoint. Together, they provide the 20+ tools that agents use to access external data, internal knowledge, and trading operations.

**Why this feature exists:** Agents never call external APIs directly. They call MCP tools, which handle caching, validation, and error handling. This separation means agents can be tested with mocked MCP servers, and MCP servers can be tested independently of agent logic.

---

## User Scenarios & Testing

### User Story 1 — MCP Server Factory (Priority: P1)

As a developer, I want a reusable factory that creates MCP servers from a tool registry so that I can stand up new servers in minutes without duplicating routing, validation, and error handling code.

**Why P1**: The factory pattern eliminates code duplication across 6 servers. Every server uses it — it must work perfectly.

**Independent Test**: Create a minimal MCP server with one test tool, verify `/health`, `/mcp/tools`, and `/mcp/invoke` all work correctly.

**Acceptance Scenarios**:

1. **Given** a tool registry with one tool, **When** `createMcpServer(tools)` is called, **Then** it returns a Hono app with `/health`, `/mcp/tools`, and `/mcp/invoke` routes
2. **Given** a running MCP server, **When** `GET /health` is called, **Then** it returns `{ status: 'ok', uptime: <number> }`
3. **Given** a running MCP server with 3 tools, **When** `GET /mcp/tools` is called, **Then** it returns a manifest with all 3 tool definitions including `inputSchema` and `outputSchema`
4. **Given** valid input, **When** `POST /mcp/invoke { tool: 'get_quote', input: { ticker: 'NVDA' } }` is called, **Then** it returns `{ output: <QuoteOutput>, durationMs: <number> }`
5. **Given** invalid input (missing required field), **When** `/mcp/invoke` is called, **Then** it returns `400` with Zod error details
6. **Given** an unknown tool name, **When** `/mcp/invoke` is called, **Then** it returns `404` with `{ error: 'Unknown tool: xyz' }`

---

### User Story 2 — Market Data MCP (Priority: P1)

As the Researcher agent, I want market data tools (quotes, OHLCV, fundamentals, earnings, analyst ratings, price targets) so that I can collect comprehensive financial data for any ticker.

**Why P1**: Market data is required by Researcher (every mission), Watchdog (every scan cycle), and Technician (every pattern analysis). This is the most-used MCP server.

**Independent Test**: Start `market-data-mcp`, call each of its 7 tools with a real ticker, verify response shapes match the defined output schemas.

**Acceptance Scenarios**:

1. **Given** `market-data-mcp` is running, **When** `get_quote({ ticker: 'NVDA' })` is invoked, **Then** it returns `QuoteOutput` with `price`, `change_pct`, `volume`, `market_cap`, `high_52w`, `low_52w`
2. **Given** `get_ohlcv({ ticker: 'NVDA', days: 21 })` is invoked, **Then** it returns `OhlcvOutput` with a `candles` array of `{ o, h, l, c, v, t }` objects
3. **Given** a second call to `get_fundamentals` for the same ticker within cache TTL, **Then** the cached value is returned without making an HTTP request to Finnhub
4. **Given** Finnhub API returns an error, **When** FMP fallback is configured, **Then** the tool retries with FMP and returns the result
5. **Given** multiple tickers, **When** `get_multiple_quotes({ tickers: ['NVDA', 'AMD', 'AAPL'] })` is called, **Then** it returns quotes for all 3 tickers in a single batched operation

---

### User Story 3 — Supporting MCP Servers (Priority: P1)

As the system, I want macro signals, news, RAG retrieval, enterprise connector, and trader platform MCP servers so that agents have access to all required data sources and actions.

**Why P1**: Each of these servers provides tools that at least one agent requires for its pipeline. The system cannot run a complete mission without them.

**Independent Test**: Start each MCP server individually, call `GET /health` and `GET /mcp/tools`, verify each returns valid responses.

**Acceptance Scenarios**:

1. **Given** `macro-signals-mcp` is running, **When** `get_gdelt_risk({ topic: 'NVDA semiconductors' })` is invoked, **Then** it returns a risk score between 0 and 100
2. **Given** `news-mcp` is running, **When** `get_ticker_news({ ticker: 'NVDA', limit: 5 })` is invoked, **Then** it returns an array of news items with `headline`, `sentiment`, `datetime`
3. **Given** `rag-retrieval-mcp` is running and KB has entries, **When** `search({ query: 'NVDA thesis', limit: 5 })` is invoked, **Then** it returns ranked results using hybrid search (cosine similarity + BM25 via `ts_rank`, merged with RRF formula: `1/(k + rank)` where `k=60`)
4. **Given** `enterprise-connector-mcp` is running, **When** `sharepoint_search({ query: 'Q4 earnings' })` is invoked, **Then** it returns mock documents from hardcoded realistic data (at least 10 documents, 5 email threads)
5. **Given** `trader-platform-mcp` is running in mock mode, **When** `create_ticket({ ticker: 'NVDA', action: 'buy', quantity: 10, rationale: '...' })` is invoked, **Then** it creates a trade ticket and returns `{ ticketId }`
6. **Given** a trade ticket exists, **When** `place_order({ ticketId: '...' })` is invoked in mock mode, **Then** it simulates fill at `market_price × (1 ± mockExecutionSlippagePct)`

---

### User Story 4 — Redis Cache Layer (Priority: P2)

As the system, I want all MCP servers to cache responses in Redis so that repeated queries for the same data don't hit external APIs and incur latency.

**Why P2**: Performance optimization. The system works without caching but would be slow and expensive.

**Independent Test**: Call a tool twice with the same input, verify the second call returns faster and does not trigger an HTTP request.

**Acceptance Scenarios**:

1. **Given** cache TTL for quotes is 60 seconds, **When** `get_quote('NVDA')` is called twice within 60s, **Then** the second call returns the cached value
2. **Given** cache TTL has expired, **When** the tool is called again, **Then** it fetches fresh data from the external API
3. **Given** Redis is unavailable, **When** a tool is called, **Then** it bypasses cache and calls the external API directly (cache is not mandatory for correctness)

---

### Edge Cases

- What if Finnhub API key is missing? → Server starts but tools return clear `{ error: 'FINNHUB_API_KEY not configured' }` on invocation
- What if GDELT API is slow (> 8 seconds)? → Timeout per `mcp.yaml` timeoutMs, return timeout error
- What if external API returns unexpected JSON shape? → Zod output validation catches it, returns 500 with schema error
- What if `rag-retrieval-mcp` is called before any KB entries exist? → Returns empty results array (not an error)
- What if `trader-platform-mcp` is called with `platform: 'saxo'`? → Logs "saxo mode not yet implemented", returns mock response

---

## Requirements

### Functional Requirements

#### MCP Server Factory
- **FR-001**: `createMcpServer(tools)` MUST register `GET /health`, `GET /mcp/tools`, `POST /mcp/invoke`
- **FR-002**: `/mcp/invoke` MUST validate input against the tool's `inputSchema` (Zod) before calling the handler
- **FR-003**: `/mcp/invoke` MUST validate output against the tool's `outputSchema` (Zod) before returning
- **FR-004**: `/mcp/invoke` MUST return `{ output, durationMs }` on success and `{ error, code }` on failure
- **FR-005**: All MCP servers MUST never throw unhandled exceptions — errors are returned as structured responses

#### Market Data MCP (port 3001)
- **FR-006**: MUST implement 7 tools: `get_quote`, `get_ohlcv`, `get_fundamentals`, `get_earnings`, `get_multiple_quotes`, `get_analyst_ratings`, `get_price_targets`
- **FR-007**: `get_quote`, `get_ohlcv`, `get_fundamentals`, `get_earnings` MUST use Finnhub as primary, FMP as fallback
- **FR-008**: `get_analyst_ratings`, `get_price_targets` MUST use FMP only

#### Macro Signals MCP (port 3002)
- **FR-009**: MUST implement 4 tools: `get_gdelt_risk`, `get_eco_calendar`, `get_indicator`, `get_sector_macro_context`
- **FR-010**: GDELT client MUST use `https://api.gdeltproject.org/api/v2/doc/doc` (no API key required)
- **FR-011**: Alpha Vantage client MUST use `ALPHA_VANTAGE_API_KEY` for authentication

#### News MCP (port 3003)
- **FR-012**: MUST implement 5 tools: `get_ticker_news`, `search_news`, `get_sentiment_summary`, `get_top_sentiment_shifts`, `get_sector_movers`

#### RAG Retrieval MCP (port 3004)
- **FR-013**: MUST implement 3 tools: `search`, `get_current_thesis`, `get_thesis_history`
- **FR-014**: `search({ query, limit, ticker?, entryType?, since? })` MUST use hybrid search combining cosine similarity and BM25 via `ts_rank`, merged with RRF formula `1/(k + rank)` where `k=60`
- **FR-015**: `get_current_thesis({ ticker })` MUST return the most recent `KbEntry` for a ticker plus its `confidence`, `lastUpdated`, and contradiction flags — or `null` if no entry exists
- **FR-016**: `get_thesis_history({ ticker, limit? })` MUST return `KbThesisSnapshot` records for a ticker in reverse chronological order
- **FR-017**: All three tools MUST support filters by ticker, entry type, and date range where applicable
- **FR-018**: `bm25Weight` MUST be configurable from `rag.yaml` (default: 0.3)
- **FR-019**: MUST be read-only — never writes to the database

#### Enterprise Connector MCP (port 3005)
- **FR-020**: MUST implement mock data — at least 10 documents and 5 email threads with realistic corporate content
- **FR-021**: MUST implement tools: `sharepoint_search`, `search_emails`

#### Trader Platform MCP (port 3006)
- **FR-022**: MUST implement tools: `create_ticket`, `get_ticket`, `place_order`, `cancel_ticket`
- **FR-023**: In mock mode: `place_order` simulates fill at `market_price × (1 ± mockExecutionSlippagePct)`
- **FR-024**: In saxo mode: log warning "saxo mode not yet implemented" and return mock response

### Key Entities

#### MCP Tool Definition
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  handler: (input: unknown) => Promise<unknown>;
}
```

#### MCP Output Types (from shared-types)
| Type | Source Server | Fields |
|---|---|---|
| `QuoteOutput` | market-data | price, change_pct, volume, market_cap, high_52w, low_52w |
| `OhlcvOutput` | market-data | candles[]: { o, h, l, c, v, t } |
| `FundamentalsOutput` | market-data | pe_ratio, eps, revenue_growth_yoy, debt_to_equity, sector |
| `EarningsOutput` | market-data | next_date, days_until, estimate_eps, prev_eps, surprise_pct_last |
| `AnalystRatingsOutput` | market-data | strong_buy, buy, hold, sell, strong_sell, period |
| `PriceTargetsOutput` | market-data | avg_target, high_target, low_target, analyst_count |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 6 MCP servers return `200` on `GET /health`
- **SC-002**: All 6 MCP servers return valid tool manifests on `GET /mcp/tools`
- **SC-003**: `market-data-mcp` `get_quote('NVDA')` returns valid `QuoteOutput` (mocked via msw in tests)
- **SC-004**: Cache correctly serves second identical request from Redis (verified by lack of HTTP call)
- **SC-005**: Invalid input to any tool returns `400` with Zod error details
- **SC-006**: RAG hybrid search returns ranked results after seed data is loaded
- **SC-007**: Trader ticket lifecycle (create → get → place_order) works end-to-end in mock mode
