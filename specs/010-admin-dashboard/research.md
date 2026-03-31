# Research: Admin Dashboard Mission Control (010)

## Decision 1: Status refresh model uses fixed-interval polling with visibility-aware pause/resume

- **Decision**: Use a 3-second polling loop for `admin/status` and pause polling while document visibility is hidden; resume immediately on visibility restoration.
- **Rationale**: Aligns with constitution simplicity principle (polling over websocket), reduces unnecessary load when tab is backgrounded, and preserves operator expectation for near-real-time updates.
- **Alternatives considered**:
  - WebSockets/SSE: rejected for added complexity and out-of-scope transport change.
  - Longer polling interval (5-10s): rejected due to weaker mission-floor responsiveness.

## Decision 2: Session model keeps access context in memory and relies on server-managed renewal

- **Decision**: Keep access authorization context only in runtime memory and rely on secure backend session renewal path; on renewal/auth failure, clear session and route to login.
- **Rationale**: Matches constitution security constraints and prevents durable token persistence in browser storage.
- **Alternatives considered**:
  - localStorage persistence: rejected due to constitution and XSS risk profile.
  - per-request manual login prompts: rejected due to poor operational UX.

## Decision 3: Dashboard data model is read-optimized projection of existing API snapshot

- **Decision**: Treat dashboard state as a projection of `AdminStatusSnapshot` with UI-only derived fields (display state, formatting, badges) and no new backend persistence entities.
- **Rationale**: Prevents duplicate source-of-truth problems and keeps 010 focused on presentation/control, not data-domain expansion.
- **Alternatives considered**:
  - New dashboard-specific backend tables: rejected as unnecessary complexity.
  - Client-side synthetic mission model detached from API: rejected due to drift risk.

## Decision 4: Admin actions remain explicit command endpoints with deterministic feedback

- **Decision**: Use existing approved endpoints for config reload and manual queue triggers; render explicit success/failure toasts/messages tied to API acknowledgment.
- **Rationale**: Clear operator trust model, easy auditability, and minimal coupling.
- **Alternatives considered**:
  - Silent action execution with implicit UI refresh only: rejected due to weak operator feedback.
  - Bundled "multi-action" endpoint: rejected as unnecessary for current scope.

## Decision 5: Visual fidelity is preserved via reference-token mapping, not hardcoded ad hoc styling

- **Decision**: Map key reference states/tokens from `docs/dashboard-reference.html` into dashboard style variables/components and preserve semantic states (active/queued/idle/error, running/done/pending tool calls).
- **Rationale**: Preserves manual design intent while keeping implementation maintainable.
- **Alternatives considered**:
  - Generic dashboard theme replacement: rejected because it loses demonstration intent.
  - Pixel-perfect CSS lock-in without semantic mapping: rejected due to maintainability risk.

## Decision 6: Contract baseline is existing API surface from features 003/008/009

- **Decision**: Build 010 against established API contracts:
  - `GET /api/admin/status`
  - `POST /api/admin/config/reload`
  - `POST /api/screener/trigger`
  - `POST /api/watchdog/trigger`
  - existing auth/session endpoints used by admin flows
- **Rationale**: Keeps scope aligned with spec out-of-scope boundaries and avoids backend re-architecture.
- **Alternatives considered**:
  - New dashboard-only aggregate endpoints: rejected unless required by later performance profiling.
