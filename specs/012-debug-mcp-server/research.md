# Research: Debug MCP Server

## Decision 1: Split debug capabilities across two MCP servers
- **Decision**: Use a custom Python `debug-mcp` server for infra/data/queue introspection and `mcp/playwright` for browser actions.
- **Rationale**: Browser runtime maintenance stays external and standardized; Python server remains focused on project-specific typed debug tools.
- **Alternatives considered**:
  - Single Python server with embedded browser stack: rejected due to image bloat and browser lifecycle maintenance burden.
  - Browser-only server: rejected because DB/Redis/Celery/domain tools are project-specific and require Python integration.

## Decision 2: Use HTTP JSON-RPC transport for `debug-mcp`
- **Decision**: Implement `POST /mcp/` JSON-RPC and `GET /health` using plain FastAPI.
- **Rationale**: Matches existing MCP server pattern in repository and supports persistent pooled clients.
- **Alternatives considered**:
  - FastMCP SDK: rejected because existing project servers use direct FastAPI dispatch.
  - stdio transport: rejected because compose-hosted service and internal network are already established.

## Decision 3: Keep Redis and PostgreSQL tools in custom server
- **Decision**: Implement read-only Redis and DB inspection directly in `debug-mcp`.
- **Rationale**: Strict security requirements (read-only contract, SQL pre-validation) are easier to enforce in a single audited code path.
- **Alternatives considered**:
  - Generic Redis MCP server: rejected due to mutating commands and weaker read-only guarantees.
  - Third-party Postgres MCP server: rejected because role model and constraints are repository-specific.

## Decision 4: Enforce two-layer DB read-only model
- **Decision**: Add DB role `debug_reader` with SELECT grants and enforce `SELECT`-only SQL validation in application logic.
- **Rationale**: Defense in depth prevents accidental or malicious mutations.
- **Alternatives considered**:
  - App-layer validation only: rejected as insufficient if bypassed.
  - DB role only: rejected because early application rejection improves safety and feedback.

## Decision 5: Token-gated MCP endpoint with dev-mode bypass
- **Decision**: Require `Authorization: Bearer` on `/mcp/` when `DEBUG_MCP_TOKEN` is configured; skip auth when unset.
- **Rationale**: Secure-by-configuration while preserving local developer ergonomics.
- **Alternatives considered**:
  - Always-on auth with mandatory token: rejected as friction for local debugging.
  - No auth at all: rejected for unsafe exposure risk.

## Decision 6: Always scrub log output in server
- **Decision**: Apply regex redaction to every returned log line in `debug.tail_logs`.
- **Rationale**: Prevent credential leakage in agent-visible output.
- **Alternatives considered**:
  - Best-effort client-side scrub: rejected because security control belongs on producer side.
  - No scrub: rejected by security requirements.

## Decision 7: Read-only Docker socket mount
- **Decision**: Mount `/var/run/docker.sock` as `:ro` for service state and logs.
- **Rationale**: Enables runtime diagnostics without lifecycle mutation permissions.
- **Alternatives considered**:
  - No Docker socket: rejected because compose status/log tools could not function.
  - RW socket: rejected as unnecessarily permissive.

## Decision 8: `mcp/playwright` configured in MCP client, not compose
- **Decision**: Register `debug-browser` as `docker run -i --rm --network <compose-network> mcp/playwright` in MCP config.
- **Rationale**: Ephemeral browser runtime avoids long-lived browser service management.
- **Alternatives considered**:
  - Compose-managed browser service: rejected due to unnecessary standing container overhead.
  - Wrapper scripts: rejected; direct config arguments are sufficient.
