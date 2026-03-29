# Feature Specification: API & Auth

**Feature**: `003-api-auth`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/constitution.md`](../../.specify/constitution.md)
**Depends on**: `001-foundation-config`, `002-data-layer`

## Overview

Create the Hono API server entry point, implement JWT authentication (access + refresh tokens), create all middleware (request-id, logger, auth, role-guard, rate-limiter), build the auth routes (`/auth/*`), and build the admin routes (`/admin/*`) including the mission control status endpoint (`GET /api/admin/status`). This feature does NOT include agent routes, chat, or mission orchestration — those come in Feature 008.

**Why this feature exists:** Every other API route needs authentication, logging, and request tracking. The admin dashboard (Feature 010) depends entirely on `GET /api/admin/status`. User management is required before any Telegram integration can authenticate users.

---

## User Scenarios & Testing

### User Story 1 — JWT Authentication (Priority: P1)

As a user, I want to log in with email/password and receive a JWT so that I can access protected API endpoints.

**Why P1**: Every API endpoint (except `/auth/login`) requires a valid JWT. No feature works without auth.

**Independent Test**: Call `POST /auth/login` with valid credentials, receive tokens, then call `GET /me` with the access token.

**Acceptance Scenarios**:

1. **Given** a user exists with email `admin@finsight.local`, **When** I POST to `/auth/login` with correct password, **Then** I receive `{ accessToken, refreshToken, user: { id, email, name, role } }`
2. **Given** I POST to `/auth/login` with wrong password, **Then** I receive a `401` response with `{ error: 'Invalid credentials' }`
3. **Given** a valid `accessToken`, **When** I call `GET /me`, **Then** I receive the full user object (no password hash)
4. **Given** an expired `accessToken`, **When** I call `GET /me`, **Then** I receive a `401` response
5. **Given** a valid `refreshToken`, **When** I POST to `/auth/refresh`, **Then** I receive a new `accessToken`
6. **Given** a valid `refreshToken`, **When** I POST to `/auth/logout`, **Then** the refresh token is invalidated and returns `204`

---

### User Story 2 — Middleware Pipeline (Priority: P1)

As a developer, I want structured logging with request IDs and auth enforcement so that every API request is traceable and secured.

**Why P1**: Request tracing (via request-id) is essential for debugging multi-agent pipelines. Auth middleware prevents unauthorized access.

**Independent Test**: Make an API request and verify the response includes `x-request-id` header and the server logs contain the same ID.

**Acceptance Scenarios**:

1. **Given** any API request, **When** it is processed, **Then** the response includes an `x-request-id` header with a unique UUID
2. **Given** an API request, **When** it is logged, **Then** Pino JSON log includes `requestId`, `method`, `path`, `statusCode`, `durationMs`
3. **Given** a request to `/api/*` without a JWT, **When** it is processed, **Then** it receives `401 Unauthorized`
4. **Given** a request to `/admin/*` with a non-admin JWT, **When** it is processed, **Then** it receives `403 Forbidden`
5. **Given** a user exceeds the rate limit, **When** they make another request, **Then** they receive `429 Too Many Requests`

---

### User Story 3 — User Management (Priority: P1)

As an admin, I want to create, list, and manage users so that I can control who has access to the platform and with what role.

**Why P1**: Without user management, there's no admin user for the demo, no analyst user for Telegram, and no auth can work.

**Independent Test**: Login as admin, create a new analyst user, verify the user appears in the list.

**Acceptance Scenarios**:

1. **Given** I am authenticated as admin, **When** I POST to `/admin/users` with `{ email, password, name, role: 'analyst', telegramHandle: '@user1' }`, **Then** a new user is created and returned with `201`
2. **Given** I am authenticated as admin, **When** I GET `/admin/users`, **Then** I receive an array of all users (without password hashes)
3. **Given** I am authenticated as admin, **When** I PATCH `/admin/users/:id` with `{ active: false }`, **Then** the user is deactivated
4. **Given** I am authenticated as non-admin, **When** I POST to `/admin/users`, **Then** I receive `403 Forbidden`

---

### User Story 4 — Admin Status Dashboard API (Priority: P1)

As the admin dashboard, I want a single endpoint that returns the complete system status so that I can render the mission control view with 3-second polling.

**Why P1**: The admin dashboard (Feature 010) fetches this endpoint every 3 seconds. It's the most called endpoint in the system.

**Independent Test**: Start the API with seeded data, call `GET /api/admin/status`, verify the response shape matches `AdminStatusResponse`.

**Acceptance Scenarios**:

1. **Given** the system is running, **When** I call `GET /api/admin/status`, **Then** I receive agent states for all 9 agents (from Redis MGET)
2. **Given** an agent is active, **When** status is polled, **Then** its state includes `currentTask`, `currentMissionId`, and `startedAt`
3. **Given** today's missions have recorded costs, **When** status is polled, **Then** `spend` includes per-provider breakdown (from `AgentRun` table, cached 30s in Redis)
4. **Given** a mission is running, **When** status is polled, **Then** `activeMission` includes pipeline steps with tool call states
5. **Given** health checks are configured, **When** status is polled, **Then** `health` includes ping status for all 6 MCP servers, postgres, redis, LM Studio, and Telegram

---

### User Story 5 — Config Admin (Priority: P2)

As an admin, I want to view and reload the runtime configuration so that I can verify settings and trigger hot-reload during demos.

**Why P2**: Important for demo flexibility but the system works with cold-start config.

**Independent Test**: Call `GET /admin/config`, verify it returns the current merged config. Call `POST /admin/config/reload`, verify it returns changed keys.

**Acceptance Scenarios**:

1. **Given** I am admin, **When** I GET `/admin/config`, **Then** I receive the full merged config object (all 11 YAML sections)
2. **Given** I am admin and a YAML file was modified, **When** I POST `/admin/config/reload`, **Then** I receive `{ changed: ['agents'] }` (example)
3. **Given** I am admin, **When** I POST `/api/watchdog/trigger`, **Then** a manual Watchdog scan is enqueued and `202 Accepted` is returned
4. **Given** I am admin, **When** I POST `/api/screener/trigger`, **Then** a manual Screener scan is enqueued and `202 Accepted` is returned

---

### Edge Cases

- What happens when the DB is unavailable during status poll? → Return partial response with DB health as `'error'`, don't crash
- What happens when Redis is unavailable during auth? → Rate limiter fails open (allows request), logs warning
- What happens when the access token is malformed (not JWT)? → 401 with `'Invalid token format'`
- What happens when the refresh token has been revoked? → 401 with `'Token revoked'`
- What happens when `GET /api/admin/status` takes > 3 seconds? → Timeout after 5s, return cached last-known status

---

## Requirements

### Functional Requirements

- **FR-001**: Hono app MUST register middleware in order: requestId → logger → auth → roleGuard → rateLimiter → langsmithInject
- **FR-002**: `requestId` middleware MUST generate a UUID v4 and attach it to both `ctx.var.requestId` and response header `x-request-id`
- **FR-003**: `logger` middleware MUST use Pino with structured JSON output including requestId, method, path, statusCode, durationMs
- **FR-004**: `auth` middleware MUST validate JWT from `Authorization: Bearer <token>` header and attach decoded payload to `ctx.var.user`
- **FR-005**: `roleGuard(role)` middleware MUST return 403 if `ctx.var.user.role` does not match the required role
- **FR-006**: `rateLimiter` MUST be Redis-backed with configurable limits from `telegram.yaml: rateLimitPerUserPerMinute`
- **FR-007**: JWT access tokens MUST expire after value from `auth.yaml: accessTokenExpiryMinutes` (default: 15)
- **FR-008**: JWT refresh tokens MUST expire after value from `auth.yaml: refreshTokenExpiryDays` (default: 7)
- **FR-009**: Passwords MUST be hashed with bcrypt (cost factor from `auth.yaml: bcryptRounds`, default: 12)
- **FR-010**: `GET /api/admin/status` MUST aggregate: 9 agent states (Redis MGET), today's spend (AgentRun grouped by provider, cached 30s), active mission, last 10 missions, service health pings, KB stats, queue depths
- **FR-011**: `GET /api/admin/status` MUST complete within 5 seconds
- **FR-012**: All admin routes MUST require `role: 'admin'`
- **FR-013**: `POST /api/watchdog/trigger` and `POST /api/screener/trigger` MUST enqueue a BullMQ job and return `202 Accepted` immediately

### Key Entities

- **JwtPayload**: `{ sub: string, role: UserRole, iat: number, exp: number }`
- **AdminStatusResponse**: Comprehensive status object with agents, spend, activeMission, missionLog, health, kb, queues sections

### AdminStatusResponse Shape

```typescript
interface AdminStatusResponse {
  agents: Record<AgentName, {
    state: AgentState;
    currentTask: string | null;
    currentMissionId: string | null;
    startedAt: string | null;
    lastActivitySummary: string | null;
    model: string;
    provider: Provider;
    todayCostUsd: number;
    todayTokensIn: number;
    todayTokensOut: number;
  }>;
  spend: {
    totalUsd: number;
    byProvider: Record<Provider, number>;
    budgetUsd: number;
    budgetUsedPct: number;
  };
  activeMission: {
    id: string;
    type: MissionType;
    tickers: string[];
    trigger: MissionTrigger;
    startedAt: string;
    elapsedMs: number;
    steps: Array<{
      agent: AgentName;
      state: 'done' | 'running' | 'pending';
      label: string;
      toolCalls?: Array<{
        name: string;
        mcpServer: string;
        state: 'done' | 'running' | 'pending';
      }>;
    }>;
  } | null;
  missionLog: Array<{
    id: string;
    type: MissionType;
    tickers: string[];
    status: MissionStatus;
    startedAt: string;
    durationMs: number;
    totalTokens: number;
    totalCostUsd: number;
    langsmithUrl: string | null;
  }>;
  health: Record<string, 'ok' | 'error' | 'degraded'>;
  kb: { entries: number; contradictions: number; tickersTracked: number; lastWrite: string | null };
  queues: { depth: number; alertsPending: number; ticketsPending: number };
}
```

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `POST /auth/login` with valid credentials returns valid JWT (verified by `GET /me`)
- **SC-002**: `POST /auth/login` with wrong password returns 401
- **SC-003**: `GET /me` with expired token returns 401
- **SC-004**: `POST /admin/users` without admin JWT returns 403
- **SC-005**: `GET /api/admin/status` returns correct `AdminStatusResponse` shape with all 9 agents
- **SC-006**: Rate limiter returns 429 after exceeding configured limit
- **SC-007**: All auth + admin integration tests pass with real DB (testcontainers)
