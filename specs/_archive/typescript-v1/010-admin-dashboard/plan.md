# Implementation Plan: Admin Dashboard Mission Control

**Branch**: `010-admin-dashboard` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-admin-dashboard/spec.md`

## Summary

Implement an admin-only Mission Control dashboard as a new frontend app that consumes existing authenticated admin/status and trigger endpoints, delivers near-real-time visibility for all 9 agents and active mission pipeline, and provides deterministic operator actions (config reload, screener trigger, watchdog trigger) while preserving strict security and resilience behavior.

## Scope Preservation (From Original Manual Spec)

The following points are mandatory carryover details and must remain explicit in implementation tasks:

- **Dashboard purpose and fidelity**:
  - Preserve Mission Control positioning as the primary admin observability surface.
  - Preserve visual/state fidelity with `docs/dashboard-reference.html`.
- **Refresh and resilience behavior**:
  - Preserve fixed 3-second polling cadence for status updates.
  - Preserve pause-on-hidden / resume-on-visible polling behavior.
  - Preserve last-known-data behavior during transient connectivity failure.
- **Security/session behavior**:
  - Preserve admin-only access gating.
  - Preserve in-memory access-token client posture and cookie-based renewal flow.
  - Preserve deterministic session-clear and sign-in redirect on authorization loss.
- **Operational coverage**:
  - Preserve all 9 agent cards and active mission pipeline visibility.
  - Preserve health, queue, KB, and spend panels in one dashboard.
  - Preserve admin action scope: config reload, screener trigger, watchdog trigger.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: React 18, Vite 5, React Router 6, native Fetch API, existing API auth/session contracts, Vitest  
**Storage**: Browser memory state (session/status cache), backend PostgreSQL/Redis via existing API (no new persistence in 010)  
**Testing**: Vitest + jsdom for UI/unit logic, API contract tests for integration boundaries, offline with mocked fetch responses  
**Target Platform**: Desktop web browsers in local dev and Dockerized deployment  
**Project Type**: Monorepo web frontend app + API integration (no new backend domain model required)  
**Performance Goals**: Dashboard reflects status changes within one polling interval and keeps interactive operations responsive under normal admin load  
**Constraints**: No hardcoded secrets/magic values, admin-only route protection, no websocket transport for 010, no localStorage token persistence, offline-testable behavior  
**Scale/Scope**: One new `apps/dashboard` SPA with auth shell, status polling, mission/agent/health/spend views, and admin action controls

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Dashboard consumes runtime-configured backend behavior; no dashboard-only behavioral constants that should be runtime config.
- **Agent Boundaries**: PASS. Dashboard is observability/control UI only; no agent reasoning role leakage.
- **MCP Server Independence**: PASS. Dashboard reads aggregated API status and does not call MCP servers directly.
- **Cost Observability**: PASS. Dashboard visualizes existing mission/AgentRun cost accounting from API status snapshot.
- **Fail-Safe Defaults**: PASS. Auth failure clears session; polling failures degrade gracefully with explicit operator signal.
- **Test-First Where Practical**: PASS. Polling, auth gate, panel rendering, and action feedback are all offline-testable via mocks.
- **Simplicity Over Cleverness**: PASS. Polling-based status updates; no websocket/event-stream complexity added.

## Project Structure

### Documentation (this feature)

```text
specs/010-admin-dashboard/
|- plan.md
|- research.md
|- data-model.md
|- quickstart.md
|- decisions.md
|- contracts/
|  |- admin-dashboard-contracts.md
`- tasks.md
```

### Source Code (repository root)

```text
apps/
|- api/
|  `- src/
|     |- app.ts                               # ensure admin route registration/guards remain correct
|     |- routes/
|     |  |- admin.ts                          # admin status/config/users endpoints
|     |  |- screener.ts                       # manual screener trigger endpoint
|     |  `- watchdog.ts                       # manual watchdog trigger endpoint
|     `- lib/
|        `- status-aggregation.ts             # dashboard status snapshot source contract
`- dashboard/
   |- package.json
   |- tsconfig.json
   |- index.html
   `- src/
      |- main.tsx
      |- app/
      |  |- App.tsx
      |  |- router.tsx
      |  `- styles.css
      |- auth/
      |  |- AuthProvider.tsx
      |  |- LoginPage.tsx
      |  `- session.ts
      |- status/
      |  |- useAdminStatus.ts
      |  |- status-types.ts
      |  `- status-client.ts
      |- dashboard/
      |  |- DashboardPage.tsx
      |  |- AgentFloor.tsx
      |  |- MissionPipeline.tsx
      |  |- HealthPanel.tsx
      |  |- SpendPanel.tsx
      |  |- MissionLog.tsx
      |  `- AdminActions.tsx
      `- __tests__/
         |- auth.test.tsx
         |- status-polling.test.tsx
         |- mission-pipeline.test.tsx
         |- actions.test.tsx
         `- dashboard-rendering.test.tsx
```

**Structure Decision**: Add a dedicated `apps/dashboard` SPA so admin UX, session handling, and status polling are isolated from API/server concerns while reusing existing backend contracts from features 003/008.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Polling cadence and visibility-aware lifecycle behavior
- Secure admin session handling pattern for in-memory access context
- Status-snapshot rendering strategy for mission/agent/health/spend sections
- Deterministic action-feedback pattern for trigger/reload controls
- Contract-first alignment with existing admin/status API surface

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/admin-dashboard-contracts.md](./contracts/admin-dashboard-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)
- Preserved implementation decisions: [decisions.md](./decisions.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (dashboard behavior derives from API/runtime contracts; no hidden configuration).
- **Agent Boundaries**: PASS (UI only monitors and triggers approved actions).
- **MCP Server Independence**: PASS (consumes API aggregate instead of direct MCP traffic).
- **Cost Observability**: PASS (spend data sourced from existing AgentRun aggregation).
- **Fail-Safe Defaults**: PASS (401 path clears auth state; polling failures explicitly surfaced).
- **Test-First Where Practical**: PASS (offline test matrix defined for auth, polling, rendering, and actions).
- **Simplicity Over Cleverness**: PASS (fixed polling; no websocket complexity).

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.

## Manual Detail Preservation (Non-Negotiable)

The following manual details are preserved explicitly and must be reflected in tasks/implementation:

- 3-second status polling cadence and visibility pause/resume lifecycle.
- Session renewal lead window of 60 seconds before expiry.
- 4-column dashboard shell equivalent to `280px 1fr 200px 180px`.
- Agent card 3-zone structure equivalent to `84px 1fr auto`.
- Full 9-agent floor and active mission pipeline visualization behavior.
- Pipeline/tool state visuals (running spinner, done/pending dots, pulsing active ring).
- Health panel baseline showing 10 service slots (postgres, redis, 6 MCP, LM Studio, telegram-bot).
- Spend panel baseline rows for Anthropic, OpenAI, Azure, LM Studio.
- Mission log baseline for last 10 completed/failed missions with LangSmith link when available.
- Deterministic admin action feedback for config reload and manual triggers.
- Visual fidelity to `docs/dashboard-reference.html` state semantics and tokens.
- Original manual snapshot retained at `specs/010-admin-dashboard/manual-spec-original.md`.

Any deviation requires documented rationale and explicit compatibility handling.
