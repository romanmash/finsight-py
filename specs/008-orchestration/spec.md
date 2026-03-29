# Feature Specification: Orchestration

**Feature**: `008-orchestration`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/constitution.md`](../../.specify/constitution.md)
**Depends on**: `006-collector-agents`, `007-reasoning-agents`

## Overview

Implement the Manager agent — the single entry point for all mission orchestration. Create all remaining API routes (chat, missions, KB, portfolio, watchlist, alerts, tickets, briefs, agents). Implement LangSmith observability middleware. Implement the alert pipeline worker, daily brief worker, and earnings worker.

**Why this feature exists:** The Manager is the conductor — it classifies user intent, routes to the correct agent pipeline, handles KB fast-path, parallel dispatch, and confidence-gated re-dispatch. Without it, individual agents exist but nothing ties them together into end-to-end missions. The remaining API routes expose the platform's full functionality to the admin dashboard and Telegram bot.

---

## User Scenarios & Testing

### User Story 1 — Intent Classification & Routing (Priority: P1)

As a user, I want the Manager to understand my query and route it to the correct agent pipeline so that I get the right type of analysis.

**Why P1**: Manager is the only agent that receives user input. Without intent classification, the system can't determine which pipeline to run.

**Independent Test**: Send `POST /api/chat { message: "What is happening with NVDA?" }` and verify a Mission is created, the correct pipeline runs, and a response is returned.

**Acceptance Scenarios**:

1. **Given** message "What is happening with NVDA?", **When** Manager classifies, **Then** intent = `operator_query`, pipeline = Researcher → Analyst → Bookkeeper → Reporter
2. **Given** message "/compare NVDA AMD", **When** Manager classifies, **Then** intent = `comparison`, pipeline = Researcher×2 (parallel) → Analyst (comparison) → Bookkeeper×2 → Reporter
3. **Given** message "/devil NVDA", **When** Manager classifies, **Then** intent = `devil_advocate`, pipeline = Researcher → Analyst (devil's advocate) → Bookkeeper → Reporter
4. **Given** message "/pattern NVDA 3w", **When** Manager classifies, **Then** intent = `pattern_request`, pipeline = Technician → Reporter (no Bookkeeper for standalone pattern)
5. **Given** message "/trade NVDA buy 10", **When** Manager classifies, **Then** intent = `trade_request`, pipeline = Researcher → Analyst → Technician → Bookkeeper → Trader → Reporter

---

### User Story 2 — KB Fast-Path (Priority: P1)

As a user, I want instant responses when the system already has a recent, high-confidence thesis so that I don't wait for a full pipeline when the answer is already known.

**Why P1**: Fast-path dramatically improves UX for repeated queries. It's a key differentiator showing the KB's value.

**Independent Test**: Seed a high-confidence NVDA thesis updated 1 hour ago, then send "What about NVDA?" and verify the response comes from KB (no Researcher/Analyst AgentRuns created).

**Acceptance Scenarios**:

1. **Given** a high-confidence NVDA thesis updated 2 hours ago, **When** an `operator_query` for NVDA arrives, **Then** Manager returns the KB thesis directly with `trigger: 'kb_fast_path'`
2. **Given** a high-confidence thesis updated 25 hours ago (stale), **When** the same query arrives, **Then** Manager dispatches the full pipeline (fast-path bypassed)
3. **Given** a medium-confidence thesis, **When** the query arrives, **Then** Manager dispatches the full pipeline (only `high` confidence qualifies)
4. **Given** KB fast-path is used, **Then** no `AgentRun` records are created for Researcher or Analyst (only Manager logs exist)

---

### User Story 3 — Parallel Researcher Dispatch (Priority: P1)

As a user requesting a comparison, I want both tickers researched simultaneously so that the total time is ~1× (not 2×) a single research.

**Why P1**: Comparison is a demo headline feature. Serial dispatch would take 60+ seconds; parallel takes ~30s.

**Independent Test**: Send `/compare NVDA AMD`, verify both Researcher runs start within 1 second of each other (timestamps in AgentRun).

**Acceptance Scenarios**:

1. **Given** a comparison request for NVDA and AMD, **When** Manager dispatches Researchers, **Then** `Promise.all()` is used to run them concurrently
2. **Given** both Researchers complete, **When** Analyst is called, **Then** it receives an array of two `ResearchOutput` objects
3. **Given** one Researcher fails, **Then** the mission fails (both outputs are required for comparison)

---

### User Story 4 — Confidence-Gated Re-dispatch (Priority: P2)

As the system, I want low-confidence results to trigger a focused re-research so that the quality of output meets a minimum bar.

**Why P2**: Quality improvement mechanism — the system works without it but may deliver low-confidence results.

**Independent Test**: Mock Analyst to return `confidence: 'low'` on first call, verify Researcher is re-dispatched with the contradictions as focus questions.

**Acceptance Scenarios**:

1. **Given** `config.agents.confidence.reDispatchOnLow` is `true`, **When** Analyst returns `confidence: 'low'`, **Then** Manager re-dispatches Researcher with `analystOutput.contradictions` as focus questions, then re-runs Analyst
2. **Given** re-dispatch is disabled (`reDispatchOnLow: false`), **When** Analyst returns `confidence: 'low'`, **Then** Manager proceeds with the low-confidence result

---

### User Story 5 — CRUD Routes (Priority: P1)

As the admin dashboard and Telegram bot, I want REST API routes for all domain entities so that I can read and manage missions, KB entries, portfolio, watchlist, alerts, tickets, and briefs.

**Why P1**: The dashboard and Telegram bot depend entirely on these routes. Without them, the frontend is useless.

**Independent Test**: For each route, make the documented request and verify the response matches the expected shape.

**Acceptance Scenarios**:

1. **Given** `POST /api/chat { message: '...', ticker: 'NVDA' }`, **Then** a Mission is created, the pipeline runs, and `{ missionId, response }` is returned
2. **Given** `GET /api/missions`, **Then** the last 20 missions are returned (admin sees all, analyst sees own)
3. **Given** `GET /api/missions/:id`, **Then** the mission with all `AgentRun` records is returned
4. **Given** `GET /api/kb/thesis/NVDA`, **Then** the current thesis for NVDA is returned
5. **Given** `GET /api/kb/history/NVDA`, **Then** all `KbThesisSnapshot` records for NVDA are returned
6. **Given** `POST /api/tickets/:id/approve`, **Then** `trader-platform-mcp.place_order()` is called and ticket status changes to `approved`
7. **Given** `GET /api/alerts`, **Then** unacknowledged alerts for the current user are returned

---

### User Story 6 — LangSmith Observability (Priority: P2)

As a developer reviewing a mission, I want a LangSmith trace link for every mission so that I can inspect the full LLM call chain for debugging.

**Why P2**: Essential for development and demo deep-dives but the system functions without it.

**Independent Test**: Run a mission, verify `langsmithUrl` is populated in the Mission record and the link opens a valid trace.

**Acceptance Scenarios**:

1. **Given** LangSmith is configured, **When** a mission runs, **Then** `langsmithUrl` is recorded on the Mission record
2. **Given** the admin dashboard, **When** a completed mission is displayed in the log, **Then** a clickable "→ LangSmith ↗" link is shown

---

### Edge Cases

- What if Manager can't classify intent? → Default to `operator_query` with the full message as context
- What if a mission takes longer than 5 minutes? → No hard timeout — BullMQ handles worker timeouts
- What if the same user sends two queries simultaneously? → Each gets its own Mission — no deduplication
- What if `/api/tickets/:id/approve` is called on an already-approved ticket? → Return `400`

---

## Requirements

### Functional Requirements

#### Manager
- **FR-001**: MUST use `generateText` with tool bindings for dispatching agents (Manager tools = agent dispatch functions)
- **FR-002**: System prompt MUST include the full intent routing table mapping 8 intents to agent pipelines
- **FR-003**: KB fast-path: for `operator_query`, check `ragRetrieval.get_current_thesis` — if `confidence === 'high'` and `isWithin24h(lastUpdated)`, return directly
- **FR-004**: Parallel dispatch: for `comparison`, use `Promise.all()` to run Researchers concurrently
- **FR-005**: Confidence re-dispatch: if `reDispatchOnLow` is enabled and Analyst returns `confidence: 'low'`, re-dispatch Researcher with contradictions as focus questions
- **FR-006**: MUST create `Mission` record before pipeline starts, update to `complete` or `failed` on finish
- **FR-007**: MUST create `AgentRun` records for each agent step with `provider`, `model`, `tokensIn`, `tokensOut`, `costUsd`, `durationMs`

#### API Routes
- **FR-008**: `POST /api/chat` — create Mission, run Manager, return `{ missionId, response }`
- **FR-009**: `GET /api/missions` — last 20 missions (role-filtered)
- **FR-010**: `GET /api/missions/:id` — mission + AgentRun records
- **FR-011**: `GET /api/kb/search` — RAG search via `ragRetrieval.search()`
- **FR-012**: `GET /api/kb/thesis/:ticker` — current thesis
- **FR-013**: `GET /api/kb/history/:ticker` — thesis history (snapshots)
- **FR-014**: `GET/PUT /api/portfolio` — user's portfolio items
- **FR-015**: `GET/POST/DELETE /api/watchlist` — user's watchlist items
- **FR-016**: `GET /api/alerts` — unacknowledged alerts
- **FR-017**: `POST /api/alerts/:id/ack` — acknowledge alert
- **FR-018**: `GET /api/tickets` — pending trade tickets
- **FR-019**: `POST /api/tickets/:id/approve` — approve and execute via `trader-platform-mcp`
- **FR-020**: `POST /api/tickets/:id/reject` — reject ticket
- **FR-021**: `GET /api/briefs/latest` — latest daily brief
- **FR-022**: `GET /api/screener/last` — last ScreenerRun record with results JSON

#### Workers
- **FR-023**: `alert-pipeline-worker` MUST process alerts through investigation pipeline: `Researcher → Analyst → Bookkeeper → Reporter`
- **FR-024**: `brief-worker` MUST generate daily brief for all active users
- **FR-025**: `earnings-worker` MUST check earnings calendar and create alerts

#### Mission Type → Pipeline Routing Table

| Mission Type | Pipeline |
|---|---|
| `operator_query` | KB fast-path check → Researcher → Analyst → Bookkeeper → Reporter |
| `alert_investigation` | Researcher → Analyst → (optionally Technician) → Bookkeeper → Reporter |
| `comparison` | Researcher×N (parallel) → Analyst (comparison) → Bookkeeper×N → Reporter |
| `devil_advocate` | Researcher → Analyst (devil's advocate) → Bookkeeper → Reporter |
| `pattern_request` | Technician → Reporter |
| `earnings_prebrief` | Researcher → Analyst → Bookkeeper → Reporter |
| `trade_request` | Researcher → Analyst → Technician → Bookkeeper → Trader → Reporter |
| `daily_brief` | (all portfolio tickers) Researcher×N → Analyst×N → Bookkeeper×N → Reporter |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `POST /api/chat { message: "What about NVDA?" }` creates Mission and returns response
- **SC-002**: KB fast-path works — no Researcher/Analyst AgentRuns when thesis is fresh + high confidence
- **SC-003**: `/compare NVDA AMD` dispatches two parallel Researcher jobs
- **SC-004**: All CRUD routes return correct response shapes
- **SC-005**: Mission status updates to `complete` after full pipeline
- **SC-006**: AgentRun records are created for each step with correct `costUsd` values
- **SC-007**: Full E2E test: `operator_query` → mission complete → KB entry created
