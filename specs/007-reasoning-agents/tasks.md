# Tasks: Reasoning Agents

**Input**: Design documents from `/specs/007-reasoning-agents/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. The feature specification defines independent test criteria and constitution-aligned offline quality gates.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: Can run in parallel (different files, no dependency on unfinished tasks)
- `[Story]`: User story label (`[US1]`..`[US4]`) for story-phase tasks only
- Every task includes exact file paths and requirement traceability (`FR-*`, `SC-*`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare 007 runtime/config/test scaffolding used by all reasoning stories.

- [X] T001 Create baseline reasoning test files in apps/api/src/lib/__tests__/analyst.test.ts, apps/api/src/lib/__tests__/bookkeeper.test.ts, apps/api/src/lib/__tests__/reporter.test.ts, and apps/api/src/lib/__tests__/trader.test.ts (FR-001,FR-004,FR-012,FR-016)
- [X] T002 [P] Verify and document reasoning model/fallback config entries in config/runtime/agents.yaml (FR-002,FR-014,FR-017,FR-018)
- [X] T003 [P] Extend/align reasoning config schema validation for analyst/bookkeeper/reporter/trader settings in config/types/agents.schema.ts (FR-002,FR-004,FR-014,FR-017)
- [X] T004 [P] Add shared reasoning test fixtures and mock helpers in apps/api/src/lib/__tests__/mocks/reasoning.ts (FR-004,FR-009,FR-014,FR-017)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement common reasoning contracts, validators, and shared boundaries required before user-story work.

**CRITICAL**: No user-story implementation starts before this phase is complete.

- [X] T005 Implement shared reasoning output schemas and type guards in apps/api/src/types/reasoning.ts (FR-004,FR-008,FR-009,FR-017)
- [X] T006 [P] Implement reasoning error and retry utilities for malformed model output paths in apps/api/src/agents/shared/reasoning-validation.ts (FR-004,FR-005)
- [X] T007 [P] Implement shared thesis context access helper for current-thesis and portfolio lookup in apps/api/src/agents/shared/thesis-context.ts (FR-003,FR-006,FR-016)
- [X] T008 Implement 006-compatibility contract mapper for collector payloads in apps/api/src/agents/shared/collector-contracts.ts (FR-021,FR-022,FR-023,FR-024)
- [X] T009 [P] Add foundational offline tests for shared reasoning contracts/helpers in apps/api/src/lib/__tests__/reasoning-foundation.test.ts (FR-004,FR-021,FR-022,FR-023)

**Checkpoint**: Foundational layer complete; user stories can proceed independently.

---

## Phase 3: User Story 1 - Synthesize Actionable Thesis (Priority: P1) 🎯 MVP

**Goal**: Deliver Analyst mode-driven synthesis with strict schema validation, portfolio-aware behavior, and tool-free analysis boundary.

**Independent Test**: Provide fixture research payloads and verify valid outputs for all modes plus deterministic malformed-output retry/fail behavior.

### Tests for User Story 1

- [X] T010 [P] [US1] Add Analyst standard-mode contract test in apps/api/src/lib/__tests__/analyst.test.ts (FR-002,SC-001)
- [X] T011 [P] [US1] Add Analyst devil-advocate-mode contract test in apps/api/src/lib/__tests__/analyst.test.ts (FR-002,SC-001)
- [X] T012 [P] [US1] Add Analyst comparison-mode output test with comparison table in apps/api/src/lib/__tests__/analyst.test.ts (FR-002,SC-002)
- [X] T013 [P] [US1] Add Analyst portfolio-context inclusion test in apps/api/src/lib/__tests__/analyst.test.ts (FR-003)
- [X] T014 [P] [US1] Add malformed-output retry-once then fail test in apps/api/src/lib/__tests__/analyst.test.ts (FR-004)
- [X] T015 [P] [US1] Add no-tool-call boundary assertion test for Analyst in apps/api/src/lib/__tests__/analyst.test.ts (FR-005)

### Implementation for User Story 1

- [X] T016 [US1] Implement Analyst entrypoint and mode routing in apps/api/src/agents/analyst.ts (FR-001,FR-002)
- [X] T017 [US1] Implement Analyst schema-validation and retry handling in apps/api/src/agents/analyst.ts (FR-004)
- [X] T018 [US1] Implement portfolio-aware context enrichment in apps/api/src/agents/analyst.ts and apps/api/src/agents/portfolio-context.prompt.ts (FR-003)
- [X] T019 [US1] Implement tool-free synthesis invocation path in apps/api/src/agents/analyst.ts (FR-005)
- [X] T020 [US1] Align Analyst prompts for standard/devil-advocate behavior in apps/api/src/agents/analyst.prompt.ts and apps/api/src/agents/analyst.devil-advocate.prompt.ts (FR-002)

**Checkpoint**: US1 independently functional and testable.

---

## Phase 4: User Story 2 - Preserve Thesis Memory and Contradictions (Priority: P1)

**Goal**: Deliver Bookkeeper transactional KB persistence with snapshot-first updates, contradiction severity gating, and embedding-required durability.

**Independent Test**: Run new/update thesis flows and verify snapshot rules, contradiction alert gating, embedding enforcement, and atomic rollback behavior.

### Tests for User Story 2

- [X] T021 [P] [US2] Add Bookkeeper initial-entry persistence test in apps/api/src/lib/__tests__/bookkeeper.test.ts (FR-008,SC-003)
- [X] T022 [P] [US2] Add non-initial snapshot-before-overwrite test in apps/api/src/lib/__tests__/bookkeeper.test.ts (FR-007,SC-003)
- [X] T023 [P] [US2] Add high-severity contradiction-alert creation test in apps/api/src/lib/__tests__/bookkeeper.test.ts (FR-009,SC-004)
- [X] T024 [P] [US2] Add low/none contradiction no-alert test in apps/api/src/lib/__tests__/bookkeeper.test.ts (FR-009,SC-004)
- [X] T025 [P] [US2] Add embedding-failure abort test in apps/api/src/lib/__tests__/bookkeeper.test.ts (FR-011,SC-005)
- [X] T026 [P] [US2] Add transaction rollback integrity test in apps/api/src/lib/__tests__/bookkeeper.test.ts (FR-010)

### Implementation for User Story 2

- [X] T027 [US2] Implement Bookkeeper entrypoint with prior-thesis lookup in apps/api/src/agents/bookkeeper.ts (FR-001,FR-006)
- [X] T028 [US2] Implement snapshot-first update flow and change-type handling in apps/api/src/agents/bookkeeper.ts (FR-007,FR-008)
- [X] T029 [US2] Implement contradiction assessment and high-only alert emission in apps/api/src/agents/bookkeeper.ts and apps/api/src/agents/bookkeeper.contradiction.prompt.ts (FR-009)
- [X] T030 [US2] Implement embedding-required KB write path in apps/api/src/agents/bookkeeper.ts (FR-011,SC-005)
- [X] T031 [US2] Implement transactional persistence for entry/snapshot/alert effects in apps/api/src/agents/bookkeeper.ts (FR-010)

**Checkpoint**: US2 independently functional and testable.

---

## Phase 5: User Story 3 - Deliver Readable Mission Output (Priority: P1)

**Goal**: Deliver Reporter mission-aware formatting and Telegram delivery with provider fallback, message chunking, and daily-brief persistence.

**Independent Test**: Feed structured outputs and verify labeling, fallback behavior, chunking for oversized content, and daily-brief persistence.

### Tests for User Story 3

- [X] T032 [P] [US3] Add mission-type labeling output test in apps/api/src/lib/__tests__/reporter.test.ts (FR-012,SC-006)
- [X] T033 [P] [US3] Add formatter primary-to-fallback behavior test in apps/api/src/lib/__tests__/reporter.test.ts (FR-014)
- [X] T034 [P] [US3] Add Telegram oversized-message chunking test in apps/api/src/lib/__tests__/reporter.test.ts (FR-013,SC-006)
- [X] T035 [P] [US3] Add daily-brief persistence + delivery test in apps/api/src/lib/__tests__/reporter.test.ts (FR-015)

### Implementation for User Story 3

- [X] T036 [US3] Implement Reporter formatting entrypoint and label selection in apps/api/src/agents/reporter.ts (FR-001,FR-012)
- [X] T037 [US3] Implement formatter provider fallback logic in apps/api/src/agents/reporter.ts (FR-014)
- [X] T038 [US3] Implement Telegram message chunking and ordered delivery in apps/api/src/agents/reporter.ts (FR-013)
- [X] T039 [US3] Implement daily-brief persistence integration in apps/api/src/agents/reporter.ts and apps/api/src/routes/briefs.ts (FR-015)
- [X] T040 [US3] Align Reporter prompt template for formatting-only role boundary in apps/api/src/agents/reporter.prompt.ts (FR-012)

**Checkpoint**: US3 independently functional and testable.

---

## Phase 6: User Story 4 - Propose Human-Approved Trade Tickets (Priority: P2)

**Goal**: Deliver Trader ticket proposal flow with thesis-aware rationale, strict safety warning, and non-held sell rejection.

**Independent Test**: Submit valid/invalid trade intents and verify pending-approval ticket creation with exactly three-sentence rationale and required guardrails.

### Tests for User Story 4

- [X] T041 [P] [US4] Add pending-approval ticket creation test in apps/api/src/lib/__tests__/trader.test.ts (FR-018,SC-007)
- [X] T042 [P] [US4] Add exactly-three-sentence rationale validation test in apps/api/src/lib/__tests__/trader.test.ts (FR-017)
- [X] T043 [P] [US4] Add mandatory human-approval warning inclusion test in apps/api/src/lib/__tests__/trader.test.ts (FR-019,SC-007)
- [X] T044 [P] [US4] Add non-held sell rejection test in apps/api/src/lib/__tests__/trader.test.ts (FR-020,SC-008)
- [X] T045 [P] [US4] Add thesis-context prerequisite test for ticket generation in apps/api/src/lib/__tests__/trader.test.ts (FR-016)

### Implementation for User Story 4

- [X] T046 [US4] Implement Trader entrypoint with thesis-context load in apps/api/src/agents/trader.ts (FR-001,FR-016)
- [X] T047 [US4] Implement three-sentence rationale generation and validation in apps/api/src/agents/trader.ts and apps/api/src/agents/trader.prompt.ts (FR-017)
- [X] T048 [US4] Implement ticket creation with pending-approval status and warning text enforcement in apps/api/src/agents/trader.ts (FR-018,FR-019)
- [X] T049 [US4] Implement non-held sell guardrail rejection in apps/api/src/agents/trader.ts (FR-020)

**Checkpoint**: US4 independently functional and testable.

---

## Phase 7: Compatibility and Cross-Cutting Validation

**Purpose**: Ensure 006/007/008 contract continuity and finalize quality gates.

- [X] T050 Validate and enforce 006 collector payload compatibility mapping in apps/api/src/agents/shared/collector-contracts.ts and apps/api/src/lib/__tests__/reasoning-foundation.test.ts (FR-021,FR-022,FR-023)
- [X] T051 [P] Add 006/007/008 contract synchronization checklist notes in specs/007-reasoning-agents/checklists/reasoning.md (FR-024)
- [X] T052 [P] Execute offline targeted reasoning test suites in apps/api/src/lib/__tests__/analyst.test.ts, apps/api/src/lib/__tests__/bookkeeper.test.ts, apps/api/src/lib/__tests__/reporter.test.ts, and apps/api/src/lib/__tests__/trader.test.ts (SC-001..SC-008)
- [X] T053 Run repository quality gates and resolve findings: `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm check:secrets` via package.json (FR-001..FR-024)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user-story implementation.
- Phases 3, 4, 5, and 6 (User Stories): all depend on Phase 2; then can proceed independently.
- Phase 7 (Compatibility/Cross-Cutting): depends on completion of selected user stories.

### User Story Dependencies

- US1 (P1): starts after Phase 2; independent of US2/US3/US4.
- US2 (P1): starts after Phase 2; independent of US1/US3/US4.
- US3 (P1): starts after Phase 2; depends only on shared reasoning foundation.
- US4 (P2): starts after Phase 2; can run independently but typically follows US1/US2 for richer context.

### Within Each User Story

- Write tests first and confirm they fail.
- Implement core story behavior and validations.
- Wire persistence/integration touchpoints.
- Re-run story-specific tests before moving to next story.

## Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel: T002-T004.
- Foundational tasks marked `[P]` can run in parallel: T006, T007, T009.
- US1 tests T010-T015 can run in parallel.
- US2 tests T021-T026 can run in parallel.
- US3 tests T032-T035 can run in parallel.
- US4 tests T041-T045 can run in parallel.
- Cross-cutting tasks T051-T052 can run in parallel.

## Parallel Example: P1 Stories After Foundation

```bash
Task: "T016 [US1] Implement Analyst entrypoint and mode routing in apps/api/src/agents/analyst.ts"
Task: "T027 [US2] Implement Bookkeeper entrypoint with prior-thesis lookup in apps/api/src/agents/bookkeeper.ts"
Task: "T036 [US3] Implement Reporter formatting entrypoint and label selection in apps/api/src/agents/reporter.ts"
```

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) only.
3. Validate US1 independently (T010-T015).
4. Demo/deploy MVP behavior for analysis synthesis.

### Incremental Delivery

1. Add US2 (Bookkeeper memory/contradictions), validate independently.
2. Add US3 (Reporter delivery/fallback/chunking), validate independently.
3. Add US4 (Trader ticket proposals), validate independently.
4. Complete Phase 7 contract and quality gate closure.

## Requirement-to-Task Traceability

- US1 -> T010-T020 (FR-001,FR-002,FR-003,FR-004,FR-005; SC-001,SC-002)
- US2 -> T021-T031 (FR-001,FR-006,FR-007,FR-008,FR-009,FR-010,FR-011; SC-003,SC-004,SC-005)
- US3 -> T032-T040 (FR-001,FR-012,FR-013,FR-014,FR-015; SC-006)
- US4 -> T041-T049 (FR-001,FR-016,FR-017,FR-018,FR-019,FR-020; SC-007,SC-008)
- Cross-cutting -> T050-T053 (FR-021,FR-022,FR-023,FR-024)
