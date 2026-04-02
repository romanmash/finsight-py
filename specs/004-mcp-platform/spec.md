# Feature Specification: MCP Platform

**Feature Branch**: `004-mcp-platform`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Agent Fetches Market Data via a Tool Call (Priority: P1)

An agent running inside the system needs current price and fundamental data for a watched asset.
It calls a named tool provided by the market data server. The tool fetches the data from the
configured finance data source, caches the result, and returns structured data to the agent. The
agent does not know which external data source was used — it only calls the tool by name.

**Why this priority**: All collector agents depend on market data tools. Without this server,
no finance data flows into the agent team.

**Independent Test**: Call the market data tool with a valid asset symbol, receive structured
price and fundamental data, call it again immediately and verify the cached result is returned
without a new external fetch.

**Acceptance Scenarios**:

1. **Given** a valid asset symbol, **When** the market data tool is called, **Then** the response
   contains structured price and fundamental data for that asset.
2. **Given** a tool response that was just fetched, **When** the same tool is called again within
   the cache TTL, **Then** the cached result is returned without contacting the external source.
3. **Given** an invalid or unknown asset symbol, **When** the market data tool is called, **Then**
   a structured error is returned rather than an unhandled exception.

---

### User Story 2 — Agent Retrieves News and Macro Signals (Priority: P1)

An agent needs recent news articles and macro-economic signals relevant to a watched theme or
asset. It calls named tools on the news and macro server. The server fetches from configured
sources, normalises the format, and returns structured results. The agent receives a consistent
response shape regardless of which news source contributed the data.

**Why this priority**: News and macro context is required by multiple agents (Researcher,
Watchdog, Analyst). Without this server, the agent team is blind to world events.

**Independent Test**: Call the news tool with a topic or asset filter, receive structured news
items with source, headline, and timestamp fields, call the macro signal tool and receive
structured macro indicators.

**Acceptance Scenarios**:

1. **Given** a topic filter, **When** the news tool is called, **Then** the response contains a
   list of news items each with a source identifier, headline, published timestamp, and relevance
   score.
2. **Given** a request for macro signals, **When** the macro tool is called, **Then** structured
   indicators (market sentiment, volatility regime, geopolitical risk index) are returned.
3. **Given** a news tool call, **When** the external source is unavailable, **Then** a graceful
   error is returned with a clear description rather than propagating an internal exception.

---

### User Story 3 — Agent Retrieves Semantically Relevant Knowledge (Priority: P1)

An agent needs to retrieve past research notes, analyst conclusions, or curated facts relevant
to its current task. It calls the RAG retrieval tool with a natural-language query. The server
performs a semantic search over the knowledge base and returns the most relevant entries ranked
by similarity. The agent receives structured results with the text content and provenance metadata.

**Why this priority**: The shared knowledge base with semantic retrieval is central to the
system's ability to accumulate and apply compound intelligence. All reasoning agents depend on it.

**Independent Test**: Pre-populate the knowledge base with a set of entries, call the retrieval
tool with a relevant query, verify results are returned ranked by semantic closeness, call with
an unrelated query and verify low-relevance or empty results.

**Acceptance Scenarios**:

1. **Given** knowledge entries stored in the base, **When** the retrieval tool is called with a
   relevant query, **Then** the top results are semantically related to the query and returned
   with text and provenance metadata.
2. **Given** a retrieval query with metadata filters (source agent, date range), **When** the tool
   is called, **Then** only entries matching the filter criteria are returned.
3. **Given** an empty knowledge base, **When** a retrieval query is made, **Then** an empty result
   set is returned rather than an error.

---

### User Story 4 — MCP Server Fails Fast if Required Source Is Unavailable at Startup (Priority: P2)

When the system starts, each MCP server verifies that its required data sources and backing
services are reachable. If a critical dependency is unavailable, the server refuses to start and
emits a clear error. Other servers that are healthy continue to start normally.

**Why this priority**: Silent startup with broken dependencies causes cascading failures inside
agent workflows. Fail-fast at startup is safer and easier to debug.

**Independent Test**: Start the MCP platform with one server's backing service intentionally
unreachable, verify that server emits a startup error, and verify the other servers start
successfully.

**Acceptance Scenarios**:

1. **Given** a required backing service is unreachable, **When** the MCP server starts, **Then**
   the server emits a descriptive error and refuses to accept tool calls.
2. **Given** all required backing services are available, **When** the MCP platform starts,
   **Then** all three servers report healthy and are ready to handle tool calls.

---

### Edge Cases

- What happens when a tool call exceeds the configured timeout for the external data source?
- How does the cache behave when the backing service returns partial data for a cached key?
- What if the knowledge base returns more results than the configured page size limit?
- How are concurrent tool calls for the same cache key handled to prevent thundering herd?
- What if an agent sends a malformed tool call (missing required parameters)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide three independent tool servers: one for market data
  (stocks, ETFs, fundamentals, options), one for news and macro signals, and one for knowledge
  base retrieval.
- **FR-002**: Each tool server MUST expose a discoverable list of available tools so that agents
  can enumerate what capabilities are available.
- **FR-003**: Each tool server MUST expose a health endpoint reporting its own readiness
  independently of the other servers.
- **FR-004**: All tool servers MUST cache responses from external sources with configurable
  time-to-live values settable without code changes.
- **FR-005**: Tool servers MUST return structured, typed responses with a consistent envelope
  format (data, error, metadata) regardless of which underlying source provided the data.
- **FR-006**: The market data server MUST provide tools for: current price, historical OHLCV,
  fundamental data, ETF holdings, and options chain for a given asset symbol.
- **FR-007**: The news and macro server MUST provide tools for: recent news by topic or symbol,
  macro sentiment indicators, and geopolitical risk signals.
- **FR-008**: The RAG retrieval server MUST provide tools for: semantic similarity search over
  the knowledge base and filtered retrieval by metadata (source agent, date range, entity).
- **FR-009**: Each tool server MUST be independently deployable and MUST NOT import code from
  agents, the API app, or other tool servers.
- **FR-010**: All tool server behaviour MUST be testable offline using mocked external sources
  without running the actual data provider APIs.

### Key Entities

- **Tool**: A named, typed operation exposed by a server. Has a name, input schema, output
  schema, and cache policy. Consumed by agents via the MCP client.
- **ToolResponse**: The standardised envelope returned by every tool call. Contains a typed data
  payload, an optional error descriptor, and call metadata (source, latency, cache hit flag).
- **CacheEntry**: A stored tool response keyed by tool name and input parameters hash, with an
  expiry timestamp.
- **ToolServer**: One of the three independent servers (market-data, news-macro, rag-retrieval).
  Has its own health state, tool registry, and cache namespace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cached tool response is returned in under 20 milliseconds after the initial fetch.
- **SC-002**: An uncached market data tool call completes and returns structured data in under
  3 seconds under normal network conditions.
- **SC-003**: A knowledge retrieval tool call across 10,000 entries returns ranked results in
  under 500 milliseconds.
- **SC-004**: All three tool servers report healthy on their health endpoints within 5 seconds of
  the platform starting with all backing services available.
- **SC-005**: 100% of tool server tests pass offline without network access, verified in the test
  suite.
- **SC-006**: A malformed or invalid tool call returns a structured error response within 100
  milliseconds without raising an unhandled exception.

## Assumptions

- The three tool servers are deployed as separate processes in Docker containers; they communicate
  with external data sources over the network and with the shared cache via Redis.
- Tool cache TTLs are defined per-tool in YAML configuration; they have sensible defaults (e.g.,
  60 seconds for prices, 5 minutes for news, 1 hour for fundamentals).
- The market data server uses OpenBB Platform as its primary data source; fallback providers may
  be configured in YAML if the primary is unavailable.
- The RAG retrieval server reads from the same pgvector database written by the Bookkeeper agent;
  it never writes to the knowledge base.
- Authentication between agents and tool servers is handled via a shared internal secret
  configured in `.env`; these servers are not exposed to the public internet.
- Offline tests mock all external HTTP calls; the test suite does not require OpenBB, Finnhub,
  GDELT, or any other live API.
