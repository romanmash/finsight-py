# Feature Specification: Admin Dashboard Mission Control

**Feature Branch**: `010-admin-dashboard`
**Created**: 2026-03-28
**Status**: Draft
**Input**: User description: "Manual draft for admin dashboard feature; canonicalize and preserve important implementation decisions"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Access and Session Continuity (Priority: P1)

As an administrator, I want to sign in and stay authenticated during normal use so that I can continuously monitor and control the platform.

**Why this priority**: Without secure access and stable session behavior, the dashboard cannot be used safely.

**Independent Test**: Start unauthenticated, verify sign-in is required, then sign in with valid admin credentials and verify continued access until session expiration conditions occur.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user opens the dashboard, **When** the page loads, **Then** the user is shown a sign-in flow before any admin data is displayed.
2. **Given** valid administrator credentials are submitted, **When** authentication succeeds, **Then** the dashboard loads and admin data becomes visible.
3. **Given** an active admin session, **When** token renewal succeeds, **Then** dashboard usage continues without manual re-authentication.
4. **Given** session renewal fails or authorization is revoked, **When** the next protected request is evaluated, **Then** access is cleared and the user is returned to sign-in.

---

### User Story 2 - Live Agent and Mission Visibility (Priority: P1)

As an administrator, I want a real-time view of all agents and the active mission pipeline so that I can understand current system behavior and progression.

**Why this priority**: Mission and agent visibility is the primary operational purpose of the dashboard.

**Independent Test**: Trigger a mission and verify agent activity states, mission metadata, and pipeline-step transitions are reflected in the dashboard refresh cycle.

**Acceptance Scenarios**:

1. **Given** the dashboard is active, **When** status data is refreshed, **Then** all agents display current state, assigned activity, and current run context.
2. **Given** an active mission exists, **When** mission details are rendered, **Then** mission type, trigger, elapsed time, and ordered pipeline steps are visible.
3. **Given** a pipeline step is running, **When** associated tool calls are shown, **Then** running, completed, and pending tool call states are distinguishable.
4. **Given** no active mission exists, **When** the mission panel renders, **Then** an explicit no-active-mission state is displayed.

---

### User Story 3 - Operational Health and Spend Oversight (Priority: P1)

As an administrator, I want service health, queue pressure, knowledge-base indicators, and daily spend in one place so that I can assess platform risk and cost quickly.

**Why this priority**: Operational readiness and budget awareness are required for safe day-to-day operations.

**Independent Test**: Provide healthy and degraded status snapshots and verify that service health, queue backlog, knowledge signals, and spend breakdown are accurately represented.

**Acceptance Scenarios**:

1. **Given** service-status data is available, **When** health indicators are shown, **Then** each monitored subsystem is represented with clear healthy/degraded state.
2. **Given** queue backlog exists, **When** queue metrics are displayed, **Then** non-zero backlog is visibly highlighted.
3. **Given** daily spend data is returned, **When** the spend panel updates, **Then** total spend, provider breakdown, and budget utilization are shown.
4. **Given** local-inference provider usage has zero billed cost, **When** costs are displayed, **Then** those values are shown as zero-cost entries without inflating budget usage.

---

### User Story 4 - Admin Control Actions (Priority: P2)

As an administrator, I want to run approved operational actions from the dashboard so that I can perform common interventions quickly.

**Why this priority**: Actions improve operational efficiency but are secondary to visibility and monitoring.

**Independent Test**: Execute each exposed admin action and verify deterministic success/failure feedback is shown to the admin.

**Acceptance Scenarios**:

1. **Given** configuration reload is triggered, **When** the action succeeds, **Then** the dashboard confirms completion with a summary of applied changes.
2. **Given** a manual screener trigger is requested, **When** the request is accepted, **Then** a confirmation message indicates enqueue success.
3. **Given** a manual watchdog trigger is requested, **When** the request is accepted, **Then** a confirmation message indicates enqueue success.
4. **Given** an action fails, **When** the failure response is received, **Then** the dashboard displays actionable error feedback without breaking the rest of the interface.

---

### User Story 5 - Resilient Polling Behavior (Priority: P2)

As an administrator, I want the dashboard to degrade gracefully during transient connectivity issues so that monitoring remains trustworthy.

**Why this priority**: Availability interruptions are expected in real systems; graceful handling is required for operational confidence.

**Independent Test**: Simulate temporary status-endpoint failures and tab visibility changes, then verify last-known data behavior, reconnect signaling, and polling pause/resume.

**Acceptance Scenarios**:

1. **Given** status refresh temporarily fails, **When** retries continue, **Then** the dashboard retains last-known values and clearly indicates degraded connectivity.
2. **Given** the dashboard tab becomes non-visible, **When** visibility changes, **Then** active polling is paused.
3. **Given** the dashboard tab becomes visible again, **When** visibility is restored, **Then** polling resumes automatically.
4. **Given** concurrent mission activity exceeds single-panel capacity, **When** mission data is refreshed, **Then** active and historical mission context remain comprehensible without data loss.

### Edge Cases

- Authentication succeeds but authorization is insufficient for admin endpoints.
- Status payload is partial (some subsystems report, others time out).
- Polling recovers after multiple consecutive failures.
- Mission transitions from running to completed between two refresh cycles.
- No historical missions exist yet.
- One or more monitored services are intentionally offline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST restrict dashboard access to authenticated administrators before protected data is rendered.
- **FR-002**: The system MUST support session continuity behavior that renews authorization before normal expiry and cleanly revokes UI access when renewal fails.
- **FR-003**: The system MUST provide a dashboard status view that includes all 9 agents with their current operational state.
- **FR-004**: The system MUST provide an active mission panel with mission metadata and ordered pipeline progression.
- **FR-005**: The system MUST represent per-step and per-tool execution states in the mission pipeline as distinct visual states.
- **FR-006**: The system MUST refresh dashboard status every 3000ms while the dashboard tab is visible.
- **FR-007**: The system MUST pause background refresh while the dashboard is not visible and resume refresh when visibility returns.
- **FR-008**: The system MUST preserve and display last-known status data during temporary connectivity loss, while showing a degraded-connection indicator in the dashboard header with warning severity and last-success timestamp.
- **FR-009**: The system MUST provide a health panel covering core platform dependencies required for end-to-end operation.
- **FR-010**: The system MUST display operational metrics including queue backlog and knowledge-base summary indicators.
- **FR-011**: The system MUST display daily spend totals, provider-level spend breakdown, and budget utilization.
- **FR-012**: The system MUST expose approved admin control actions for configuration reload and manual operational triggers.
- **FR-013**: The system MUST provide deterministic user feedback classes for each admin action (`success`, `retriable_error`, `terminal_error`) and include structured details when available (`changed[]` for reload and enqueue confirmation identifiers for trigger actions).
- **FR-014**: The system MUST present recent mission history with minimum metadata fields: mission id, mission type, status, trigger source, start time, completion time (if complete), duration, and trace URL when available.
- **FR-015**: The system MUST preserve visual consistency with the approved dashboard reference design for layout, state semantics, and hierarchy.
- **FR-016**: The system MUST treat partial status payloads deterministically: missing subsystem values render as `unknown` without crashing the page and do not erase other valid sections.
- **FR-017**: The system MUST define explicit empty states for both `no active mission` and `no recent missions`.
- **FR-018**: The system MUST treat action endpoint timeout differently from immediate API failure by showing timeout-specific retry guidance while preserving dashboard operability.
- **FR-019**: The system MUST use server-provided expiry context for session-renewal decisions and tolerate browser clock skew without premature logout.
- **FR-020**: Degraded status polling MUST NOT disable admin actions; control actions remain available unless the action endpoint itself fails.
- **FR-021**: Mission pipeline tool-call states are sourced from backend status payloads; the dashboard MUST NOT infer synthetic running/done states not present in payload.
- **FR-022**: If one or more agent entries are missing or malformed, the dashboard MUST still render all 9 slots and mark affected entries as unavailable/error with explicit operator-visible state.
- **FR-023**: Every dashboard-triggered request to protected endpoints MUST re-validate admin authorization and apply session-clear redirect behavior on 401/403.
- **FR-024**: The dashboard MUST satisfy baseline accessibility for keyboard navigation, visible focus states, and semantic status/action announcements.
- **FR-025**: The dashboard MUST keep access credentials in memory only and MUST NOT log tokens, cookies, or raw credential payloads.
- **FR-026**: Polling and action failures MUST be captured in dashboard-side diagnostics with redacted, operator-safe error metadata.
- **FR-027**: Under normal conditions, dashboard UI updates for received snapshots MUST complete within 500ms and keep polling overhead within a bounded single-request cadence.

### Key Entities *(include if feature involves data)*

- **Admin Session Context**: Authentication and authorization state used to gate dashboard access and protected requests.
- **Dashboard Status Snapshot**: Aggregated status payload used to render agents, missions, health, metrics, and spend.
- **Agent Status Card**: Per-agent monitoring item containing identity, state, current activity, and daily cost context.
- **Mission Pipeline Step**: Ordered mission-execution unit containing step state and optional tool-call status set.
- **Health Indicator**: Service-level availability record representing healthy/degraded state for monitored dependencies.
- **Spend Summary**: Daily cost model containing total spend, provider breakdown, and budget-progress context.
- **Admin Action Request**: Operator-initiated command (reload/trigger) and its resulting acknowledgment outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated dashboard visits are gated behind sign-in before protected data is shown.
- **SC-002**: At least 95% of successful admin sign-ins transition to usable dashboard state within 3 seconds under normal load.
- **SC-003**: In controlled mission tests sampled over at least 100 state transitions, dashboard refresh reflects agent or mission-state changes within one 3000ms refresh interval in at least 95% of observed transitions.
- **SC-004**: In degraded-connectivity tests, the dashboard retains last-known status and presents a degraded-connection indicator in 100% of refresh failures.
- **SC-005**: In visibility-change tests, polling pauses when hidden and resumes when visible in 100% of observed tab transitions.
- **SC-006**: 100% of approved admin control actions return explicit success or failure feedback to the operator.
- **SC-007**: In spend-validation tests, displayed total spend and provider breakdown match source status data with absolute variance <= $0.01 per field after rounding to display precision.
- **SC-008**: 100% of dashboards render all 9 agent slots and core health indicators when status data is available.
- **SC-009**: In timeout/failure action tests, 100% of failures are classified into retriable vs terminal feedback classes with non-empty operator guidance text.
- **SC-010**: In partial-payload tests, dashboard continues rendering unaffected sections in 100% of samples while marking missing sections as `unknown` or unavailable.

## Assumptions

- Existing authentication and role-protection contracts from prior features remain authoritative and are reused by this feature.
- A single authoritative status endpoint is available for dashboard polling and already aggregates relevant subsystem data.
- The dashboard feature targets operational desktop usage first; broader responsive UX enhancements can follow in later scope.
- Visual reference artifacts provided by product/architecture are treated as canonical for state semantics and layout intent.
- The status endpoint remains backward compatible for documented 010 fields across dependent features.

## Dependencies

- **Feature 003 (`api-auth`)**: admin authentication, refresh behavior, and role protection contracts.
- **Feature 008 (`orchestration`)**: mission/pipeline status semantics and agent runtime state feed.
- **Feature 009 (`telegram-bot`)**: optional downstream source of mission-trigger context surfaced in mission metadata.

## Operational Definitions

- **Near-real-time**: exactly one refresh request every 3000ms while visible.
- **Degraded connection indicator**: warning-level header signal with last successful snapshot timestamp and non-blocking status text.
- **Deterministic action feedback**: normalized outcome classes (`success`, `retriable_error`, `terminal_error`) with stable operator-facing wording.
- **Visual consistency**: adherence to reference layout zones, state color semantics, component hierarchy, and mission pipeline behavior from `docs/dashboard-reference.html`.

## Out of Scope

- Building new backend monitoring domains beyond the established status and admin-action contracts.
- Replacing polling with real-time push transport.
- End-user (non-admin) dashboard experiences.
- User-management CRUD surfaces in dashboard UI (deferred to a later feature).
- Historical analytics beyond the recent mission window required for operational monitoring.

## Preserved Implementation Details

Important implementation decisions from the original manual draft are intentionally preserved outside the canonical spec in:

- [manual-spec-original.md](./manual-spec-original.md) - immutable snapshot of the original manual spec text.
- [decisions.md](./decisions.md) - explicit preserved implementation decisions and UI/behavior detail handoff for planning.

These preserved details MUST be reflected during planning and tasks generation unless a documented rationale approves deviation.
