# Implementation Plan: Collector Agents

**Branch**: `006-collector-agents` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-collector-agents/spec.md`

## Summary

Implement the collector layer in the API runtime by delivering explicit agent modules for Watchdog, Screener, Researcher, and Technician, plus scheduled worker execution for periodic runs. The design preserves strict collector boundaries (collect/compute only), enforces configuration-driven thresholds and cadence, and provides deterministic, offline-testable outputs for downstream reasoning/orchestration features.

## Scope Preservation (From Original Manual Spec)

The following points are mandatory carryover details to keep implementation concrete and unambiguous:

- **Explicit in-scope agents**: Watchdog, Screener, Researcher, Technician (no scope substitution with a generic collector).
- **Watchdog signal/output expectations**:
  - Snapshot persistence for every active monitored ticker each completed cycle.
  - Alert categories must include `price_spike`, `volume_spike`, `news_event`, `earnings_approaching`, `pattern_signal`.
  - Use batched quote retrieval for monitored tickers, earnings-window checks, and targeted news fetches for flagged instruments.
  - Threshold/event-driven alerts must enqueue downstream investigation payloads via existing alert pipeline queue.
- **Screener output expectations**:
  - Persisted run record includes trigger source (`scheduled` or `manual`).
  - Ranked results include ticker, sector, reason, score, and supporting headline/evidence field.
- **Researcher expectations**:
  - Multi-step tool-based data collection over approved MCP tool surface.
  - Planned default step budget should preserve the manual-spec intent (up to 10 sequential tool-call steps unless runtime config tightens it).
  - Output validation gate before handoff; malformed payloads fail recoverably.
  - Collector boundary enforced: gathered evidence only; no thesis/recommendation content.
  - Existing knowledge context is included when available.
- **Technician expectations**:
  - Compute core indicator set (RSI, MACD, Bollinger position, SMA/levels) from market history.
  - Technical output includes trend, key levels, indicators, patterns, summary, and confidence.
  - Insufficient history path must return explicit limitations with downgraded confidence.
- **Scheduler/worker expectations**:
  - Periodic jobs cover watchdog scan, screener scan, daily brief, and earnings check.
  - Registration remains duplicate-free across restarts.
  - Transient failures follow configured retry behavior and remain observable.
- **Operational state protocol**:
  - Each collector emits `active` -> (`idle` or `error`) with task/activity context.
  - State expiry/retention behavior remains configuration-driven (no hardcoded TTLs).

### Non-Negotiable Carryover Rules

The following original-spec points are mandatory and must be reflected in tasks.md without dilution:

- **Agent state storage convention**:
  - Use canonical collector state key pattern: RedisKey.agentState(agentName).
  - Default state TTL target is 10 minutes unless runtime config explicitly overrides.
- **Technician computation boundary**:
  - Indicator math is deterministic and non-LLM.
  - Any LLM usage is limited to narrative interpretation of already computed values.
- **Researcher invocation policy**:
  - Preserve multi-step collection behavior with default step budget intent of up to 10 (config may tighten).
- **Watchdog collection behavior**:
  - Perform earnings-window checks per monitored instrument.
  - Fetch ticker news only for instruments flagged by threshold/event checks.
- **Researcher mission coverage**:
  - Explicit mission types in scope: operator_query, alert_investigation, comparison, devil_advocate, earnings_prebrief.
- **Screener manual trigger contract**:
  - Preserve explicit manual trigger path/contract in addition to scheduled execution.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Hono runtime (existing API host), BullMQ, Prisma Client, Vercel AI SDK, Zod, Pino, Vitest, msw  
**Storage**: PostgreSQL (collector persistence), Redis (agent operational state and queues), runtime YAML config (`config/runtime/*.yaml`)  
**Testing**: Vitest + mocked MCP/provider dependencies for offline execution  
**Target Platform**: Linux Docker production and Windows local development  
**Project Type**: Monorepo backend service enhancement (`apps/api`)  
**Performance Goals**: Collector cycles complete within configured scheduler windows; threshold/event detection remains deterministic and repeatable across retries  
**Constraints**: Everything-as-Code, strict agent boundaries, no hardcoded secrets/behavior values, no external-network dependency in tests, fail-safe error handling for malformed collector outputs  
**Scale/Scope**: 4 explicit collector agents (Watchdog/Screener/Researcher/Technician), shared scheduler-worker execution, and persistence/state integration for downstream features 007/008

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Thresholds, schedules, and run controls remain configuration-driven.
- **Agent Boundaries**: PASS. Watchdog/Screener/Researcher/Technician produce collection outputs only; no synthesis responsibilities.
- **MCP Server Independence**: PASS. Collectors consume tools through infrastructure abstractions without bypassing MCP boundaries.
- **Cost Observability**: PASS (non-regressive). Researcher/Technician model invocations remain compatible with agent-run accounting.
- **Fail-Safe Defaults**: PASS. Malformed outputs and transient upstream failures are handled with recoverable failure paths.
- **Test-First Where Practical**: PASS. Unit/integration tests planned for each collector and scheduling behavior.
- **Simplicity Over Cleverness**: PASS. Explicit agent modules + queue workers; no orchestration framework complexity added.

## Project Structure

### Documentation (this feature)

```text
specs/006-collector-agents/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── collector-agents-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── agents/
│   │   ├── watchdog.ts
│   │   ├── screener.ts
│   │   ├── researcher.ts
│   │   ├── technician.ts
│   │   └── shared/
│   │       └── collector-state.ts
│   ├── workers/
│   │   ├── watchdog-worker.ts
│   │   ├── screener-worker.ts
│   │   ├── brief-worker.ts
│   │   └── earnings-worker.ts
│   ├── scheduler/
│   │   └── init-scheduler.ts
│   ├── lib/
│   │   ├── queues.ts
│   │   └── __tests__/
│   │       ├── watchdog.test.ts
│   │       ├── screener.test.ts
│   │       ├── researcher.test.ts
│   │       ├── technician.test.ts
│   │       └── scheduler.test.ts
│   └── types/
│       └── collectors.ts

config/runtime/
├── watchdog.yaml
├── screener.yaml
└── scheduler.yaml

prisma/
└── schema.prisma (existing collector-related models validated/extended only if required)
```

**Structure Decision**: Implement 006 inside `apps/api` as explicit collector agent modules (Watchdog/Screener/Researcher/Technician) with worker/scheduler integration in existing runtime layers. This keeps collector behavior close to queue and config infrastructure already established in features 003–005.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Collector-boundary enforcement strategy per named agent
- Monitoring/discovery/research/technical output contracts and recoverable-failure behavior
- Scheduler deduplication and retry behavior patterns for periodic collectors
- Persistence/state consistency model for operational state + outputs
- Offline testing approach for collectors with deterministic mocked dependencies

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/collector-agents-contracts.md](./contracts/collector-agents-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (collector behavior constrained to runtime configuration)
- **Agent Boundaries**: PASS (named collectors remain collection-only; no reasoning-role leakage)
- **MCP Server Independence**: PASS (all upstream data access remains via MCP abstractions)
- **Fail-Safe Defaults**: PASS (recoverable failure semantics and queue retry compatibility defined)
- **Test-First Where Practical**: PASS (agent-specific + scheduler-specific validation defined)
- **Simplicity Over Cleverness**: PASS (direct module + worker design with clear ownership)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.