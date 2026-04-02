# Data Model: API & Auth (003)

## Overview

This feature introduces API-layer domain objects for authentication, authorization, request tracing, and mission-control status responses. Persistence primitives (`User`, `RefreshToken`, `Mission`, `AgentRun`) come from feature 002; this model defines request/response and state-flow entities built on top of them.

## Entities

### 1) LoginRequest
- **Fields**: `email`, `password`
- **Validation**: non-empty credentials; email format validated at request boundary
- **Used by**: `POST /auth/login`

### 2) AuthSessionTokens
- **Fields**: `accessToken`, `accessExpiresAt`, `refreshSessionId`, `refreshExpiresAt`
- **Validation**: token issuance and expiry windows sourced from runtime auth config; refresh token delivered via httpOnly cookie (not response body persistence in frontend storage)
- **Used by**: login/refresh/logout flows

### 3) AuthenticatedPrincipal
- **Fields**: `userId`, `role`, `email`, `name`, optional Telegram identity fields
- **Validation**: derived only from validated JWT + persisted user state
- **Used by**: auth middleware, role guard, protected route handlers

### 4) ApiUserProfile
- **Fields**: user-visible identity and role fields; never includes password hash
- **Validation**: sanitized response projection
- **Used by**: `/auth/me`, `/admin/users` responses

### 5) RequestContext
- **Fields**: `requestId`, timing metadata, authenticated principal (optional pre-auth)
- **Validation**: requestId created per request and propagated to logs/responses
- **Used by**: middleware chain and error responses

### 6) RateLimitState
- **Fields**: caller identity key, window start, request count, limit threshold
- **Validation**: threshold from runtime config; 429 when exceeded
- **Used by**: rate-limit middleware
- **Failure behavior**: fail-open with warning logs when Redis unavailable

### 7) AdminStatusSnapshot
- **Fields**:
  - agent states (9 slots)
  - spend summary (today total + provider breakdown)
  - active mission + mission log summary
  - dependency health summary
  - KB summary + queue summary
- **Validation**: stable response schema for 3-second polling consumers
- **Used by**: `GET /api/admin/status`
- **Failure behavior**: degraded/partial sections with explicit health markers on dependency failure

### 8) ServiceHealthEntry
- **Fields**: service name, status (`ok`, `degraded`, `error`), optional message/timestamp
- **Used by**: admin status health section and degraded-mode reporting

## State Transitions

### Auth session lifecycle
1. `issued` -> `active` (after login)
2. `active` -> `rotated` (after refresh)
3. `active|rotated` -> `revoked` (after logout/admin invalidation)
4. `active|rotated` -> `expired` (TTL elapsed)

### Request authorization lifecycle
1. `unauthenticated` -> `authenticated` (valid access token)
2. `authenticated` -> `authorized` (role guard passes)
3. `authenticated` -> `forbidden` (role guard fails)
4. `unauthenticated|invalid-token` -> `unauthorized`

### Admin status response lifecycle
1. `full` (all dependencies healthy)
2. `degraded` (one or more dependencies unavailable, partial sections returned)
3. `error-bounded` (timeout budget reached; response still returned with explicit degraded markers)

