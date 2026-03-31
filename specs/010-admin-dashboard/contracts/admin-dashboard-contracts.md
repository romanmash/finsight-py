# Admin Dashboard Contracts (010)

## Purpose

Defines frontend/backend contracts used by the admin dashboard experience.

## Authentication and Access Contracts

### Dashboard Access Preconditions

- Protected dashboard views require authenticated principal with `role=admin`.
- Non-admin or unauthenticated requests must be denied by existing API middleware contract.

### Session Failure Behavior

- Any protected request returning authorization failure must force client session-clear and sign-in redirect.

## Status Contract

### `GET /api/admin/status`

- **Auth**: admin required
- **Response 200**: `AdminStatusSnapshot`

```json
{
  "generatedAt": "2026-03-31T21:00:00.000Z",
  "degraded": false,
  "agents": {
    "manager": {
      "state": "active",
      "currentTask": "classifying mission",
      "currentMissionId": "mission_123",
      "model": "gpt-4o",
      "provider": "openai",
      "todayTokensIn": 1200,
      "todayTokensOut": 800,
      "todayCostUsd": 0.084,
      "lastActiveAt": "2026-03-31T20:59:54.000Z",
      "errorMessage": null
    }
  },
  "spend": {
    "todayTotalUsd": 2.31,
    "byProvider": {
      "openai": 1.2,
      "anthropic": 1.11,
      "lmstudio": 0
    }
  },
  "mission": {
    "active": {
      "id": "mission_123",
      "type": "comparison",
      "status": "running",
      "tickers": ["NVDA", "AMD"],
      "trigger": "user",
      "createdAt": "2026-03-31T20:59:49.000Z"
    },
    "recent": []
  },
  "health": {
    "postgres": { "status": "ok", "message": null, "checkedAt": "2026-03-31T21:00:00.000Z" },
    "redis": { "status": "ok", "message": null, "checkedAt": "2026-03-31T21:00:00.000Z" },
    "mcpServers": {},
    "lmStudio": { "status": "degraded", "message": "timeout", "checkedAt": "2026-03-31T21:00:00.000Z" },
    "telegramBot": { "status": "ok", "message": null, "checkedAt": "2026-03-31T21:00:00.000Z" }
  },
  "kb": {
    "totalEntries": 100,
    "contradictionCount": 3,
    "lastWriteAt": "2026-03-31T20:58:11.000Z",
    "tickersTracked": 27
  },
  "queues": {
    "depths": {
      "watchdogScan": 0,
      "screenerScan": 1,
      "dailyBrief": 0,
      "earningsCheck": 0,
      "ticketExpiry": 0,
      "alertPipeline": 2
    },
    "pendingAlerts": 2,
    "pendingTickets": 0
  },
  "errors": []
}
```



### Agent Snapshot Completeness Contract

- `agents` MUST include all 9 agent keys (`manager`, `watchdog`, `screener`, `researcher`, `analyst`, `technician`, `bookkeeper`, `reporter`, `trader`) in every successful snapshot.
- Each agent entry MUST include state/task/model/provider/token/cost fields required by the dashboard floor.
- Contract examples may abbreviate payloads for readability, but implementation must validate full-key presence.

## Admin Action Contracts

### `POST /api/admin/config/reload`

- **Auth**: admin required
- **Success**: `200` with changed key list

```json
{ "changed": ["auth", "agents"] }
```

### `POST /api/screener/trigger`

- **Auth**: admin required
- **Success**: `202` accepted / enqueued

```json
{ "queued": true }
```

### `POST /api/watchdog/trigger`

- **Auth**: admin required
- **Success**: `202` accepted / enqueued

```json
{ "queued": true }
```

## UI Behavior Contracts

### Polling Cadence

- Poll status every 3000ms while tab is visible.
- Pause polling when document visibility is hidden.
- Resume polling immediately when visibility returns.

### Connectivity Degradation

- On transient status fetch failure:
  - retain and render last-known snapshot,
  - show degraded connection indicator,
  - continue retrying on next interval.
- Degraded connection state affects status freshness only; it does not disable admin action controls by itself.

### Mission Pipeline Source-of-Truth

- Pipeline step and tool-call states are API-provided source-of-truth fields.
- Dashboard must not infer synthetic running/completed states beyond explicit payload values.

### Deterministic Action Feedback

- Each admin action must surface explicit success/failure feedback.
- Failure feedback must include actionable message returned by API envelope when available.
- Action feedback classes MUST normalize to `success`, `retriable_error`, or `terminal_error`.
- Reload success payload includes changed key list (`changed[]`).
- Trigger success payload includes enqueue confirmation (`queued=true`) and optional identifier when provided upstream.
- Timeout failures MUST be mapped to retriable feedback class with retry guidance.


## Preserved Fidelity Contracts

### Session Renewal Contract

- Client must attempt renewal when access context is within 60 seconds of expiry.
- Renewal failure on protected flows must clear session context and route to sign-in.

### Mission Log Contract

- Mission log displays last 10 completed/failed missions.
- If a mission has a trace URL, UI exposes LangSmith drill-down link.

### Health Panel Contract (10-slot baseline)

- Health panel must represent the following slots:
  - postgres
  - redis
  - six MCP service entries
  - lmStudio
  - telegramBot

### Spend Panel Baseline Providers

- UI baseline includes rows for:
  - anthropic
  - openai
  - azure
  - lmstudio

### Visual-State Contract Snapshot

- Dashboard UI MUST remain visually consistent with `docs/dashboard-reference.html` for layout hierarchy, state semantics, and interaction tone.
- Dashboard shell grid equivalent to `280px 1fr 200px 180px`.
- Agent card internal grid equivalent to `84px 1fr auto`.
- `active` agent state uses green accent + light green background (`#f7fffc`).
- `queued` agent state uses amber accent + light amber background (`#fffdf7`).
- Running tool call uses CSS spinner with top border transparent and ~0.8s rotation.
