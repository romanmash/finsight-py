# Feature Specification: API & Auth

**Feature**: `003-api-auth`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `001-foundation-config`, `002-data-layer`

## Overview

Create the Hono API entry point and foundational API layer: JWT authentication (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`), middleware pipeline (request-id, logger, auth, role guard, rate limiter), admin routes for user/config management, and `GET /api/admin/status` for mission-control polling.

**Why this feature exists:** All subsequent API capabilities depend on authenticated access, structured request tracing, and role-based controls. The admin dashboard in feature 010 requires `GET /api/admin/status` as its core polling endpoint.

---

## User Scenarios & Testing

### User Story 1 — JWT Authentication Flow (Priority: P1)

As a platform user, I want to authenticate with email/password and use JWT tokens so that I can securely access protected API routes.

**Why P1**: No protected API capability can be used without a working authentication lifecycle.

**Independent Test**: Authenticate via `POST /auth/login`, then call `GET /auth/me` with the returned access token; verify refresh and logout behavior independently.

**Acceptance Scenarios**:

1. **Given** a valid user account, **When** `POST /auth/login` is called with correct credentials, **Then** the response returns `accessToken`, sets secure httpOnly refresh cookie, and returns user profile fields without password hash
2. **Given** invalid credentials, **When** `POST /auth/login` is called, **Then** the response is `401 Unauthorized`
3. **Given** a valid access token, **When** `GET /auth/me` is called, **Then** the response returns the caller's profile and role
4. **Given** an expired or malformed access token, **When** `GET /auth/me` is called, **Then** the response is `401 Unauthorized`
5. **Given** a valid refresh-session cookie, **When** `POST /auth/refresh` is called, **Then** a new access token is issued
6. **Given** an active session, **When** `POST /auth/logout` is called, **Then** the refresh token is invalidated and cannot be reused

---

### User Story 2 — Middleware Security & Traceability (Priority: P1)

As a developer/operator, I want every request to be traceable and consistently protected so that troubleshooting and access control are reliable.

**Why P1**: Request traceability and authorization enforcement are mandatory platform foundations.

**Independent Test**: Call a protected route and verify `x-request-id` response header, structured logs, auth rejection for missing token, and role rejection for non-admin user.

**Acceptance Scenarios**:

1. **Given** any API request, **When** it is processed, **Then** the response includes a unique `x-request-id`
2. **Given** any API request, **When** it completes, **Then** the request log contains requestId, method, path, statusCode, and duration
3. **Given** a protected route call without JWT, **When** auth middleware executes, **Then** the response is `401 Unauthorized`
4. **Given** an admin-only route call by non-admin user, **When** role guard executes, **Then** the response is `403 Forbidden`
5. **Given** a caller exceeds configured limit, **When** another request is sent within the same window, **Then** the response is `429 Too Many Requests`

---

### User Story 3 — Admin User Management (Priority: P1)

As an admin, I want to manage platform users so that access can be granted, revoked, and role-scoped for operations and testing.

**Why P1**: Admin-managed user lifecycle is required for secure multi-user usage and Telegram identity mapping.

**Independent Test**: Log in as admin, create an analyst, list users, then deactivate that user; verify non-admin caller receives `403`.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** `POST /admin/users` is called with required fields, **Then** a new user is created with `201 Created`
2. **Given** an authenticated admin, **When** `GET /admin/users` is called, **Then** all users are returned without password hashes
3. **Given** an authenticated admin, **When** `PATCH /admin/users/:id` sets `active: false`, **Then** the targeted user is deactivated
4. **Given** a non-admin caller, **When** any user-management route is called, **Then** the response is `403 Forbidden`

---

### User Story 4 — Mission Control Status Endpoint (Priority: P1)

As the admin dashboard client, I want one consolidated status endpoint so that the mission-control view can refresh every 3 seconds with consistent data.

**Why P1**: Feature 010 depends directly on this endpoint for real-time dashboard rendering.

**Independent Test**: With Redis and DB data available, call `GET /api/admin/status` and verify presence of agent states, spend totals, health signals, and mission summaries.

**Acceptance Scenarios**:

1. **Given** agent runtime keys exist in Redis, **When** `GET /api/admin/status` is called, **Then** it returns state entries for all 9 agents
2. **Given** AgentRun records exist for today, **When** the endpoint is called, **Then** spend totals and per-provider totals are returned
3. **Given** mission activity exists, **When** the endpoint is called, **Then** active mission and recent mission log data are returned
4. **Given** dependency checks are configured, **When** the endpoint is called, **Then** health summary includes postgres, redis, all MCP services, LM Studio, and Telegram status
5. **Given** status data is expensive to recompute repeatedly, **When** polling occurs, **Then** spend aggregation can be cached with short TTL without returning stale structural schema

---

### User Story 5 — Admin Config Visibility & Reload (Priority: P2)

As an admin, I want to inspect and reload runtime configuration so that controlled configuration changes can be validated during operations.

**Why P2**: High operational value, but system core remains functional without live reload.

**Independent Test**: Call `GET /admin/config` for merged config output, update a runtime YAML value, call `POST /admin/config/reload`, and verify changed keys response.

**Acceptance Scenarios**:

1. **Given** authenticated admin access, **When** `GET /admin/config` is called, **Then** the full merged runtime config is returned
2. **Given** a valid runtime config change, **When** `POST /admin/config/reload` is called, **Then** changed top-level keys are returned
3. **Given** admin-triggered operations, **When** `POST /api/watchdog/trigger` or `POST /api/screener/trigger` is called, **Then** a job is enqueued and `202 Accepted` is returned quickly

---

### Edge Cases

- What happens when DB connectivity is unavailable during status polling? -> Return degraded/partial status payload with explicit health error markers, without crashing API process
- What happens when Redis is unavailable for rate limiting or state reads? -> Auth/session endpoints fail closed with explicit 503 errors for Redis-backed session operations; rate limiter fails open with warning logs; /api/admin/status returns degraded sections and explicit health errors
- What happens when a refresh token is revoked or already rotated? -> Reject refresh attempt with `401 Unauthorized`
- What happens when duplicate user identity data is submitted (`email` or `telegramHandle`)? -> Reject create/update with deterministic conflict response
- What happens when status aggregation exceeds expected latency? -> Enforce a 5-second timeout budget and return partial/degraded status payload instead of hanging the request

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST expose auth routes: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- **FR-002**: `POST /auth/login` MUST validate credentials, return access token plus sanitized user profile, and set refresh token in secure httpOnly cookie on success
- **FR-003**: `POST /auth/refresh` MUST read refresh token from secure httpOnly cookie, reject revoked/expired sessions, and issue a new access token only for valid active sessions
- **FR-004**: `POST /auth/logout` MUST invalidate the current refresh token/session represented by secure httpOnly cookie and prevent reuse
- **FR-005**: Middleware pipeline MUST assign and propagate a per-request identifier and include it in response headers and logs
- **FR-006**: Middleware pipeline MUST enforce JWT authentication on protected routes and attach authenticated user context for downstream handlers
- **FR-007**: Admin-only routes MUST enforce role-based access control and return `403 Forbidden` for non-admin callers
- **FR-008**: Rate limiting MUST apply configured request limits and return `429 Too Many Requests` after threshold is exceeded
- **FR-009**: Password storage MUST use one-way hashing and MUST never return password hash fields in API responses
- **FR-010**: Access-token and refresh-token validity windows MUST be controlled by runtime configuration values
- **FR-011**: System MUST expose admin user-management routes: `POST /admin/users`, `GET /admin/users`, `PATCH /admin/users/:id`
- **FR-012**: User-management routes MUST support role assignment and active/inactive state changes
- **FR-013**: System MUST expose runtime-config admin routes: `GET /admin/config`, `POST /admin/config/reload`
- **FR-014**: `GET /api/admin/status` MUST return a consolidated mission-control response that includes agent states, spend summary, mission summary, service health, KB summary, and queue summary
- **FR-015**: `GET /api/admin/status` MUST be safe for 3-second polling cadence and MUST complete within 5 seconds
- **FR-016**: `POST /api/watchdog/trigger` and `POST /api/screener/trigger` MUST enqueue work and return `202 Accepted` without waiting for job completion
- **FR-017**: API errors for auth/admin/status flows MUST use deterministic status codes and structured response bodies
- **FR-018**: Authentication and authorization behavior MUST support admin-created users only (no public self-registration flow)
- **FR-019**: Redis-unavailable behavior MUST be explicit and consistent: refresh/logout operations that require Redis-backed token state fail closed with `503 Service Unavailable`; rate limiting fails open with warning logs; `GET /api/admin/status` returns degraded sections with explicit health markers

### Key Entities

- **AuthenticatedSession**: Security context representing user identity, role, issued-at, expiry, and refresh-token lifecycle state
- **ApiUserProfile**: User representation returned by auth/admin endpoints without password hash, including role and optional Telegram identity fields
- **AdminStatusSnapshot**: Consolidated status payload for dashboard polling including agent runtime state, spend summary, health summary, mission summary, KB summary, and queue summary
- **RequestAuditRecord**: Structured request log record keyed by request identifier and containing method/path/status/latency metadata

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Valid credential login returns usable access token, sets refresh cookie, and allows successful `GET /auth/me` authorization flow
- **SC-002**: Invalid credentials and invalid tokens are rejected with correct `401 Unauthorized` behavior
- **SC-003**: Non-admin access to admin-only routes is consistently rejected with `403 Forbidden`
- **SC-004**: Rate limiting produces `429 Too Many Requests` once configured threshold is exceeded
- **SC-005**: `GET /api/admin/status` returns complete mission-control payload schema including all 9 agent slots
- **SC-006**: Manual trigger routes return `202 Accepted` and do not block on worker completion
- **SC-007**: Auth/admin/status test suite passes in offline-capable local test execution with mocked external services
- **SC-008**: `GET /api/admin/status` completes within 5 seconds under normal local runtime conditions and returns degraded/partial payload rather than timing out indefinitely when a dependency is unavailable

---

## Assumptions

- Accounts are provisioned by admin users; self-signup is out of scope for this feature
- Role model remains `admin`, `analyst`, `viewer` as defined in shared types and prior specs
- Access token is transmitted via `Authorization: Bearer <token>` and refresh token lifecycle is persisted through the data layer from feature 002
- Dashboard polling cadence remains 3 seconds and depends on one consolidated status endpoint (`GET /api/admin/status`)
- Agent orchestration/chat business flows are not implemented here and remain in scope for later features




