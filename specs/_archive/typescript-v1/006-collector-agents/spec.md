# Feature Specification: Collector Agents

**Feature**: `006-collector-agents`
**Created**: 2026-03-31
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `004-mcp-platform`, `005-agent-infrastructure`

## Overview

Deliver the collector-agent layer that gathers market and context data for downstream reasoning agents. This feature explicitly covers Watchdog (monitoring), Screener (discovery scans), Researcher (mission data collection), Technician (technical signal collection), and scheduled execution support for collector runs.

**Why this feature exists:** Reasoning agents cannot produce reliable outputs without structured, timely inputs. Collector agents create those inputs while preserving strict role boundaries (collect only, no synthesis).

---

## User Scenarios & Testing

### User Story 1 (US1) — Proactive Watchlist Monitoring (Priority: P1)

As the platform, I want periodic monitoring of tracked instruments so that meaningful market events are detected and surfaced without manual polling.

**Why this priority**: Proactive alerting is the entry point for investigation workflows and a core platform behavior.

**Independent Test**: Execute one monitoring cycle with representative watchlist data and verify snapshots are recorded and alerts are created only when thresholds are exceeded.

**Acceptance Scenarios**:

1. **Given** active watchlist instruments exist, **When** a monitoring cycle completes, **Then** each instrument receives a new snapshot record
2. **Given** an instrument crosses configured movement thresholds, **When** monitoring completes, **Then** an alert is created with the appropriate signal type
3. **Given** an instrument remains within configured thresholds, **When** monitoring completes, **Then** no alert is created for threshold-based signals
4. **Given** operational status tracking is enabled, **When** monitoring starts/completes/fails, **Then** agent operational state is updated consistently

---

### User Story 2 (US2) — Mission Research Data Collection (Priority: P1)

As the reasoning layer, I want comprehensive data collection for a mission target so that synthesis agents can operate on complete, structured evidence.

**Why this priority**: Most mission flows depend on high-quality collected inputs before any reasoning can occur.

**Independent Test**: Execute one research collection request with focus prompts and verify structured output completeness and validation conformity.

**Acceptance Scenarios**:

1. **Given** a mission research request, **When** collection completes, **Then** the response contains all required data sections in valid structure
2. **Given** required upstream data sources partially fail, **When** collection completes, **Then** output still returns with explicit gaps and confidence impact
3. **Given** malformed output is produced internally, **When** validation runs, **Then** the request fails in a recoverable way instead of returning invalid payloads
4. **Given** collector role boundaries, **When** research output is generated, **Then** it contains gathered facts only and no thesis/conclusion content

---

### User Story 3 (US3) — Technical Signal Collection (Priority: P1)

As the platform, I want technical signals and pattern-oriented context collected from recent market data so that technical investigations are grounded in consistent indicators.

**Why this priority**: Pattern and technical workflows are core user-visible capabilities and require deterministic signal collection.

**Independent Test**: Run a technical collection request for a ticker and period window; verify indicator ranges, signal classifications, and output structure.

**Acceptance Scenarios**:

1. **Given** sufficient recent market candles, **When** technical collection runs, **Then** standard indicators are computed within valid ranges
2. **Given** computed indicator values, **When** output is produced, **Then** trend, levels, pattern summary, and confidence are all present
3. **Given** limited market history, **When** technical collection runs, **Then** output is returned with downgraded confidence and explicit limitations

---

### User Story 4 (US4) — Market Discovery Scans (Priority: P2)

As the platform, I want scheduled and on-demand discovery scans beyond user watchlists so that additional opportunities can be surfaced.

**Why this priority**: Discovery improves value but is secondary to baseline monitoring and mission collection.

**Independent Test**: Run both scheduled and manual scan triggers; verify results persistence and consistent scoring fields.

**Acceptance Scenarios**:

1. **Given** a scheduled discovery run, **When** it completes, **Then** results are persisted with scheduled trigger attribution
2. **Given** a manual discovery trigger, **When** it completes, **Then** results are persisted with manual trigger attribution
3. **Given** ranked discoveries are produced, **When** results are stored, **Then** each result includes instrument, context, score, and supporting headline/evidence

---

### User Story 5 (US5) — Scheduled Execution Reliability (Priority: P1)

As an operator, I want collector jobs to run on configured schedules with retries and duplicate-free registration so that periodic intelligence remains reliable.

**Why this priority**: Without dependable scheduling, proactive collection and briefs degrade quickly.

**Independent Test**: Initialize scheduler twice and verify jobs are registered once, execute on schedule, and retry on transient failures.

**Acceptance Scenarios**:

1. **Given** configured schedules exist, **When** scheduler initializes, **Then** all required periodic jobs are registered from configuration
2. **Given** scheduler initialization is invoked repeatedly, **When** registration runs, **Then** duplicate periodic jobs are not created
3. **Given** a collector job fails transiently, **When** execution framework retries, **Then** retry policy is applied and failure is observable

---

### Edge Cases

- What happens when a monitoring run takes longer than its interval? -> Overlapping execution is prevented or safely queued to avoid duplicate side effects
- What happens when upstream data sources are partially unavailable? -> Collector outputs remain validation-conformant with explicit missing-data markers
- What happens when all monitored instruments fail data retrieval? -> Run completes with zero signals and structured warnings rather than hard crash
- What happens when technical history is insufficient for one or more indicators? -> Output still returns with reduced confidence and indicator-specific gaps
- What happens when schedules are changed at runtime? -> Next scheduling refresh applies new cadence without duplicate registrations
- What happens when a discovery run returns no qualifying candidates? -> Run is persisted with empty ranked results and explicit `no_candidates` reason metadata

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide the following collector agents in scope: Watchdog, Screener, Researcher, and Technician
- **FR-002**: System MUST enforce collector boundary behavior: collectors gather/compute data but do not produce investment theses or recommendations
- **FR-003**: System MUST persist monitoring snapshots for all active monitored instruments on each completed monitoring cycle
- **FR-004**: System MUST create alerts only when configured detection thresholds or event criteria are satisfied, where threshold/event configuration is sourced from `config/runtime/*.yaml` and owned by runtime config (not source code constants)
- **FR-005**: System MUST classify alerts into approved signal categories and include minimum downstream context fields: `instrument`, `signalType`, `triggerValue`, `thresholdValueOrEvent`, `snapshotTimestamp`, and `evidenceSummary`
- **FR-006**: System MUST persist discovery scan outputs with trigger source attribution (scheduled vs manual)
- **FR-007**: System MUST provide mission research outputs in a validated, structured format suitable for downstream reasoning agents
- **FR-008**: System MUST fail safely on malformed collector outputs by surfacing recoverable failures rather than returning invalid payloads
- **FR-009**: System MUST collect technical indicators and pattern context with deterministic indicator range validation using explicit rules: RSI in `[0,100]`; stochastic values in `[0,100]`; bounded probability/confidence fields in `[0,1]`; non-negative volume/volatility metrics
- **FR-010**: System MUST return usable technical output even with partial input data. Minimum required sections are `trend`, `levels`, `patterns`, `confidence`, and `limitations`; missing indicators MUST be represented explicitly with reason codes
- **FR-011**: System MUST register periodic collector jobs from runtime configuration and execute them on configured cadence
- **FR-012**: System MUST keep scheduler registration duplicate-free across restarts/re-initialization
- **FR-013**: System MUST apply retry behavior for transient collector job failures and expose failure outcomes in logs/state
- **FR-014**: System MUST maintain operational state visibility for each collector agent (`active`, `idle`, `error`) with current/last activity context
- **FR-015**: System MUST keep all behavior-critical thresholds, cadences, and limits configuration-driven (no hardcoded behavior values)
- **FR-016**: System MUST support offline testability with mocked upstream dependencies for collector workflows
- **FR-017**: System MUST record screener trigger provenance on each run as one of `scheduled` or `manual`, and treat unknown trigger values as validation errors
- **FR-018**: System MUST enforce requirement-ID traceability in downstream planning artifacts so each P1 user story (`US1`, `US2`, `US3`, `US5`) maps to at least one task reference and at least one validation task

### Operational Definitions

- **Collector boundary**: Agent output is restricted to gathered facts, computed signals, and explicit metadata; no narrative thesis/recommendation content.
- **Monitoring cycle**: One complete pass over all active monitored instruments, including snapshot persistence and event evaluation.
- **Discovery run**: One complete scan outside watchlist scope producing ranked candidates with supporting evidence fields.
- **Recoverable failure**: A failure mode that (a) persists a structured error record with failure class and retryability, (b) does not emit malformed payloads, and (c) permits safe reprocessing without manual data repair.
- **Configured thresholds/events**: Numeric cutoffs and event predicates defined in runtime YAML config (`config/runtime/*.yaml`), loaded through validated config schema ownership at startup.
- **Sufficient investigation context**: Alert payload containing the FR-005 minimum fields plus source collector and correlation/run identifiers.
- **Usable technical output**: Output that includes all FR-010 required sections, even when some indicators are unavailable.
- **Meaningful market event**: A threshold breach or configured event predicate match that satisfies FR-004 and results in an alert candidate.

### Key Entities

- **CollectorOperationalState**: Agent runtime status record containing state, current task context, last activity timestamp, and error summary when applicable
- **MonitoringSnapshot**: Time-stamped market snapshot for a monitored instrument used for threshold/event comparisons
- **CollectorAlert**: Event record created when monitoring criteria are met, with type, severity context, and downstream investigation payload
- **DiscoveryRunResult**: Persisted output of a market discovery execution with trigger source and ranked candidates
- **ResearchCollectionOutput**: Structured mission collection payload containing gathered evidence and declared data gaps
- **TechnicalCollectionOutput**: Structured technical signal payload containing indicator values, pattern context, and confidence/limitations

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of active monitored instruments receive snapshots in each successful monitoring cycle
- **SC-002**: Threshold/event alerts are generated in 100% of threshold-breach test scenarios and 0% of within-threshold scenarios
- **SC-003**: Discovery runs persist outputs with trigger attribution and required result fields in 100% of test runs
- **SC-004**: Mission research collection returns validation-conformant structured payloads in 100% of healthy and partial-failure test scenarios
- **SC-005**: Technical collection outputs pass indicator-range and required-field validation in 100% of test scenarios
- **SC-006**: Scheduler initialization remains duplicate-free across repeated startup tests with no duplicate periodic registrations
- **SC-007**: Collector operational-state transitions (`active` -> `idle` or `error`) are emitted for 100% of collector executions
- **SC-008**: Offline test execution for collector workflows performs no external network calls and passes using mocks only
- **SC-009**: 100% of generated tasks for P1 stories include explicit requirement-ID references to `FR-*` and user-story IDs (`US1`, `US2`, `US3`, `US5`)

## 007/008 Compatibility Guardrails

- **CG-001**: 007 and 008 MUST consume 006 output contracts by field name and type exactly as defined in `apps/api/src/types/collectors.ts` and `contracts/collector-agents-contracts.md`.
- **CG-002**: Collector implementation style (deterministic orchestration vs model-assisted collection) is an internal 006 concern; downstream features MUST depend on contracts and boundaries, not internal execution style.
- **CG-003**: Screener evidence field for downstream consumers is `supportingHeadline`.
- **CG-004**: Technician confidence is numeric in `[0,1]` and MUST NOT be treated as enum text by downstream consumers.
- **CG-005**: Any future contract-breaking change in 006 requires synchronized spec/task updates across 006, 007, and 008 before implementation.
## Assumptions

- Feature `004-mcp-platform` provides stable tool contracts for all required market/news/retrieval inputs
- Feature `005-agent-infrastructure` provides stable collector access to tool registries, provider routing, and operational state conventions
- Collector outputs are consumed by downstream reasoning/orchestration features (007/008), which handle synthesis and user-facing conclusions
- Threshold values, schedules, and retry policies are defined in runtime configuration and may vary by environment
- Full optimization of signal quality/ranking algorithms is out of scope for this feature; this feature establishes reliable collection behavior

