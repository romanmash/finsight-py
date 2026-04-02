# Implementation Plan: API & Auth

**Branch**: `003-api-auth` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-api-auth/spec.md`

## Summary

Implement the API foundation layer for FinSight by adding Hono server bootstrapping, JWT auth lifecycle, middleware for request tracing/security/rate-limiting, admin user and config routes, and a consolidated `GET /api/admin/status` endpoint for 3-second dashboard polling. The implementation is intentionally infrastructure/API-centric and excludes agent orchestration and chat business workflows.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Hono, JOSE (JWT), bcryptjs, Pino, Prisma Client, ioredis, BullMQ, Zod  
**Storage**: PostgreSQL 16 (Prisma), Redis 7 (rate limit/session/status cache)  
**Testing**: Vitest (unit/integration-style route tests), mocked external dependencies for offline execution  
**Target Platform**: Linux Docker (prod), Windows + Podman-through-docker-cli (dev)  
**Project Type**: Monorepo backend web-service module (`apps/api`)  
**Performance Goals**: `GET /api/admin/status` completes within 5 seconds; auth/admin routes return non-blocking responses suitable for dashboard polling and operator workflows  
**Constraints**: Offline-capable test runs, strict TS, fail-fast config behavior, admin-only user provisioning, no WebSocket introduction, explicit Redis-failure behavior from spec FR-019  
**Scale/Scope**: 1 API service, ~10-15 core middleware/route modules, auth + admin route families, status aggregation for 9 agents and platform health

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Auth/rate/token TTL behavior sourced from runtime YAML loaded by feature 001 config system.
- **Agent Boundaries**: PASS. This feature provides API/middleware plumbing only; no cross-agent reasoning responsibilities introduced.
- **MCP Server Independence**: PASS. API consumes MCP server health/status signals over defined interfaces; no direct MCP-to-agent cross-import shortcuts.
- **Cost Observability**: PASS (non-regressive). `GET /api/admin/status` consumes `AgentRun` cost fields without changing accounting schema.
- **Fail-Safe Defaults**: PASS. Auth failures reject safely; Redis-unavailable semantics explicitly bounded in spec (FR-019).
- **Test-First Where Practical**: PASS. Plan includes route and middleware validation with offline-capable tests.
- **Simplicity Over Cleverness**: PASS. Direct Hono middleware/routes with explicit modules; no unnecessary framework layering.

## Project Structure

### Documentation (this feature)

```text
specs/003-api-auth/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api-auth-routes.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/
├── index.ts
├── app.ts
├── middleware/
│   ├── request-id.ts
│   ├── logger.ts
│   ├── auth.ts
│   ├── role-guard.ts
│   └── rate-limit.ts
├── routes/
│   ├── auth.ts
│   ├── admin.ts
│   ├── watchdog.ts
│   └── screener.ts
├── types/
│   └── hono-context.ts
└── lib/
    ├── auth-tokens.ts
    ├── status-aggregation.ts
    └── __tests__/
```

**Structure Decision**: Keep API entrypoint, middleware, and routes separated under `apps/api/src/` for clear request pipeline ownership; reuse existing `lib/` utilities (`config`, `db`, `redis`, `queues`, `pricing`) and extend with auth/status-focused helpers.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- JWT/session strategy and secure token lifecycle behavior
- Hono middleware ordering and typed context pattern
- Redis failure-mode policy alignment with FR-019
- Admin status aggregation strategy (Redis + Prisma + bounded timeout)
- Offline test strategy for auth/admin routes

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/api-auth-routes.md](./contracts/api-auth-routes.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (token TTL/rate-limit/config-reload behavior remains YAML-driven)
- **Fail-Safe Defaults**: PASS (explicit 401/403/429/503 handling and bounded status timeout)
- **Test-First Where Practical**: PASS (quickstart defines offline route/middleware validation steps)
- **Simplicity Over Cleverness**: PASS (single Hono app with explicit middleware/route modules)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.

