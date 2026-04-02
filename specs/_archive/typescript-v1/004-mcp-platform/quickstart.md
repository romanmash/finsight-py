# Quickstart: MCP Platform (004)

## Prerequisites

- Features 001 and 002 completed
- Runtime config files available and valid (`config/runtime/*.yaml`)
- Redis and Postgres available for local runs (`docker compose up -d postgres redis`)
- Workspace dependencies installed (`pnpm install`)

## 1) Validate planning artifacts

Ensure these files exist:

- `specs/004-mcp-platform/plan.md`
- `specs/004-mcp-platform/research.md`
- `specs/004-mcp-platform/data-model.md`
- `specs/004-mcp-platform/contracts/mcp-platform-contracts.md`
- `specs/004-mcp-platform/quickstart.md`

## 2) Generate implementation tasks

```bash
# after planning is complete
/speckit.tasks
```

## 3) Implement feature

```bash
/speckit.implement
```

## 4) Local validation targets after implementation

### MCP server contract checks

- Each MCP server returns `200` on `GET /health`
- Each MCP server returns tool manifest on `GET /mcp/tools`
- `POST /mcp/invoke` returns deterministic success/failure envelopes

### Cache and resilience checks

- Repeated tool requests inside TTL produce cache-hit behavior
- Redis-down scenario bypasses cache while preserving functional correctness
- Upstream timeout/schema drift returns structured errors (no unhandled crash)

### Safety checks

- Retrieval tools remain read-only
- Trader mock lifecycle works end-to-end in mock mode
- Non-mock trader path requires explicit approval context

## 5) Quality gates

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

Expected:
- zero type errors
- zero lint warnings
- passing offline-capable test suite for MCP contracts and integrations
- passing secret-policy check (no hardcoded secrets)

## 6) Suggested smoke sequence (PowerShell)

```powershell
# health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:3006/health

# manifest
curl http://localhost:3001/mcp/tools

# invoke
$payload = '{"tool":"get_quote","input":{"ticker":"NVDA"}}'
curl -X POST http://localhost:3001/mcp/invoke -H "Content-Type: application/json" -d $payload
```

## 7) Suggested smoke sequence (Bash)

```bash
# health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:3006/health

# manifest
curl http://localhost:3001/mcp/tools

# invoke
curl -X POST http://localhost:3001/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_quote","input":{"ticker":"NVDA"}}'
```


## 8) Validation Evidence (2026-03-30)

Executed from repository root:

- `pnpm -r typecheck` -> PASS
- `pnpm -r lint` -> PASS
- `pnpm -r test` -> PASS
- `pnpm check:secrets` -> PASS
- `pnpm mcp:typecheck` -> PASS
- `pnpm mcp:lint` -> PASS
- `pnpm mcp:test` -> PASS (16 test files, 20 tests)

Notes:
- MCP tests run fully offline via `msw` mocks.
- Vitest in this environment requires non-sandbox spawn permissions.
