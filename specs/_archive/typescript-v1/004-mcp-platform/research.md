# Research: MCP Platform (004)

## Decision 1: Use a shared `createMcpServer` factory with strict schema gates
- **Decision**: Implement one shared server factory that wires `/health`, `/mcp/tools`, and `/mcp/invoke`, enforcing input and output schema validation on every invocation.
- **Rationale**: Guarantees consistency across six MCP services and prevents drift in error/response shape.
- **Alternatives considered**:
  - Per-server custom route wiring.
  - Rejected due to duplicated validation/error logic and higher contract drift risk.

## Decision 2: Keep six MCP servers independently deployable with shared internals only
- **Decision**: Each MCP domain runs as its own Hono app (market-data, macro-signals, news, rag-retrieval, enterprise-connector, trader-platform) and does not import agent code.
- **Rationale**: Aligns with constitution requirement for MCP server independence and clear operational boundaries.
- **Alternatives considered**:
  - Single monolithic MCP endpoint for all tools.
  - Rejected due to blast-radius expansion and weaker fault isolation.

## Decision 3: Provider fallback is tool-specific and configuration-driven
- **Decision**: Implement primary/fallback provider routing per tool based on runtime config, with deterministic timeout and retry limits from `mcp.yaml`.
- **Rationale**: Improves resilience while preserving Everything-as-Code and preventing hardcoded provider policy.
- **Alternatives considered**:
  - Global fallback chain for all tools.
  - Rejected because providers vary by tool coverage and response semantics.

## Decision 4: Cache behavior uses Redis TTL policies with correctness-first bypass
- **Decision**: Use Redis cache for configured tools with cache-key normalization and per-tool TTL from runtime config; if Redis is unavailable, bypass cache and continue tool execution.
- **Rationale**: Meets performance goals without turning cache into a correctness dependency.
- **Alternatives considered**:
  - Fail-closed when cache is unavailable.
  - Rejected because cache is optimization, not source of truth.

## Decision 5: RAG retrieval stays read-only and ranking-weight configurable
- **Decision**: Retrieval tools only read from KB tables, support filters, and apply hybrid ranking weights from config.
- **Rationale**: Preserves Bookkeeper write boundary and keeps retrieval behavior tunable without code edits.
- **Alternatives considered**:
  - Writing retrieval side-effects (auto-snapshot updates).
  - Rejected due to agent-boundary and auditability violations.

## Decision 6: Trader platform is mock-first with explicit approval gating for non-mock paths
- **Decision**: Ticket lifecycle is fully implemented in mock mode for this feature; any non-mock execution path requires explicit approval context and remains constrained.
- **Rationale**: Aligns with constitution no-autonomous-trade principle while enabling end-to-end workflow testing.
- **Alternatives considered**:
  - Enabling direct broker execution in this feature.
  - Rejected due to safety and scope concerns.

## Decision 7: Offline-first testing uses msw and deterministic fixtures
- **Decision**: MCP tests run without network access by mocking provider endpoints and using deterministic fixture payloads for all tool paths.
- **Rationale**: Matches constitution quality gate requiring offline test reliability.
- **Alternatives considered**:
  - Live API integration tests as baseline.
  - Rejected due to non-determinism, rate limits, and secret coupling.
