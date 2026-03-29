# Feature Specification: Admin Dashboard

**Feature**: `010-admin-dashboard`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/constitution.md`](../../.specify/constitution.md)
**Depends on**: `003-api-auth`, `008-orchestration`

## Overview

Implement the React SPA admin dashboard ("Mission Control") as a Vite-powered frontend. The dashboard matches `docs/dashboard-reference.html` exactly and provides real-time visibility into all 9 agents, active missions with pipeline visualization, system health, spend tracking, and admin tools. The dashboard polls `GET /api/admin/status` every 3 seconds — no WebSockets.

**Why this feature exists:** The admin dashboard is the "wow factor" of the demo. It visualizes all 9 agents working in real-time, showing tool calls spinning, pipeline steps progressing, and costs accruing. A potential employer reviewing a screen recording of this dashboard instantly understands the system's sophistication.

---

## User Scenarios & Testing

### User Story 1 — Login & Auth (Priority: P1)

As an admin, I want to log in to the dashboard and have my session persist so that I can monitor the system without re-authenticating.

**Why P1**: Dashboard is useless without auth. JWT management is required for all API calls.

**Independent Test**: Open the dashboard, verify login page appears. Enter valid admin credentials, verify redirect to dashboard. Close and reopen the tab, verify session persists via refresh token.

**Acceptance Scenarios**:

1. **Given** no JWT in memory, **When** the dashboard loads, **Then** the login page is displayed
2. **Given** valid admin credentials, **When** I submit the login form, **Then** the dashboard loads with all 9 agent cards
3. **Given** a valid session, **When** the access token is about to expire (< 1 minute), **Then** the client automatically refreshes it using the httpOnly refresh cookie
4. **Given** the refresh token is expired, **When** the client tries to refresh, **Then** the user is redirected to login
5. **JWT stored in memory only** (NOT localStorage) — per constitution security constraints

---

### User Story 2 — Agent Floor (Priority: P1)

As an admin, I want to see all 9 agents with their current state, model, and cost so that I know exactly what's happening across the platform at a glance.

**Why P1**: The agent floor is 25% of the dashboard layout and the most visually distinctive element.

**Independent Test**: Run a mission, verify the active agent's card shows green border, current task, and updating token count.

**Acceptance Scenarios**:

1. **Given** all 9 agents, **When** the dashboard loads, **Then** each agent displays: name, model, provider, state dot, current task, today's cost
2. **Given** an agent is `active`, **Then** its card has a green left border (2.5px) and light green background (`#f7fffc`)
3. **Given** an agent is `queued`, **Then** its card has an amber left border and light amber background (`#fffdf7`)
4. **Given** an agent is `idle`, **Then** its card has no border accent and default background
5. **Given** an agent is `error`, **Then** its card has a red left border and light red background
6. **Agent cards update every 3 seconds** as status polling refreshes

---

### User Story 3 — Active Mission Pipeline (Priority: P1)

As an admin, I want to see the active mission's pipeline with step progression and tool call spinners so that I can watch the system work in real-time.

**Why P1**: The pipeline visualization is the centerpiece of the demo — it shows the agentic architecture in motion.

**Independent Test**: Trigger a comparison mission, watch the pipeline show: Manager (done) → Researcher×2 (active with tool spinners) → Analyst (pending) → Bookkeeper (pending) → Reporter (pending).

**Acceptance Scenarios**:

1. **Given** no active mission, **When** the dashboard loads, **Then** the mission panel shows "No active mission"
2. **Given** an active mission, **When** displayed, **Then** it shows: type, tickers, trigger, elapsed time, and a vertical pipeline
3. **Given** a pipeline step with state `done`, **Then** its node is a solid green circle and label is dimmed
4. **Given** a pipeline step with state `running`, **Then** its node has a pulsing green ring (`box-shadow: 0 0 0 2.5px var(--green-ring)`) and it expands to show tool calls
5. **Given** a tool call with state `running`, **Then** it shows a CSS spinner (border-top-color transparent, 0.8s rotation)
6. **Given** a tool call with state `done`, **Then** it shows a filled green dot
7. **Given** a tool call with state `pending`, **Then** it shows an empty grey dot

---

### User Story 4 — System Health & Stats (Priority: P1)

As an admin, I want to see system health, KB stats, queue depths, and model routing status so that I can verify the platform is operating correctly.

**Why P1**: Health monitoring is essential for the demo — green dots across the health panel proves the entire stack is running.

**Independent Test**: Verify health panel shows green dots for all 10 services (postgres, redis, 6 MCP servers, LM Studio, Telegram).

**Acceptance Scenarios**:

1. **Given** all services are healthy, **Then** the health grid shows green dots for all 10 services
2. **Given** a service health check fails, **Then** its dot turns red and service name shows in error state
3. **Given** KB has entries, **Then** the stats panel shows: entry count, contradictions, tickers tracked, last write time
4. **Given** BullMQ has pending jobs, **Then** queue depth is displayed with amber styling if > 0

---

### User Story 5 — Spend Tracking (Priority: P1)

As an admin, I want to see today's spend broken down by provider with a budget bar so that I can monitor cost in real-time.

**Why P1**: Cost visibility is a key demo talking point — it shows the system's multi-provider economics.

**Independent Test**: After running a mission, verify the spend panel shows correct per-provider breakdown and budget percentage.

**Acceptance Scenarios**:

1. **Given** today's spend data, **Then** the panel shows total, per-provider breakdown (Anthropic, OpenAI, Azure, LM Studio), and daily budget
2. **Given** LM Studio costs, **Then** they show as $0.000 with green styling (free local inference)
3. **Given** spend is 17% of budget, **Then** the budget bar fills to 17% width

---

### User Story 6 — Admin Tools (Priority: P2)

As an admin, I want action buttons for user management, config reload, and manual triggers so that I can control the system from the dashboard.

**Why P2**: Admin tools are convenience features — the same actions can be done via curl.

**Acceptance Scenarios**:

1. **Given** "Reload config" is clicked, **When** `POST /admin/config/reload` succeeds, **Then** a toast shows the changed config keys
2. **Given** "Trigger Screener" is clicked, **When** `POST /api/screener/trigger` succeeds, **Then** a toast confirms "Screener scan enqueued"
3. **Given** "Trigger Watchdog" is clicked, **When** `POST /api/watchdog/trigger` succeeds, **Then** a toast confirms "Watchdog scan enqueued"

---

### Edge Cases

- What if polling returns an error? → Show last-known data with "⚠ Connection lost" indicator
- What if the tab is hidden (minimized)? → Stop polling (visibilitychange event), resume when visible
- What if two missions run concurrently? → `activeMission` shows the most recent. Mission log shows both.
- What if no missions have ever run? → Mission log is empty, active mission is null, agents show idle

---

## Requirements

### Functional Requirements

- **FR-001**: React SPA built with Vite, no CSS framework (vanilla CSS matching `dashboard-reference.html` exactly)
- **FR-002**: 4-column CSS grid layout: `280px 1fr 200px 180px`
- **FR-003**: `useAdminStatus` hook MUST poll `GET /api/admin/status` every 3000ms
- **FR-004**: Polling MUST stop when tab is not visible (visibilitychange event) and resume on focus
- **FR-005**: On 401 response: MUST clear auth context and redirect to login
- **FR-006**: AgentCard MUST render 3-zone grid: `84px 1fr auto` with left border accent
- **FR-007**: PipelineView MUST render vertical step list with done/active/pending states
- **FR-008**: ToolCallList MUST render CSS spinners for running tools
- **FR-009**: Auth context MUST store JWT in memory only (NOT localStorage)
- **FR-010**: Refresh token handling MUST use httpOnly cookies
- **FR-011**: Access token MUST be refreshed automatically 1 minute before expiry
- **FR-012**: Mission log MUST show last 10 completed/failed missions with LangSmith links

---

## Visual Specification

The complete visual specification is defined in [`docs/dashboard-reference.html`](../../docs/dashboard-reference.html). Key design tokens:

| Token | Value | Usage |
|---|---|---|
| `--green` | `#1D9E75` | Active state, health ok |
| `--green-bg` | `#E1F5EE` | Active pill background |
| `--green-ring` | `#9FE1CB` | Active pipeline node ring |
| `--amber` | `#EF9F27` | Queued state, warnings |
| `--red` | `#E24B4A` | Error state |
| `--blue` | `#185FA5` | Spend values, links |
| Active card bg | `#f7fffc` | Agent card active |
| Queued card bg | `#fffdf7` | Agent card queued |
| Border accent | `2.5px solid` | Agent card left border |

---

## Success Criteria

- **SC-001**: Login page appears when no JWT in memory
- **SC-002**: After login, dashboard loads with 9 agent cards
- **SC-003**: Agent cards update every 3 seconds
- **SC-004**: Active agent shows green border and green background
- **SC-005**: Active mission pipeline shows tool call spinner for running tools
- **SC-006**: Spend panel shows correct per-provider breakdown
- **SC-007**: "Trigger Screener" button works and shows feedback
- **SC-008**: "Reload Config" button works and shows changed keys
