# Feature Specification: MCP Platform

**Feature**: `004-mcp-platform`
**Created**: 2026-03-30
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `001-foundation-config`, `002-data-layer`

## Overview

Build the MCP platform foundation for FinSight by introducing a reusable MCP server factory and delivering 6 independent MCP tool servers used by agents for market, macro, news, retrieval, enterprise, and trading workflows.

**Why this feature exists:** Agent boundaries require agents to consume tools through MCP servers instead of calling external systems directly. This enables independent testing, explicit validation boundaries, consistent error handling, and configuration-driven behavior.

---

## User Scenarios & Testing

### User Story 1 — Reusable MCP Server Factory (Priority: P1)

As a developer, I want a reusable MCP server factory so that every MCP server follows one consistent contract for health, tool discovery, invocation, validation, and error responses.

**Why P1**: All six MCP servers depend on this shared foundation; inconsistency here multiplies defects across the platform.

**Independent Test**: Create a minimal server from a one-tool registry and verify health, manifest, successful invocation, invalid-input handling, unknown-tool handling, duplicate-tool registration rejection, and structured error behavior.

**Acceptance Scenarios**:

1. **Given** a tool registry, **When** a server is created, **Then** it exposes `GET /health`, `GET /mcp/tools`, and `POST /mcp/invoke`
2. **Given** a running server, **When** `GET /health` is called, **Then** it returns a healthy status payload with uptime metadata
3. **Given** valid invocation input, **When** `POST /mcp/invoke` is called, **Then** it returns `{ output, durationMs }`
4. **Given** invalid invocation input, **When** `POST /mcp/invoke` is called, **Then** it returns `400` with schema-validation details
5. **Given** an unknown tool name, **When** `POST /mcp/invoke` is called, **Then** it returns `404` with deterministic error payload
6. **Given** duplicate tool names in one registry, **When** server initialization occurs, **Then** initialization fails with deterministic configuration error

---

### User Story 2 — Market Data MCP Coverage (Priority: P1)

As a collector agent, I want market-data tools for quote, OHLCV, fundamentals, earnings, analyst ratings, and targets so that I can gather structured financial context for missions.

**Why P1**: This is a high-frequency dependency for mission collection and screening paths.

**Independent Test**: Start market-data MCP and call each tool with valid/invalid inputs, verifying deterministic schema-compliant outputs and fallback behavior.

**Acceptance Scenarios**:

1. **Given** market-data MCP is running, **When** quote and OHLCV tools are invoked, **Then** responses match expected output schemas
2. **Given** primary data-provider failure, **When** a fallback-supported tool is invoked, **Then** fallback provider is attempted and result is returned when available
3. **Given** repeated identical requests inside configured TTL, **When** tool invocation occurs, **Then** cached output is returned
4. **Given** batch quote input for multiple tickers, **When** batch quote tool is invoked, **Then** all requested tickers return in one response payload

---

### User Story 3 — Remaining MCP Server Set (Priority: P1)

As the platform, I want macro-signals, news, RAG-retrieval, enterprise-connector, and trader-platform MCP servers so that every downstream agent has required tool access through MCP boundaries.

**Why P1**: Platform mission completeness requires all MCP domains, not only market data.

**Independent Test**: Run each server independently and verify tool manifest, invocation contract, and schema-valid responses for each exposed tool.

**Acceptance Scenarios**:

1. **Given** each MCP server is started, **When** health and tools endpoints are called, **Then** each returns valid service metadata and manifest entries
2. **Given** retrieval tool invocation with query filters, **When** search is called, **Then** ranked knowledge results are returned or an empty list when no matches exist
3. **Given** enterprise connector mock mode, **When** document/email tools are called, **Then** realistic mock artifacts are returned
4. **Given** trader platform mock mode, **When** ticket lifecycle tools are called, **Then** ticket creation/read/update actions succeed with deterministic response shapes

---

### User Story 4 — Cache, Resilience, and Degraded Behavior (Priority: P2)

As an operator, I want MCP tool calls to remain reliable under dependency issues so that mission processing degrades safely instead of failing unpredictably.

**Why P2**: Correctness must hold without cache and under partial outages.

**Independent Test**: Simulate Redis and upstream-provider outages; verify deterministic degraded behavior, bounded retries/timeouts, and no unhandled exceptions.

**Acceptance Scenarios**:

1. **Given** Redis is unavailable, **When** a cache-backed tool is invoked, **Then** the tool bypasses cache and still attempts source retrieval
2. **Given** upstream timeout or malformed upstream payload, **When** tool invocation occurs, **Then** structured error payload is returned without process crash
3. **Given** cache TTL expires, **When** a repeated request is made, **Then** fresh source retrieval occurs
4. **Given** temporary dependency outage recovery, **When** dependencies become healthy again, **Then** subsequent invocations return to non-degraded normal behavior

---

### Edge Cases

- What happens when an MCP tool is invoked with extra/unexpected input fields? -> Input validation rejects request with deterministic `400` error payload
- What happens when a provider secret is missing? -> Server starts, but dependent tool invocation returns explicit configuration error
- What happens when upstream response shape drifts? -> Output validation fails and returns structured tool error
- What happens when retrieval is called before KB has data? -> Empty results are returned (not treated as failure)
- What happens when trader execution path is called without explicit human approval context? -> Invocation is rejected with authorization error
- What happens when concurrent invocations target the same expensive upstream call? -> Cache key strategy and request handling remain deterministic and do not produce inconsistent outputs

---

## Requirements

### Functional Requirements

#### Shared MCP Factory
- **FR-001**: System MUST provide a reusable MCP server factory that exposes `GET /health`, `GET /mcp/tools`, and `POST /mcp/invoke`
- **FR-002**: System MUST validate invocation input against each tool input schema before handler execution
- **FR-003**: System MUST validate handler output against each tool output schema before returning response
- **FR-004**: System MUST return deterministic structured responses for success and failure cases
- **FR-005**: System MUST prevent unhandled exceptions from escaping MCP route handlers
- **FR-006**: System MUST reject duplicate tool names within one server registry during initialization

#### Market Data MCP
- **FR-007**: System MUST expose market-data tools for quote, OHLCV, fundamentals, earnings, multi-quote batch, analyst ratings, and price targets
- **FR-008**: System MUST support provider fallback for configured market-data tools when primary provider fails
- **FR-009**: System MUST support single-invocation multi-ticker quote retrieval

#### Macro Signals MCP
- **FR-010**: System MUST expose macro-signal tools for geopolitical risk, economic calendar, indicators, and sector macro context
- **FR-011**: System MUST return deterministic error payloads for upstream macro-provider timeout/failure

#### News MCP
- **FR-012**: System MUST expose news tools for ticker news, broad search, sentiment summary, sentiment shifts, and sector movers

#### RAG Retrieval MCP
- **FR-013**: System MUST expose retrieval tools for search, current thesis, and thesis history
- **FR-014**: System MUST support query filters (ticker, entry type, date range) where applicable
- **FR-015**: System MUST remain read-only for retrieval operations
- **FR-016**: System MUST apply configuration-driven hybrid ranking behavior (no hardcoded retrieval weights)

#### Enterprise Connector MCP
- **FR-017**: System MUST expose enterprise document and email search tools
- **FR-018**: System MUST provide realistic mock datasets for local/offline execution

#### Trader Platform MCP
- **FR-019**: System MUST expose ticket lifecycle tools for create/read/place/cancel flows
- **FR-020**: System MUST run in mock-first mode for order placement behavior in this feature scope
- **FR-021**: System MUST require explicit human-approval context before any non-mock trade execution path is allowed

#### Caching, Configuration, and Safety
- **FR-022**: System MUST support Redis-backed caching for configured tools with TTL values from runtime configuration
- **FR-023**: System MUST continue correctness without Redis cache availability (cache bypass behavior)
- **FR-024**: System MUST keep MCP server configuration values externalized in runtime YAML (no hardcoded behavior-critical values)
- **FR-025**: System MUST keep secrets externalized in environment variables and never embedded in source or runtime YAML
- **FR-026**: System MUST support fully offline test execution through mocks/stubs without network dependency
- **FR-027**: System MUST apply upstream timeout and retry limits from runtime configuration, not hardcoded values
- **FR-028**: System MUST produce invocation logs with request correlation and minimum fields: requestId, server, tool, status, durationMs, and error code when failed
- **FR-029**: System MUST define deterministic degraded-to-normal recovery behavior when dependencies become healthy after outage
- **FR-030**: System MUST provide deterministic behavior under concurrent invocations for identical inputs (consistent output envelope and cache-key semantics)

### Key Entities

- **McpToolDefinition**: Declarative contract for one tool, including name, description, input schema, output schema, and handler behavior
- **McpInvokeRequest**: Tool invocation payload containing target tool name and typed input object
- **McpInvokeResult**: Invocation response envelope containing output (success path) or structured error metadata (failure path), plus execution duration
- **McpServerManifest**: Server-level descriptor containing tool list and metadata exposed by `/mcp/tools`
- **CachePolicy**: Per-tool TTL and cache-key strategy loaded from runtime configuration

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 6 MCP servers return successful health responses under normal local runtime conditions
- **SC-002**: All 6 MCP servers publish valid tool manifests with complete tool metadata
- **SC-003**: Invalid invocation input is rejected with deterministic validation errors for all servers
- **SC-004**: Repeated identical requests inside configured TTL demonstrate cache-hit behavior for configured cache-enabled tools
- **SC-005**: Under Redis outage, cache-backed tools continue to return deterministic responses via cache-bypass behavior
- **SC-006**: Retrieval server returns non-empty ranked results with deterministic ordering for identical query + dataset, and returns empty results when no data exists
- **SC-007**: Trader ticket lifecycle works end-to-end in mock mode with deterministic response schema
- **SC-008**: MCP test suite executes successfully in offline local mode using mocks/stubs for external providers
- **SC-009**: Upstream timeout/retry behavior follows configured bounds and returns deterministic timeout/error envelopes

---

## Assumptions

- Feature 001 configuration/runtime-loading behavior is available and provides validated YAML values at startup
- Feature 002 data-layer entities and KB persistence exist and are readable by retrieval tools
- Each MCP server remains independently deployable and independently health-checkable
- Agent implementations consume MCP tools through MCP client abstractions rather than direct provider calls
- Non-mock broker execution remains out of scope for this feature except explicit approval-gated contract behavior
- Required provider secrets are supplied via `.env` in applicable environments; missing secrets produce explicit invocation errors, not process crashes
