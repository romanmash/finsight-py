# Research: API & Auth (003)

## Decision 1: JWT handling uses explicit access + refresh token lifecycle
- **Decision**: Use short-lived access tokens for request authorization and refresh-token backed session renewal/invalidation for logout/rotation flows, with refresh token carried in httpOnly cookie per security constraints.
- **Rationale**: Aligns with spec FR-001..FR-004 and enables deterministic auth control with revocation support.
- **Alternatives considered**:
  - Stateless long-lived access-only tokens.
  - Rejected because logout/revocation guarantees become weak and security posture degrades.

## Decision 2: Hono middleware order is fixed and test-verified
- **Decision**: Apply middleware in strict sequence: request-id -> logger -> rate-limit -> auth -> role-guard (route-level), where rate-limiter keys by authenticated user when present and falls back to requester IP before auth.
- **Rationale**: Request tracing must exist before logging/auth decisions, and auth context must exist before role checks.
- **Alternatives considered**:
  - Route-local ad-hoc middleware registration.
  - Rejected because order drift becomes likely and security/logging guarantees become inconsistent.

## Decision 3: Redis-failure semantics are explicit per concern
- **Decision**: Enforce spec FR-019 exactly:
  - Redis-backed refresh/logout state operations fail closed with `503 Service Unavailable`
  - Rate limiter fails open with warning logs
  - `/api/admin/status` returns degraded/partial data with explicit health markers
- **Rationale**: Eliminates ambiguous runtime behavior and preserves safety for security-critical paths.
- **Alternatives considered**:
  - Global fail-open or global fail-closed policy.
  - Rejected because one-size policy is unsafe for either availability or security depending on path.

## Decision 4: Admin status endpoint uses bounded fan-out aggregation
- **Decision**: Build `/api/admin/status` from Redis MGET + Prisma aggregate queries with a hard 5-second response budget and partial fallback behavior.
- **Rationale**: Supports 3-second polling cadence while avoiding unbounded hangs when dependencies degrade.
- **Alternatives considered**:
  - Fully synchronous all-or-nothing dependency reads.
  - Rejected because single dependency latency could stall dashboard responsiveness.

## Decision 5: Auth/admin tests remain offline-capable
- **Decision**: Use Vitest with mocked external service calls and deterministic local fixtures for route/middleware validation.
- **Rationale**: Matches constitution test constraints (offline, repeatable) and keeps CI/dev runs reliable.
- **Alternatives considered**:
  - Networked integration tests as baseline.
  - Rejected because local/offline reliability is a hard project constraint.

## Decision 6: Route namespace consistency follows CASE contracts
- **Decision**: Keep auth under `/auth/*`, admin management/config under `/admin/*`, dashboard status under `/api/admin/status`, and manual queue triggers under `/api/watchdog/trigger` + `/api/screener/trigger`.
- **Rationale**: Mirrors CASE/CONTEXT route contracts and prevents dashboard/bot integration drift.
- **Alternatives considered**:
  - Consolidating all admin routes under a single `/api/admin/*` namespace.
  - Rejected because it would diverge from documented contracts already consumed by planned features.

