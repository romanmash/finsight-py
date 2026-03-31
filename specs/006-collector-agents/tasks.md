# Tasks: Collector Agents

**Input**: Design documents from `/specs/006-collector-agents/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The feature specification explicitly defines independent test criteria and offline quality gates.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: Can run in parallel (different files, no dependency on unfinished tasks)
- `[Story]`: User story label (`[US1]`..`[US5]`) for story-phase tasks only
- Every task includes an exact file path and explicit traceability (`USx`, `FR-*`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish 006 scaffolding and config/schema surfaces needed by all stories.

- [X] T001 Create collector feature type scaffolding in apps/api/src/types/collectors.ts (US1,US2,US3,US4,US5; FR-001,FR-014)
- [X] T002 [P] Update watchdog runtime config values in config/runtime/watchdog.yaml (US1; FR-004,FR-015)
- [X] T003 [P] Update screener runtime config values in config/runtime/screener.yaml (US4; FR-006,FR-015,FR-017)
- [X] T004 [P] Update scheduler runtime config values in config/runtime/scheduler.yaml (US5; FR-011,FR-015)
- [X] T005 Extend collector runtime config schemas in config/types/watchdog.schema.ts, config/types/screener.schema.ts, and config/types/scheduler.schema.ts (US1,US4,US5; FR-004,FR-011,FR-015)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared collector-state, queue, and validation infrastructure required before user stories.

**CRITICAL**: No user-story implementation starts before this phase is complete.

- [X] T006 Implement collector operational-state helpers using `RedisKey.agentState(agentName)` and config-driven TTL default target (10 minutes unless overridden) in apps/api/src/agents/shared/collector-state.ts (US1,US2,US3,US4,US5; FR-014,FR-015)
- [X] T007 [P] Wire collector queue handles and retry defaults in apps/api/src/lib/queues.ts (US1,US4,US5; FR-013,FR-015)
- [X] T008 [P] Define shared collector validation schemas/enums in apps/api/src/types/collectors.ts (US1,US2,US3,US4; FR-005,FR-008,FR-009,FR-010,FR-017)
- [X] T009 Implement shared recoverable-failure utility for collector outputs in apps/api/src/agents/shared/collector-state.ts (US1,US2,US3,US4; FR-008,FR-013,FR-014)
- [X] T010 Add foundational offline mocks for collector dependencies in apps/api/src/lib/__tests__/mocks/collectors.ts (US1,US2,US3,US4,US5; FR-016)

**Checkpoint**: Foundational layer complete; user stories can proceed.

---

## Phase 3: User Story 1 - Proactive Watchlist Monitoring (Priority: P1) 🎯 MVP

**Goal**: Deliver Watchdog monitoring cycles with snapshot persistence, threshold/event detection, alert classification, and state transitions.

**Independent Test**: Execute one monitoring cycle and verify snapshot coverage, threshold-only alerts, and lifecycle state emissions.

### Tests for User Story 1

- [X] T011 [P] [US1] Add watchdog success-path integration test in apps/api/src/lib/__tests__/watchdog.test.ts (FR-003,FR-004,FR-005,SC-001,SC-002)
- [X] T012 [P] [US1] Add watchdog within-threshold no-alert test in apps/api/src/lib/__tests__/watchdog.test.ts (FR-004,SC-002)
- [X] T013 [P] [US1] Add watchdog partial-upstream-failure test in apps/api/src/lib/__tests__/watchdog.test.ts (FR-008,FR-016)
- [X] T014 [P] [US1] Add watchdog state-transition test (`active -> idle/error`) in apps/api/src/lib/__tests__/watchdog.test.ts (FR-014,SC-007)

### Implementation for User Story 1

- [X] T015 [US1] Implement Watchdog run contract and dependencies in apps/api/src/agents/watchdog.ts (FR-001,FR-002)
- [X] T016 [US1] Implement snapshot persistence for all monitored instruments in apps/api/src/agents/watchdog.ts (FR-003,SC-001)
- [X] T017 [US1] Implement threshold/event evaluation from runtime config in apps/api/src/agents/watchdog.ts (FR-004,FR-015)
- [X] T018 [US1] Implement alert classification with required context fields in apps/api/src/agents/watchdog.ts (FR-005)
- [X] T019 [US1] Implement watchdog alert categories (`price_spike`, `volume_spike`, `news_event`, `earnings_approaching`, `pattern_signal`) and queue handoff in apps/api/src/agents/watchdog.ts (FR-005)
- [X] T020 [US1] Implement batched quote retrieval + earnings checks + flagged-news fetch behavior in apps/api/src/agents/watchdog.ts (FR-004,FR-005)
- [X] T021 [US1] Integrate collector operational-state lifecycle handling in apps/api/src/agents/watchdog.ts (FR-014)
- [X] T022 [US1] Wire Watchdog worker execution to queue processor in apps/api/src/workers/watchdog-worker.ts (FR-011,FR-013)

**Checkpoint**: US1 independently functional and testable.

---

## Phase 4: User Story 2 - Mission Research Data Collection (Priority: P1)

**Goal**: Deliver Researcher collection outputs that are validated, boundary-safe, and recoverable under malformed output conditions.

**Independent Test**: Execute mission collection with mocked tools and verify schema-conformant output, explicit gaps on partial failures, and boundary compliance.

### Tests for User Story 2

- [X] T023 [P] [US2] Add researcher valid-output contract test in apps/api/src/lib/__tests__/researcher.test.ts (FR-007,SC-004)
- [X] T024 [P] [US2] Add researcher partial-upstream-failure test with explicit gaps in apps/api/src/lib/__tests__/researcher.test.ts (FR-007,FR-008,SC-004)
- [X] T025 [P] [US2] Add malformed-output recoverable-failure test in apps/api/src/lib/__tests__/researcher.test.ts (FR-008)
- [X] T026 [P] [US2] Add collector-boundary test to block thesis/recommendation content in apps/api/src/lib/__tests__/researcher.test.ts (FR-002)

### Implementation for User Story 2

- [X] T027 [US2] Implement Researcher agent orchestration entrypoint in apps/api/src/agents/researcher.ts (FR-001,FR-007)
- [X] T028 [US2] Implement validated structured researcher output mapping in apps/api/src/agents/researcher.ts (FR-007)
- [X] T029 [US2] Implement recoverable malformed-output handling in apps/api/src/agents/researcher.ts (FR-008)
- [X] T030 [US2] Enforce collection-only payload boundary in apps/api/src/agents/researcher.ts (FR-002)
- [X] T031 [US2] Implement mission-type coverage (`operator_query`, `alert_investigation`, `comparison`, `devil_advocate`, `earnings_prebrief`) plus optional KB context inclusion in apps/api/src/agents/researcher.ts (FR-007)
- [X] T032 [US2] Apply configurable multi-step tool-call budget wiring in apps/api/src/agents/researcher.ts (FR-015)

**Checkpoint**: US2 independently functional and testable.

---

## Phase 5: User Story 3 - Technical Signal Collection (Priority: P1)

**Goal**: Deliver Technician technical collection with deterministic indicator validation and partial-data degradation behavior.

**Independent Test**: Run technician collection for sufficient and insufficient history windows and verify required fields, ranges, and limitation semantics.

### Tests for User Story 3

- [X] T033 [P] [US3] Add technician indicator-range validation tests in apps/api/src/lib/__tests__/technician.test.ts (FR-009,SC-005)
- [X] T034 [P] [US3] Add technician required-output-section test in apps/api/src/lib/__tests__/technician.test.ts (FR-010,SC-005)
- [X] T035 [P] [US3] Add technician insufficient-history degradation test in apps/api/src/lib/__tests__/technician.test.ts (FR-010)
- [X] T036 [P] [US3] Add deterministic non-LLM indicator-math test in apps/api/src/lib/__tests__/technician.test.ts (FR-009)

### Implementation for User Story 3

- [X] T037 [US3] Implement Technician collection entrypoint in apps/api/src/agents/technician.ts (FR-001,FR-009,FR-010)
- [X] T038 [US3] Implement deterministic indicator computation and bounded-value checks in apps/api/src/agents/technician.ts (FR-009)
- [X] T039 [US3] Implement required output sections with explicit missing-indicator reason codes in apps/api/src/agents/technician.ts (FR-010)
- [X] T040 [US3] Implement insufficient-history confidence downgrade + limitations behavior in apps/api/src/agents/technician.ts (FR-010)

**Checkpoint**: US3 independently functional and testable.

---

## Phase 6: User Story 5 - Scheduled Execution Reliability (Priority: P1)

**Goal**: Deliver duplicate-safe periodic collector scheduling with observable retries and worker execution reliability.

**Independent Test**: Initialize scheduler repeatedly and validate no duplicate registrations; simulate transient worker failures and confirm retry observability.

### Tests for User Story 5

- [X] T041 [P] [US5] Add scheduler duplicate-registration prevention test in apps/api/src/lib/__tests__/scheduler.test.ts (FR-012,SC-006)
- [X] T042 [P] [US5] Add configured-cadence registration test in apps/api/src/lib/__tests__/scheduler.test.ts (FR-011,FR-015,SC-006)
- [X] T043 [P] [US5] Add transient-failure retry-observability test in apps/api/src/lib/__tests__/scheduler.test.ts (FR-013)
- [X] T044 [P] [US5] Add operational-state emission coverage test across collector workers in apps/api/src/lib/__tests__/scheduler.test.ts (FR-014,SC-007)

### Implementation for User Story 5

- [X] T045 [US5] Implement scheduler initialization and periodic job registration in apps/api/src/scheduler/init-scheduler.ts (FR-011)
- [X] T046 [US5] Implement duplicate-free scheduler registration across re-init/restart in apps/api/src/scheduler/init-scheduler.ts (FR-012)
- [X] T047 [US5] Implement retry policy and failure outcome observability in apps/api/src/scheduler/init-scheduler.ts (FR-013,FR-015)
- [X] T048 [US5] Wire screener worker job processing in apps/api/src/workers/screener-worker.ts (FR-011,FR-013)
- [X] T049 [US5] Wire daily brief periodic worker handlers in apps/api/src/workers/brief-worker.ts (FR-011,FR-013)
- [X] T050 [US5] Wire earnings periodic worker handlers in apps/api/src/workers/earnings-worker.ts (FR-011,FR-013)

**Checkpoint**: US5 independently functional and testable.

---

## Phase 7: User Story 4 - Market Discovery Scans (Priority: P2)

**Goal**: Deliver Screener scheduled/manual discovery runs with trigger provenance, ranked outputs, and empty-result semantics.

**Independent Test**: Run screener under scheduled and manual triggers and verify persistence, provenance, ranking fields, and no-candidate handling.

### Tests for User Story 4

- [X] T051 [P] [US4] Add screener scheduled-trigger persistence test in apps/api/src/lib/__tests__/screener.test.ts (FR-006,FR-017,SC-003)
- [X] T052 [P] [US4] Add screener manual-trigger persistence test in apps/api/src/lib/__tests__/screener.test.ts (FR-006,FR-017,SC-003)
- [X] T053 [P] [US4] Add screener ranked-result required-fields test in apps/api/src/lib/__tests__/screener.test.ts (FR-006,SC-003)
- [X] T054 [P] [US4] Add screener empty-results (`no_candidates`) contract test in apps/api/src/lib/__tests__/screener.test.ts (FR-006)

### Implementation for User Story 4

- [X] T055 [US4] Implement Screener collection entrypoint in apps/api/src/agents/screener.ts (FR-001,FR-006)
- [X] T056 [US4] Implement trigger provenance validation/enforcement (`scheduled` or `manual`) in apps/api/src/agents/screener.ts (FR-017)
- [X] T057 [US4] Implement ranked output persistence with required evidence fields in apps/api/src/agents/screener.ts (FR-006)
- [X] T058 [US4] Implement empty-result persistence semantics with `no_candidates` metadata in apps/api/src/agents/screener.ts (FR-006)

**Checkpoint**: US4 independently functional and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final traceability, quality gates, and documentation updates across all stories.

- [X] T059 Add requirement-to-task traceability matrix in specs/006-collector-agents/tasks.md (FR-018,SC-009)
- [X] T060 [P] Add collector operational docs and runbook notes in docs/TASK.md (US1,US2,US3,US4,US5; FR-014,FR-015)
- [X] T061 [P] Execute offline collector tests and stabilize failures in apps/api/src/lib/__tests__/watchdog.test.ts, apps/api/src/lib/__tests__/researcher.test.ts, apps/api/src/lib/__tests__/technician.test.ts, apps/api/src/lib/__tests__/screener.test.ts, and apps/api/src/lib/__tests__/scheduler.test.ts (FR-016,SC-008)
- [X] T062 Run quality gates and resolve findings: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm check:secrets` from package.json (FR-016)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all story work.
- Phases 3, 4, 5, 6, 7 (User Stories): all depend on Phase 2.
- Phase 8 (Polish): depends on completion of selected user stories.

### User Story Dependencies

- US1 (P1): starts after Phase 2; no dependency on other stories.
- US2 (P1): starts after Phase 2; independent of US1/US3/US4/US5.
- US3 (P1): starts after Phase 2; independent of US1/US2/US4/US5.
- US5 (P1): starts after Phase 2; provides scheduling infrastructure used by periodic flows.
- US4 (P2): starts after Phase 2; integrates with scheduler path from US5 for scheduled trigger execution.

### Within Each User Story

- Write tests first and confirm they fail.
- Implement agent/service logic.
- Wire worker/scheduler integration where relevant.
- Re-run story-specific tests before moving on.

## Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel: T002-T005.
- Foundational tasks marked `[P]` can run in parallel: T007, T008, T010.
- US1 tests T011-T014 can run in parallel.
- US2 tests T023-T026 can run in parallel.
- US3 tests T033-T036 can run in parallel.
- US5 tests T041-T044 can run in parallel.
- US4 tests T051-T054 can run in parallel.

## Parallel Example: P1 Stories After Foundation

```bash
Task: "T015 [US1] Implement Watchdog run contract and dependencies in apps/api/src/agents/watchdog.ts"
Task: "T027 [US2] Implement Researcher agent orchestration entrypoint in apps/api/src/agents/researcher.ts"
Task: "T037 [US3] Implement Technician collection entrypoint in apps/api/src/agents/technician.ts"
Task: "T045 [US5] Implement scheduler initialization and periodic job registration in apps/api/src/scheduler/init-scheduler.ts"
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) only.
3. Validate US1 independently (T011-T014 + monitoring smoke run).
4. Demo/deploy MVP if stable.

### Incremental Delivery

1. Add US2 (research collection), validate independently.
2. Add US3 (technical collection), validate independently.
3. Add US5 (scheduler reliability), validate independently.
4. Add US4 (discovery scans), validate independently.
5. Complete Phase 8 quality gates and traceability closure.

## Requirement-to-Task Traceability (P1 Mandatory)

- US1 -> T011-T022 (FR-001,FR-002,FR-003,FR-004,FR-005,FR-011,FR-013,FR-014,FR-015)
- US2 -> T023-T032 (FR-001,FR-002,FR-007,FR-008,FR-015)
- US3 -> T033-T040 (FR-001,FR-009,FR-010)
- US5 -> T041-T050 (FR-011,FR-012,FR-013,FR-014,FR-015)
- US4 -> T051-T058 (FR-001,FR-006,FR-017)
- Cross-cutting -> T059-T062 (FR-016,FR-018)
