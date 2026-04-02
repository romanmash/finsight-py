# Orchestration Contracts (008)

## Purpose

Define canonical orchestration interfaces and invariants for manager routing, route behavior, and worker-triggered mission dispatch.

## Core Mission Types

- `operator_query`
- `alert_investigation`
- `comparison`
- `devil_advocate`
- `pattern_request`
- `earnings_prebrief`
- `trade_request`
- `daily_brief`

## Manager Routing Contract

### Input

```ts
interface ManagerInput {
  userId?: string;
  missionId: string;
  message?: string;
  tickers?: string[];
  triggerType: 'user' | 'scheduled' | 'alert';
  context?: Record<string, unknown>;
}
```

### Output

```ts
interface ManagerOutput {
  missionType: MissionType;
  response: string;
  trigger: 'pipeline' | 'kb_fast_path';
  stepsExecuted: string[];
  traceUrl?: string;
}
```

### Invariants

- Manager classifies and routes only; it does not generate investment reasoning content.
- Mission type must map to explicit routing table pipeline.
- Comparison requires exactly two complete research branches (matching 007 comparison contract).
- Low-confidence re-dispatch may occur at most once when policy enabled.

## Mission-Type Pipeline Contract

| Mission Type | Pipeline |
|---|---|
| `operator_query` | KB fast-path check -> Researcher -> Analyst -> Bookkeeper -> Reporter |
| `alert_investigation` | Researcher -> Analyst -> (optional Technician) -> Bookkeeper -> Reporter |
| `comparison` | Researcher x2 (parallel) -> Analyst (comparison) -> Bookkeeper x2 -> Reporter |
| `devil_advocate` | Researcher -> Analyst (devil_advocate) -> Bookkeeper -> Reporter |
| `pattern_request` | Technician -> Reporter |
| `earnings_prebrief` | Researcher -> Analyst -> Bookkeeper -> Reporter |
| `trade_request` | Researcher -> Analyst -> Bookkeeper -> Trader -> Reporter |
| `daily_brief` | Researcher xN -> Analyst xN -> Bookkeeper xN -> Reporter |

## API Route Contracts

### `POST /api/chat`

Request:

```ts
interface ChatRequest {
  message: string;
  ticker?: string;
}
```

Response:

```ts
interface ChatResponse {
  missionId: string;
  response: string;
}
```

### `GET /api/missions`

- Returns role-scoped mission list.

### `GET /api/missions/:id`

- Returns mission + agent run telemetry + trace metadata when available.

### `GET /api/kb/search`

- Returns KB search results by query term with pagination constraints.

### `GET /api/kb/thesis/:ticker`

- Returns current thesis snapshot for instrument.

### `GET /api/kb/history/:ticker`

- Returns thesis history snapshots for instrument.

### `GET/PUT /api/portfolio`

- Returns and updates authenticated user's portfolio state.

### `GET/POST/DELETE /api/watchlist`

- Returns and mutates authenticated user's watchlist.

### `GET /api/alerts`

- Returns unacknowledged alerts for caller scope.

### `POST /api/alerts/:id/ack`

- Acknowledges alert if caller has access.

### `GET /api/tickets`

- Returns pending ticket proposals by role scope.

### `POST /api/tickets/:id/approve`

- Approves pending ticket only; rejects finalized tickets.

### `POST /api/tickets/:id/reject`

- Rejects pending ticket only; rejects finalized tickets.

### `GET /api/briefs/latest`

- Returns latest brief for authenticated user.

### `GET /api/screener/summary`

- Returns latest screener summary for authenticated user scope.

## Worker Trigger Contracts

### Alert Pipeline Worker

```ts
interface AlertPipelineTrigger {
  alertId: string;
  userId?: string;
  ticker?: string;
  severity: 'low' | 'medium' | 'high';
}
```

- Must create mission and execute alert-investigation pipeline through manager path.

### Daily Brief Worker

```ts
interface DailyBriefTrigger {
  date: string;
  targetUserIds: string[];
}
```

- Must create daily-brief missions for active users only.

### Earnings Worker

```ts
interface EarningsTrigger {
  date: string;
  tickers: string[];
}
```

- Must emit alert-worthy missions for relevant earnings events.

## Compatibility Contract Requirements (006/007)

- Consume 006 collector contracts by published shapes only.
- Enforce screener trigger provenance: `scheduled|manual`.
- Treat `TechnicalCollectionOutput.confidence` as numeric `[0,1]`.
- Preserve 006 alert-context minimum fields when forwarding alert-investigation missions: `instrument`, `signalType`, `triggerValue`, `thresholdValueOrEvent`, `snapshotTimestamp`, `evidenceSummary`.
- Preserve 006/007 discovery evidence headline semantics: `supportingHeadline` (never `topHeadline`).
- Preserve 007 reasoning mode semantics (`standard`, `devil_advocate`, `comparison`) and proposal-only trade boundary.
- Contract-breaking changes require synchronized 006/007/008 spec updates.



