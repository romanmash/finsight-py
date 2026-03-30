# Feature Specification: Collector Agents

**Feature**: `006-collector-agents`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `004-mcp-platform`, `005-agent-infrastructure`

## Overview

Implement the four data-collection agents: Watchdog (periodic price/news scanning), Screener (sector scanning beyond watchlist), Researcher (comprehensive data gathering for missions), and Technician (technical analysis from OHLCV data). Also implement the BullMQ scheduler and worker infrastructure. These agents collect and compute — they do **not** synthesise or interpret.

**Why this feature exists:** Collector agents feed data into the reasoning pipeline. Without Watchdog, the system can't detect market events. Without Researcher, the Analyst has no data to synthesise. Without Technician, pattern analysis requests can't be fulfilled. Without Screener, the system only watches known tickers.

---

## User Scenarios & Testing

### User Story 1 — Watchdog Scanning (Priority: P1)

As the system, I want automated periodic scanning of all watched tickers for price changes, volume spikes, news events, and earnings proximity so that alerts are generated proactively.

**Why P1**: Watchdog is the only agent that runs without human intervention. It creates the alerts that drive the `alert_investigation` pipeline — the system's proactive intelligence.

**Independent Test**: Seed 3 watchlist tickers, run `runWatchdog()`, verify PriceSnapshot records are written and an alert is created for any ticker exceeding the threshold.

**Acceptance Scenarios**:

1. **Given** 3 active watchlist items (NVDA, AAPL, GLD), **When** `runWatchdog()` completes, **Then** a `PriceSnapshot` record is created for each ticker
2. **Given** NVDA price changed by 5% since last snapshot and threshold is 3%, **When** `runWatchdog()` completes, **Then** a `price_spike` Alert is created and pushed to `alertPipelineQueue`
3. **Given** NVDA price changed by 1% and threshold is 3%, **When** `runWatchdog()` completes, **Then** NO alert is created (within normal range)
4. **Given** NVDA has earnings in 2 days, **When** `runWatchdog()` checks earnings, **Then** an `earnings_approaching` Alert is created
5. **Given** Watchdog starts, **Then** it sets Redis state to `active` with current task. On completion, it sets state to `idle` with summary. On error, it sets state to `error`.

---

### User Story 2 — Screener Scanning (Priority: P2)

As the system, I want periodic sector scanning to discover interesting tickers beyond the user's watchlist so that the platform surfaces opportunities the user hasn't thought of.

**Why P2**: Proactive discovery is a differentiator but the core pipeline works without it. Screener enriches the daily brief.

**Independent Test**: Run `runScreener()` with mocked MCP tools, verify a `ScreenerRun` record is persisted with scored results.

**Acceptance Scenarios**:

1. **Given** a scheduled Screener run, **When** `runScreener()` completes, **Then** a `ScreenerRun` record is created with `triggeredBy: 'scheduled'` and results JSON
2. **Given** a manual trigger via `POST /api/screener/trigger`, **When** `runScreener()` completes, **Then** `triggeredBy` is `'manual'`
3. **Given** sector scan returns 5 signals, **When** results are persisted, **Then** each result has `ticker`, `sector`, `reason`, `signalScore`, and `topHeadline`

---

### User Story 3 — Researcher Data Gathering (Priority: P1)

As the Analyst agent, I want comprehensive research data for a ticker so that I can synthesise it into an investment thesis.

**Why P1**: Researcher is dispatched by Manager for every `operator_query`, `alert_investigation`, `comparison`, `devil_advocate`, and `earnings_prebrief` mission. It's the most frequently called agent.

**Independent Test**: Call `runResearcher({ ticker: 'NVDA', focusQuestions: ['recent news', 'fundamentals'] })` with mocked MCP tools, verify the output is a valid `ResearchOutput`.

**Acceptance Scenarios**:

1. **Given** a research request for NVDA with focus questions, **When** `runResearcher()` completes, **Then** it returns a valid `ResearchOutput` with all required fields populated
2. **Given** the Researcher uses `generateText` with tool bindings from `McpToolSets.all`, **Then** the model calls appropriate MCP tools based on focus questions (verified by tool call history)
3. **Given** the model returns malformed JSON, **When** output validation fails, **Then** the function throws (letting BullMQ retry)
4. **Given** `maxSteps: 10` is configured, **Then** the Researcher can make up to 10 sequential tool calls per execution
5. **Given** a research request, **Then** Researcher produces ONLY data — no analysis, no conclusions, no recommendations (enforced by system prompt)

---

### User Story 4 — Technical Analysis (Priority: P1)

As the system, I want RSI, MACD, Bollinger Bands, and pattern analysis from OHLCV data so that pattern requests and full investigations include technical signals.

**Why P1**: `/pattern NVDA 3w` is a primary demo command. Without Technician, it returns nothing.

**Independent Test**: Call `runTechnician({ ticker: 'NVDA', periodWeeks: 3 })` with mocked OHLCV data, verify RSI is between 0-100 and all indicator fields are present.

**Acceptance Scenarios**:

1. **Given** 21 daily candles for NVDA, **When** `runTechnician()` computes indicators, **Then** RSI is between 0 and 100
2. **Given** computed indicators, **When** `generateText` interprets them, **Then** it returns a `TechnicianOutput` with `trend`, `keyLevels`, `indicators`, `patterns`, `summary`, `confidence`
3. **Given** MACD computation, **Then** signal is one of: `bullish_crossover`, `bearish_crossover`, `neutral`
4. **Given** Bollinger Bands computation, **Then** position is one of: `upper`, `middle`, `lower`, `outside_upper`, `outside_lower`
5. **Given** technical indicators are computed using `technicalindicators` npm package (pure math), **Then** no LLM call is made for the math portion — only for natural language interpretation

---

### User Story 5 — BullMQ Scheduler & Workers (Priority: P1)

As the system, I want repeatable BullMQ jobs for Watchdog, Screener, Daily Brief, and Earnings Check so that they run on the configured cron schedule.

**Why P1**: Without the scheduler, no periodic agent runs. The demo requires Watchdog to run every 30 minutes and Daily Brief at 06:00.

**Independent Test**: Call `initScheduler(config)`, verify all repeatable jobs are registered with correct cron expressions from `scheduler.yaml`.

**Acceptance Scenarios**:

1. **Given** `scheduler.yaml` defines Watchdog cron as `*/30 * * * *`, **When** `initScheduler()` runs, **Then** a repeatable job is registered with that cron expression
2. **Given** `initScheduler()` is called twice (restart), **Then** BullMQ deduplicates repeatable jobs (idempotent)
3. **Given** a Watchdog scan job fires, **When** `watchdog-worker.ts` processes it, **Then** it calls `runWatchdog()` and records the result
4. **Given** a job fails, **Then** BullMQ retries with backoff per queue configuration

---

### Edge Cases

- What if Watchdog scan takes longer than the scan interval? → BullMQ handles this — next job waits until current one completes
- What if Researcher gets no useful data from MCP tools? → Returns `ResearchOutput` with empty/minimal fields, `confidence: 'low'`
- What if OHLCV data has fewer candles than expected? → Technician computes with available data, logs warning, may set `confidence: 'low'`
- What if all Watchdog tickers return errors from market-data-mcp? → Watchdog completes with `alertsCreated: 0`, `snapshotsWritten: 0`, logs warnings

---

## Requirements

### Functional Requirements

#### Agent State Protocol (applies to ALL agents)
- **FR-001**: Every agent MUST write Redis state before execution: `{ state: 'active', currentTask, currentMissionId, startedAt }`
- **FR-002**: Every agent MUST write Redis state after completion: `{ state: 'idle', lastActiveAt, lastActivitySummary }`
- **FR-003**: Every agent MUST write Redis state on error: `{ state: 'error', errorMessage }`
- **FR-004**: Redis state keys MUST use `RedisKey.agentState(agentName)` with 10-minute TTL

#### Watchdog
- **FR-005**: MUST fetch all active WatchlistItems across all users
- **FR-006**: MUST batch-call `get_multiple_quotes` for all tickers (single MCP request)
- **FR-007**: MUST compare prices against latest PriceSnapshot per ticker
- **FR-008**: MUST check earnings proximity via `get_earnings` per ticker
- **FR-009**: MUST fetch news via `get_ticker_news` for flagged tickers only
- **FR-010**: MUST write PriceSnapshot for every ticker on every scan
- **FR-011**: MUST create Alert and push to `alertPipelineQueue` for each detected signal
- **FR-012**: Alert types: `price_spike`, `volume_spike`, `news_event`, `earnings_approaching`, `pattern_signal`

#### Screener
- **FR-013**: MUST persist results as `ScreenerRun` with `triggeredBy` field
- **FR-014**: MUST score signals with `signalScore` field
- **FR-015**: MUST include `topHeadline` for each find

#### Researcher
- **FR-016**: MUST use `generateText` with `McpToolSets.all` tool bindings
- **FR-017**: MUST set `maxSteps: 10` to allow multiple sequential tool calls
- **FR-018**: MUST validate output against `ResearchOutput` type — throw on malformed JSON
- **FR-019**: System prompt MUST instruct: collect data only, no analysis, no conclusions
- **FR-020**: MUST include existing KB context via `ragRetrieval.search()` in output

#### Technician
- **FR-021**: MUST fetch OHLCV via `mcpTools.marketData.get_ohlcv` for `periodWeeks × 7` days
- **FR-022**: MUST compute RSI, MACD, Bollinger Bands, SMA using `technicalindicators` npm package (pure math, no LLM)
- **FR-023**: MUST pass computed values to `generateText` for natural language interpretation only
- **FR-024**: MUST return typed `TechnicianOutput` with all required fields

#### Scheduler & Workers
- **FR-025**: `initScheduler()` MUST register all repeatable BullMQ jobs from `scheduler.yaml` cron expressions
- **FR-026**: `initScheduler()` MUST be idempotent (safe to call on restart)
- **FR-027**: Workers MUST handle job errors gracefully (log + let BullMQ retry)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `runWatchdog()` writes PriceSnapshot records for every active ticker
- **SC-002**: `runWatchdog()` creates Alert when price change exceeds threshold
- **SC-003**: `runWatchdog()` does NOT create alert when change is within threshold
- **SC-004**: `runResearcher({ ticker: 'NVDA', focusQuestions: ['recent news'] })` returns valid `ResearchOutput`
- **SC-005**: `runTechnician({ ticker: 'NVDA', periodWeeks: 3 })` returns `TechnicianOutput` with RSI in 0-100
- **SC-006**: All repeatable BullMQ jobs register with correct cron expressions
- **SC-007**: All agent state Redis writes follow the protocol
