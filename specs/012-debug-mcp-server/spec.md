# Feature Specification: Debug MCP Server

**Feature Branch**: `012-debug-mcp-server`
**Created**: 2026-04-06
**Status**: Draft
**Input**: User description: "Implement debug MCP server from .tmp/012-debug-mcp-server-BRIEF.md using SpecKit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect Infrastructure Health and Logs (Priority: P1)

A coding agent needs typed tools to inspect service health, compose status, and recent service logs without running shell commands.

**Why this priority**: Infrastructure visibility is the first debugging step and unblocks all other diagnosis work.

**Independent Test**: Call `debug.service_health`, `debug.compose_status`, and `debug.tail_logs` against mocked dependencies and verify typed outputs, service validation, log scrub, and caps.

**Acceptance Scenarios**:

1. **Given** running FinSight services, **When** the agent calls `debug.service_health`, **Then** it receives pass/fail/skip status per configured endpoint.
2. **Given** a valid compose service name, **When** the agent calls `debug.tail_logs` with large `lines`, **Then** output is capped at 1000 and includes `capped=true`.
3. **Given** an unknown service name, **When** the agent calls `debug.tail_logs`, **Then** it receives a structured error with valid service names.

---

### User Story 2 - Run Read-Only Database Debug Queries (Priority: P1)

A coding agent needs to inspect relational state via safe SELECT-only tools and table metadata.

**Why this priority**: Database state explains most runtime failures and requires strict read-only controls.

**Independent Test**: Verify `debug.db_query` allows SELECT and rejects non-SELECT before DB calls; verify `debug.db_table_info` and `debug.db_recent_rows` output and caps.

**Acceptance Scenarios**:

1. **Given** a SELECT statement, **When** `debug.db_query` is called, **Then** it returns columns/rows with row cap enforcement.
2. **Given** INSERT/UPDATE SQL, **When** `debug.db_query` is called, **Then** it returns an error and performs no DB execution.
3. **Given** a table name and order column, **When** `debug.db_recent_rows` is called, **Then** identifiers are validated and safe latest rows are returned.

---

### User Story 3 - Inspect Read-Only Redis State (Priority: P2)

A coding agent needs cache introspection tools to inspect key existence, key sets, TTLs, sizes, and decoded values without mutation.

**Why this priority**: Cache diagnosis is important but secondary to infrastructure and primary DB mission flow.

**Independent Test**: Mock Redis and verify `debug.redis_get`, `debug.redis_keys`, `debug.redis_inspect` behavior for string/list/hash/set/zset and key cap.

**Acceptance Scenarios**:

1. **Given** a key pattern, **When** `debug.redis_keys` is called, **Then** matching keys are returned capped at 200.
2. **Given** a key, **When** `debug.redis_inspect` is called, **Then** type, TTL, value, and byte size are returned.
3. **Given** missing keys, **When** inspection tools are called, **Then** null-safe responses are returned without errors.

---

### User Story 4 - Inspect Mission and Agent Runtime State (Priority: P2)

A coding agent needs mission, agent run, queue depth, and alert inspection tools to diagnose orchestration failures.

**Why this priority**: Mission-level observability supports targeted remediation after infra and data checks.

**Independent Test**: Verify `debug.agent_runs`, `debug.mission_status`, `debug.celery_inspect`, and `debug.alert_inspect` success/error paths with mocked DB/Celery responses.

**Acceptance Scenarios**:

1. **Given** recent mission activity, **When** `debug.agent_runs` is called, **Then** runs are returned with status filtering and capped limits.
2. **Given** an existing mission ID, **When** `debug.mission_status` is called, **Then** mission data and related runs are returned.
3. **Given** a missing mission or alert ID, **When** inspection tool is called, **Then** structured not-found errors are returned.

---

### User Story 5 - Enforce Secure Debug Access (Priority: P1)

Operators require secure, constrained debugging interfaces that prevent destructive actions and credential leakage.

**Why this priority**: The debug surface touches production-adjacent systems and must be safe by default.

**Independent Test**: Verify bearer auth behavior, SQL read-only enforcement, Redis read-only behavior, and scrubbed log output.

**Acceptance Scenarios**:

1. **Given** `DEBUG_MCP_TOKEN` is set, **When** `/mcp/` is called without valid bearer token, **Then** server returns HTTP 401.
2. **Given** SQL not beginning with SELECT, **When** DB tool is called, **Then** request is rejected before DB execution.
3. **Given** log lines containing secrets, **When** `debug.tail_logs` returns content, **Then** matched values are redacted.

---

### Edge Cases

- Health endpoint is unavailable or times out for one service while others are healthy.
- SQL begins with comments/newlines before SELECT.
- Redis key exists with unsupported type for decode path.
- Docker logs contain JSON and env-style secret patterns in the same line.
- `DEBUG_MCP_TOKEN` unset in dev mode should not block tool calls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a new `debug-mcp` FastAPI HTTP JSON-RPC server at `POST /mcp/` and `GET /health`.
- **FR-002**: `debug-mcp` MUST implement `debug.service_health`, `debug.compose_status`, and `debug.tail_logs` tools.
- **FR-003**: `debug.tail_logs` MUST validate service names against a compile-time allowlist and scrub secret values from every returned line.
- **FR-004**: System MUST implement `debug.db_query`, `debug.db_table_info`, and `debug.db_recent_rows` using read-only DB access.
- **FR-005**: `debug.db_query` MUST reject any SQL that is not SELECT-only after stripping comments.
- **FR-006**: System MUST implement `debug.redis_get`, `debug.redis_keys`, and `debug.redis_inspect` using read-only Redis operations only.
- **FR-007**: System MUST implement `debug.agent_runs`, `debug.mission_status`, `debug.celery_inspect`, and `debug.alert_inspect`.
- **FR-008**: All debug tools MUST return `ToolResponse[T]` envelopes with typed data models and `latency_ms`.
- **FR-009**: `POST /mcp/` MUST enforce bearer auth when `DEBUG_MCP_TOKEN` is configured and return 401 on invalid/missing tokens.
- **FR-010**: System MUST add a compose `debug-mcp` service under `profiles: [debug]` with read-only Docker socket mount.
- **FR-011**: System MUST add a DB migration creating `debug_reader` role with SELECT-only grants and default privileges.
- **FR-012**: Project MUST add MCP client registration for `debug-infra` (HTTP) and `debug-browser` (`mcp/playwright` via docker stdio) in `.vscode/mcp.json` and merged `.claude/settings.json`.
- **FR-013**: System MUST enforce output caps: logs 1000 lines, DB rows 500, recent rows 500, Redis keys 200, agent runs 100.
- **FR-014**: System MUST include offline tests for auth, scrubbing, infra tools, DB tools, Redis tools, and agent tools.
- **FR-015**: System MUST create two reusable skills for future MCP server/tool additions in both `.agents/skills/` and `.claude/skills/`.

### Key Entities *(include if feature involves data)*

- **DebugToolResponse**: Standard envelope wrapping tool output data, errors, and latency.
- **ServiceHealth**: Per-service runtime status snapshot from configured endpoints.
- **DbQueryResult**: Tabular read-only query output with cap metadata.
- **RedisKeyResult**: Redis key introspection payload including type, ttl, value, and size.
- **AgentRunSummary**: Normalized projection of `agent_runs` rows for debugging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent can complete a full debug workflow (health, logs, DB, Redis, mission) using MCP tools only, with no shell commands.
- **SC-002**: 100% of non-SELECT SQL attempts are rejected before DB execution in tests.
- **SC-003**: 100% of token-required `/mcp/` requests without valid token return HTTP 401 in tests.
- **SC-004**: All specified cap constraints are enforced with `capped=true` behavior in tests.
- **SC-005**: `uv run mypy --strict`, `uv run ruff check`, and `uv run pytest` pass with zero errors at feature completion.

## Assumptions

- Docker daemon socket is available at `/var/run/docker.sock` for read-only inspection in debug profile environments.
- `debug-mcp` remains opt-in and is started only with compose profile `debug`.
- `mcp/playwright` image is available through Docker Hub in the target development environment.
- Existing `missions`, `agent_runs`, and `alerts` schema remain compatible with the debug projections defined in this feature.
