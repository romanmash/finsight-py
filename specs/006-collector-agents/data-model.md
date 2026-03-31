# Data Model: Collector Agents (006)

## Overview

This model reflects the implemented runtime entities and payload contracts that 007/008 consume.

## Entities

### 1) CollectorOperationalState

- **Purpose**: Runtime state visibility for each collector agent.
- **Fields**:
  - `agentName` (`watchdog` | `screener` | `researcher` | `technician`)
  - `state` (`active` | `idle` | `error`)
  - `currentTask` (optional)
  - `currentMissionId` (optional)
  - `startedAt` (optional)
  - `lastActiveAt` (optional)
  - `lastActivitySummary` (optional)
  - `errorMessage` (optional)
- **Storage**: Redis key `agent:state:{agentName}` with TTL from `app.collector.stateTtlSeconds`.

### 2) MonitoringSnapshot

- **Purpose**: Watchdog snapshot persistence per active watchlist instrument.
- **Backed by**: `PriceSnapshot` model.
- **Relevant fields**:
  - `watchlistItemId`
  - `ticker`
  - `price`
  - `changePct`
  - `volume`
  - `capturedAt`

### 3) CollectorAlert

- **Purpose**: Watchdog event output for downstream investigation.
- **Backed by**: `Alert` model + `alertPipelineQueue` payload.
- **Alert types**:
  - `price_spike`
  - `volume_spike`
  - `news_event`
  - `earnings_approaching`
  - `pattern_signal`
- **Minimum queue context**:
  - `instrument`, `signalType`, `triggerValue`, `thresholdValueOrEvent`, `snapshotTimestamp`, `evidenceSummary`

### 4) DiscoveryRunResult

- **Purpose**: Screener run persistence with trigger provenance.
- **Backed by**: `ScreenerRun` model.
- **Runtime shape**:
  - `runId`
  - `triggeredBy` (`scheduled` | `manual`)
  - `results[]`:
    - `ticker`, `sector`, `reason`, `signalScore`, `supportingHeadline?`
  - `metadata.noCandidates`
- **Persistence note**: DB JSON metadata stores snake_case key `no_candidates`.

### 5) ResearchCollectionOutput

- **Purpose**: Researcher handoff payload for reasoning agents.
- **Fields**:
  - `ticker`
  - `focusQuestions[]`
  - `missionType`
  - `collectedFacts[]`
  - `newsSummary`
  - `fundamentalsSummary`
  - `kbContext[]`
  - `confidence` (`low` | `medium` | `high`)
  - `gaps[]`
- **Boundary rule**: collection data only; no recommendation/thesis content.

### 6) TechnicalCollectionOutput

- **Purpose**: Technician deterministic signal handoff.
- **Fields**:
  - `ticker`
  - `periodWeeks`
  - `trend` (`bullish` | `bearish` | `neutral` | `mixed`)
  - `levels.support`
  - `levels.resistance`
  - `patterns[]`
  - `indicators`:
    - `rsi?`, `stochastic?`, `macdHistogram?`, `volatility?`, `averageVolume?`
  - `confidence` (number in `[0,1]`)
  - `limitations[]`
  - `summary`

### 7) ScheduledCollectorJob

- **Purpose**: Repeatable job definitions for periodic collector execution.
- **Jobs**:
  - `watchdogScan`
  - `screenerScan`
  - `dailyBrief`
  - `earningsCheck`
  - `ticketExpiry`
- **Config fields per job**:
  - `cron`
  - `concurrency`
  - `retryAttempts`
  - `retryBackoffMs`

## Relationships

- `CollectorOperationalState` is maintained per collector execution.
- `MonitoringSnapshot` and `CollectorAlert` originate from Watchdog runs.
- `DiscoveryRunResult` originates from Screener runs.
- `ResearchCollectionOutput` and `TechnicalCollectionOutput` are upstream inputs for 007 reasoning pipelines and 008 manager orchestration.
- `ScheduledCollectorJob` drives periodic execution and retry behavior consumed by orchestration/runtime status surfaces.
