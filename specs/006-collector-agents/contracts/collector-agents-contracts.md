# Contract: Collector Agents Interfaces (006)

## Purpose

Canonical handoff contracts from collector feature `006` into:
- `007-reasoning-agents` (Analyst/Bookkeeper/Reporter/Trader consumption)
- `008-orchestration` (Manager routing, worker pipelines, and route responses)

These contracts are implementation-accurate for current 006 code and are the stability baseline for 007/008.

## 1) Watchdog Run Contract

### Input

```json
{
  "triggeredBy": "scheduled"
}
```

### Output (`WatchdogRunResult`)

```json
{
  "snapshotsWritten": 3,
  "alertsCreated": 1,
  "alerts": [
    { "ticker": "NVDA", "alertType": "price_spike" }
  ],
  "warnings": []
}
```

### Alert Context Minimum Fields (queue handoff)

Every queued alert payload includes:
- `instrument`
- `signalType`
- `triggerValue`
- `thresholdValueOrEvent`
- `snapshotTimestamp`
- `evidenceSummary`

## 2) Screener Run Contract

### Input

```json
{
  "triggeredBy": "manual"
}
```

Allowed trigger values only:
- `scheduled`
- `manual`

### Output (`DiscoveryRunPersisted`)

```json
{
  "runId": "scr_123",
  "triggeredBy": "manual",
  "results": [
    {
      "ticker": "MSFT",
      "sector": "technology",
      "reason": "momentum + coverage",
      "signalScore": 0.92,
      "supportingHeadline": "..."
    }
  ],
  "metadata": {
    "noCandidates": false
  }
}
```

### Persisted Metadata

Database JSON metadata key is `no_candidates`.
Runtime output metadata key is `noCandidates`.

## 3) Researcher Contract

### Input

```json
{
  "ticker": "NVDA",
  "focusQuestions": ["recent catalysts"],
  "missionType": "alert_investigation"
}
```

Allowed `missionType` values:
- `operator_query`
- `alert_investigation`
- `comparison`
- `devil_advocate`
- `earnings_prebrief`

### Output (`ResearchCollectionOutput`)

```json
{
  "ticker": "NVDA",
  "focusQuestions": ["recent catalysts"],
  "missionType": "alert_investigation",
  "collectedFacts": [],
  "newsSummary": {},
  "fundamentalsSummary": {},
  "kbContext": [],
  "confidence": "medium",
  "gaps": []
}
```

### Boundary Guarantee

Collector output contains gathered facts/signals only and excludes recommendation/thesis generation.

## 4) Technician Contract

### Input

```json
{
  "ticker": "NVDA",
  "periodWeeks": 3
}
```

### Output (`TechnicalCollectionOutput`)

```json
{
  "ticker": "NVDA",
  "periodWeeks": 3,
  "trend": "bullish",
  "levels": {
    "support": 100,
    "resistance": 120
  },
  "patterns": [],
  "indicators": {
    "rsi": 61.2,
    "stochastic": 58.4,
    "macdHistogram": 1.1,
    "volatility": 2.5,
    "averageVolume": 1230000
  },
  "confidence": 0.9,
  "limitations": [],
  "summary": "technical indicators collected successfully"
}
```

### Validation Rules

- `rsi` and `stochastic` in `[0,100]` when present.
- `confidence` in `[0,1]`.
- `volatility` and `averageVolume` non-negative when present.
- Required sections always present: `trend`, `levels`, `patterns`, `confidence`, `limitations`.

## 5) Scheduler + Workers Contract

### Registered Repeatable Jobs

- `watchdogScan`
- `screenerScan`
- `dailyBrief`
- `earningsCheck`
- `ticketExpiry`

### Registration Output (`SchedulerInitResult`)

```json
{
  "registeredJobs": [
    "watchdogScan",
    "screenerScan",
    "dailyBrief",
    "earningsCheck",
    "ticketExpiry"
  ],
  "deduplicated": true
}
```

### Reliability Guarantees

- Duplicate-safe registration across restart/re-init.
- Retry policy is config-driven (`retryAttempts`, `retryBackoffMs`).

## 6) Operational State Contract

### Redis Key

`agent:state:{agentName}` where `agentName` is one of:
- `watchdog`
- `screener`
- `researcher`
- `technician`

### Allowed States

- `active`
- `idle`
- `error`

### Transition Guarantee

Every collector run emits:
- `active -> idle` on success, or
- `active -> error` on failure.

State TTL is configuration-driven via `app.collector.stateTtlSeconds`.

## 7) Compatibility Constraints for 007/008

- 007/008 must consume `supportingHeadline` (not `topHeadline`) for screener evidence.
- 007/008 must treat Technician `confidence` as numeric `[0,1]`.
- 007/008 must rely on collector contracts, not collector implementation style (deterministic vs LLM-assisted).
- Any future contract change requires coordinated update across 006/007/008 specs and tasks.
