# Feature Specification: API & Auth

**Feature Branch**: `003-api-jwt-auth`
**Created**: 2026-04-02
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Operator Logs In and Receives Secure Credentials (Priority: P1)

An operator opens the dashboard or connects via the Telegram bot. They provide their credentials
once. The system verifies their identity and issues a short-lived session token for API access plus
a long-lived refresh credential stored securely in their browser session. The operator can use the
API immediately without re-entering credentials.

**Why this priority**: All other API features depend on authenticated access. Without a working
login flow, no downstream feature can be demonstrated or tested end-to-end.

**Independent Test**: Submit valid credentials to the login endpoint, receive an access token in
the response body and a refresh credential in a secure cookie, call a protected endpoint with the
token, and verify the call succeeds.

**Acceptance Scenarios**:

1. **Given** a registered operator with valid credentials, **When** they submit a login request,
   **Then** the response contains a short-lived access token and a secure cookie is set containing
   a long-lived refresh credential.
2. **Given** an unregistered user or invalid credentials, **When** a login request is submitted,
   **Then** the response returns an authentication failure with no credentials issued.
3. **Given** a valid access token, **When** used on a protected endpoint, **Then** the request
   succeeds and the operator's identity is available to the handler.

---

### User Story 2 — Access Token Refreshes Without Re-Login (Priority: P1)

An operator's short-lived access token expires during a session. The client automatically exchanges
the stored refresh credential for a new access token without requiring the operator to log in
again. The session continues seamlessly.

**Why this priority**: Without silent refresh, operators face frequent interruptions. This is
essential for both the dashboard and the Telegram bot to work reliably.

**Independent Test**: Use an expired access token on a protected endpoint (expect rejection), then
call the token refresh endpoint with a valid refresh credential, receive a new access token, and
use it to successfully call the same endpoint.

**Acceptance Scenarios**:

1. **Given** an expired access token, **When** it is used on a protected endpoint, **Then** the
   request is rejected with an authentication expired error.
2. **Given** a valid refresh credential, **When** the token refresh endpoint is called, **Then**
   a new access token is issued and the refresh credential is rotated.
3. **Given** a revoked or expired refresh credential, **When** the token refresh endpoint is
   called, **Then** the request is rejected and the operator must log in again.

---

### User Story 3 — Admin Routes Are Inaccessible to Viewer-Role Operators (Priority: P1)

A viewer-role operator is authenticated and holds a valid access token. They attempt to call an
admin-only endpoint (such as operator management or system configuration). The request is rejected
with a clear authorisation error — not an authentication error. An admin-role operator calling
the same endpoint succeeds.

**Why this priority**: Role separation is a security requirement. The admin protection mechanism
must work correctly before any admin features are built on top of it.

**Independent Test**: Authenticate as a viewer, call an admin-only endpoint (expect 403), then
authenticate as an admin, call the same endpoint (expect success).

**Acceptance Scenarios**:

1. **Given** a viewer-role operator with a valid access token, **When** they call an admin-only
   endpoint, **Then** the request is rejected with an authorisation error (not an authentication
   error).
2. **Given** an admin-role operator with a valid access token, **When** they call an admin-only
   endpoint, **Then** the request succeeds.
3. **Given** an unauthenticated request (no token), **When** it targets any protected endpoint,
   **Then** the request is rejected with an authentication required error.

---

### User Story 4 — System Health Is Visible Without Authentication (Priority: P2)

An operator, monitoring tool, or container orchestrator calls the health endpoint. It receives a
structured response describing the status of all key subsystems (database, cache, configuration).
No authentication is required to call the health endpoint.

**Why this priority**: Health checks must be accessible to infrastructure tooling that does not
hold credentials. This is a standard operational requirement.

**Independent Test**: Call the health endpoint without any credentials, receive a structured
response, and verify each subsystem's status is reported.

**Acceptance Scenarios**:

1. **Given** all subsystems are running normally, **When** the health endpoint is called, **Then**
   the response indicates all subsystems are healthy with no authentication required.
2. **Given** a subsystem (e.g., database) is unreachable, **When** the health endpoint is called,
   **Then** the response indicates that subsystem is unhealthy while reporting other subsystems
   accurately.

---

### User Story 5 — Repeated Failed Login Attempts Are Rate-Limited (Priority: P2)

An attacker or misconfigured client submits many login requests in rapid succession. After a
threshold is exceeded, subsequent requests from the same origin are rejected for a cooldown
period without processing credentials.

**Why this priority**: Rate limiting on auth endpoints is a basic security hardening measure
required before the system is exposed to any network.

**Independent Test**: Submit login requests rapidly in excess of the configured limit, verify
rejection responses are returned for requests above the threshold, wait for the cooldown, and
verify requests are accepted again.

**Acceptance Scenarios**:

1. **Given** a configured request rate limit on the login endpoint, **When** that limit is exceeded
   within the time window, **Then** subsequent requests are rejected with a rate-limit response
   until the window resets.
2. **Given** a rate-limited origin, **When** the cooldown period elapses, **Then** requests from
   that origin are accepted again.

---

### Edge Cases

- What happens when the refresh credential cookie is missing or corrupted?
- How does the system behave when a token is valid but the referenced operator account is disabled?
- What if concurrent token refresh requests are made with the same refresh credential?
- How are cross-origin requests handled when the dashboard and API run on different ports?
- What if the admin registration endpoint is called when no operators exist yet (bootstrap scenario)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a login endpoint that accepts operator credentials and
  issues a short-lived access token and a long-lived refresh credential stored in a secure,
  httpOnly cookie.
- **FR-002**: The system MUST provide a token refresh endpoint that accepts a valid refresh
  credential and issues a new access token (and rotates the refresh credential).
- **FR-003**: The system MUST provide a logout endpoint that revokes the current refresh
  credential and clears the session cookie.
- **FR-004**: The system MUST protect all non-public endpoints so that requests without a valid
  access token are rejected with an authentication error.
- **FR-005**: The system MUST enforce role-based access control distinguishing at minimum admin
  and viewer roles, with admin-only endpoints rejecting viewer-role tokens with an authorisation
  error.
- **FR-006**: The system MUST expose a health endpoint accessible without authentication that
  reports the status of all key subsystems individually.
- **FR-007**: The system MUST apply rate limiting to login and token refresh endpoints, rejecting
  requests that exceed the configured threshold within a time window.
- **FR-008**: The system MUST return structured, machine-readable error responses for all failure
  cases (authentication failure, authorisation failure, rate limit, validation error).
- **FR-009**: The system MUST allow cross-origin requests from the configured dashboard origin
  while blocking other origins.
- **FR-010**: The system MUST provide a reusable authorisation mechanism that other features can
  apply to protect their endpoints without duplicating security logic.
- **FR-011**: All authentication and authorisation logic MUST be covered by the test suite and
  MUST pass offline without a running server.

### Key Entities

- **Operator**: A registered system user with a role (admin or viewer), credentials, and account
  state. Covered in detail by Feature 002 (Data Layer).
- **AccessToken**: A short-lived, signed credential proving the holder's identity and role. Held
  in memory by the client; never stored server-side.
- **RefreshToken**: A long-lived, opaque credential stored in a secure httpOnly cookie. Server-side
  record allows revocation. Rotated on each use.
- **AuthSession**: The logical session established after login, represented by the combination of
  an active access token and a valid refresh token record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can complete the full login flow (submit credentials, receive token,
  call a protected endpoint) in under 2 seconds under normal conditions.
- **SC-002**: An expired access token is silently refreshed and the original request retried
  without the operator experiencing an interruption.
- **SC-003**: 100% of requests to admin-only endpoints from viewer-role operators are rejected
  with an authorisation error in automated tests.
- **SC-004**: Rate limiting activates within the configured request threshold and cooldown period,
  verified by automated tests without manual timing.
- **SC-005**: The health endpoint responds in under 200 milliseconds under normal operating
  conditions.
- **SC-006**: All authentication and authorisation test cases pass in an offline environment
  without a running server or database.

## Assumptions

- The system is a single-tenant personal tool; there is no public self-registration. New operators
  are created by an existing admin or via a bootstrap command.
- Access tokens are short-lived (15 minutes by default); refresh tokens are long-lived (30 days);
  both durations are configurable in YAML without code changes.
- The dashboard and API may run on different origins during development; CORS is configured to
  permit the dashboard origin explicitly.
- The Telegram bot authenticates to the API using a dedicated service credential stored in `.env`,
  not a human operator session.
- Token revocation on logout is best-effort for access tokens (short TTL makes forced invalidation
  unnecessary); refresh token revocation is guaranteed via the database record.
- The bootstrap scenario (first admin creation) is handled by a CLI command or seed script, not
  a public API endpoint, to prevent accidental exposure.
