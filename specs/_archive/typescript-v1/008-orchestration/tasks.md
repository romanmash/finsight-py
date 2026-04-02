# Tasks: Orchestration

**Input**: Design documents from `/specs/008-orchestration/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included. The feature spec defines independent test criteria and measurable orchestration outcomes.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: Can run in parallel (different files, no dependency on unfinished tasks)
- `[Story]`: User story label (`[US1]`..`[US6]`) for story-phase tasks only
- Every task includes exact file paths and requirement traceability (`FR-*`, `CFR-*`, `SC-*`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare 008 orchestration scaffolding and test files.

- [X] T001 Create orchestration test baselines in `apps/api/src/lib/__tests__/manager.test.ts`, `apps/api/src/lib/__tests__/chat-route.test.ts`, `apps/api/src/lib/__tests__/missions-route.test.ts`, `apps/api/src/lib/__tests__/kb-route.test.ts`, `apps/api/src/lib/__tests__/alerts-route.test.ts`, `apps/api/src/lib/__tests__/tickets-route.test.ts`, `apps/api/src/lib/__tests__/portfolio-route.test.ts`, `apps/api/src/lib/__tests__/watchlist-route.test.ts`, `apps/api/src/lib/__tests__/alert-pipeline-worker.test.ts`, and `apps/api/src/lib/__tests__/screener-route.test.ts` (FR-001..FR-020, SC-001..SC-007)
- [X] T002 [P] Add orchestration test fixtures/mocks in `apps/api/src/lib/__tests__/mocks/orchestration.ts` (FR-001, FR-006, FR-007, FR-009)
- [X] T003 [P] Verify routing/re-dispatch/scheduling config coverage in `config/runtime/agents.yaml` and `config/runtime/scheduler.yaml` (FR-004, FR-007, FR-018..FR-020)
- [X] T004 [P] Extend config schema validation for orchestration policy fields in `config/types/agents.schema.ts` and `config/types/scheduler.schema.ts` (FR-004, FR-007, FR-019, FR-020)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement core orchestration contracts and shared primitives required by all user stories.

**CRITICAL**: No user story work starts before this phase is complete.

- [X] T005 Implement orchestration domain types/schemas in `apps/api/src/types/orchestration.ts` (FR-001, FR-002, FR-006, FR-007)
- [X] T006 [P] Implement mission routing-table and pipeline resolver in `apps/api/src/agents/shared/mission-routing.ts` (FR-002, FR-024)
- [X] T007 [P] Implement KB fast-path policy helper in `apps/api/src/agents/shared/fast-path.ts` (FR-004, FR-005, FR-025)
- [X] T008 [P] Implement bounded confidence re-dispatch helper in `apps/api/src/agents/shared/re-dispatch.ts` (FR-007, FR-008, SC-007)
- [X] T009 [P] Implement orchestration compatibility guards for 006/007 contracts in `apps/api/src/agents/shared/orchestration-compatibility.ts` (FR-021, FR-022, CFR-006-001..CFR-007-002, SC-008)
- [X] T010 Implement mission/agent-run lifecycle helper in `apps/api/src/agents/shared/mission-lifecycle.ts` (FR-003, FR-009, SC-005)
- [X] T011 [P] Add foundational orchestration helper tests in `apps/api/src/lib/__tests__/manager-foundation.test.ts` (FR-002, FR-004, FR-007, FR-009)

**Checkpoint**: Foundation complete; user-story implementation can proceed independently.

---

## Phase 3: User Story 1 - Classify Intent and Route Correct Pipeline (Priority: P1) 🎯 MVP

**Goal**: Manager classifies requests and dispatches the correct mission pipeline.

**Independent Test**: Trigger each mission type through chat/manager entry and verify mission type + route-table pipeline selection.

### Tests for User Story 1

- [X] T012 [P] [US1] Add mission-intent classification tests in `apps/api/src/lib/__tests__/manager.test.ts` (FR-001, FR-002, SC-001)
- [X] T013 [P] [US1] Add explicit routing-table conformance tests in `apps/api/src/lib/__tests__/manager.test.ts` (FR-002, FR-024, SC-001)
- [X] T014 [P] [US1] Add mission lifecycle + agent-run accounting tests in `apps/api/src/lib/__tests__/manager.test.ts` (FR-003, FR-009, SC-005)

### Implementation for User Story 1

- [X] T015 [US1] Implement Manager orchestrator entrypoint in `apps/api/src/agents/manager.ts` (FR-001, FR-003)
- [X] T016 [US1] Implement intent classification and route selection in `apps/api/src/agents/manager.ts` (FR-002, FR-024)
- [X] T017 [US1] Implement mission + agent-run lifecycle logging in `apps/api/src/agents/manager.ts` and `apps/api/src/agents/shared/mission-lifecycle.ts` (FR-003, FR-009)
- [X] T018 [US1] Wire chat route to Manager in `apps/api/src/routes/chat.ts` and mount in `apps/api/src/app.ts` (FR-010, SC-006)

**Checkpoint**: US1 independently functional and testable.

---

## Phase 4: User Story 2 - Reuse Fresh High-Confidence Thesis (Priority: P1)

**Goal**: Enable deterministic KB fast-path for eligible operator queries.

**Independent Test**: Seed thesis freshness/confidence permutations and verify fast-path hit/miss and step-skipping behavior.

### Tests for User Story 2

- [X] T019 [P] [US2] Add fast-path eligibility tests in `apps/api/src/lib/__tests__/manager.test.ts` (FR-004, FR-005, SC-002, SC-003)
- [X] T020 [P] [US2] Add fast-path skip-step tests (no Researcher/Analyst run records) in `apps/api/src/lib/__tests__/manager.test.ts` (FR-025, SC-002)

### Implementation for User Story 2

- [X] T021 [US2] Implement fast-path lookup + gate evaluation in `apps/api/src/agents/manager.ts` and `apps/api/src/agents/shared/fast-path.ts` (FR-004, FR-005)
- [X] T022 [US2] Implement fast-path short-circuit mission response path in `apps/api/src/agents/manager.ts` (FR-025, SC-002)

**Checkpoint**: US2 independently functional and testable.

---

## Phase 5: User Story 3 - Execute Comparison Research in Parallel (Priority: P1)

**Goal**: Ensure comparison missions run dual researcher branches concurrently and fail safely.

**Independent Test**: Run comparison mission and verify concurrent branch start and all-or-nothing completion.

### Tests for User Story 3

- [X] T023 [P] [US3] Add parallel dispatch timing test in `apps/api/src/lib/__tests__/manager.test.ts` (FR-006, SC-004)
- [X] T024 [P] [US3] Add all-branch-required failure test in `apps/api/src/lib/__tests__/manager.test.ts` (FR-006)
- [X] T025 [P] [US3] Add comparison handoff shape test in `apps/api/src/lib/__tests__/manager.test.ts` (FR-006, CFR-007-001)

### Implementation for User Story 3

- [X] T026 [US3] Implement parallel researcher branch execution in `apps/api/src/agents/manager.ts` (FR-006, SC-004)
- [X] T027 [US3] Implement branch failure handling and mission failure propagation in `apps/api/src/agents/manager.ts` (FR-006)
- [X] T028 [US3] Enforce two-instrument comparison cardinality and handoff invariants in `apps/api/src/agents/manager.ts` and `apps/api/src/agents/shared/orchestration-compatibility.ts` (FR-006, RC-003, CFR-007-001)

**Checkpoint**: US3 independently functional and testable.

---

## Phase 6: User Story 4 - Improve Low-Confidence Results via Re-dispatch (Priority: P2)

**Goal**: Apply bounded, policy-controlled re-dispatch for low-confidence reasoning.

**Independent Test**: Toggle policy and verify exactly-one-cycle behavior versus no re-dispatch behavior.

### Tests for User Story 4

- [X] T029 [P] [US4] Add re-dispatch enabled behavior test in `apps/api/src/lib/__tests__/manager.test.ts` (FR-007, FR-008, SC-007)
- [X] T030 [P] [US4] Add re-dispatch disabled behavior test in `apps/api/src/lib/__tests__/manager.test.ts` (FR-007, SC-007)
- [X] T031 [P] [US4] Add bounded-single-cycle guard test in `apps/api/src/lib/__tests__/manager.test.ts` (RC-002, SC-007)

### Implementation for User Story 4

- [X] T032 [US4] Implement policy-gated low-confidence re-dispatch flow in `apps/api/src/agents/manager.ts` and `apps/api/src/agents/shared/re-dispatch.ts` (FR-007, FR-008)
- [X] T033 [US4] Implement contradiction/open-question follow-up input shaping in `apps/api/src/agents/manager.ts` (FR-008)

**Checkpoint**: US4 independently functional and testable.

---

## Phase 7: User Story 5 - Expose Orchestration and Domain Read APIs (Priority: P1)

**Goal**: Provide complete route surface for dashboard/bot mission and domain workflows.

**Independent Test**: Execute route contract tests for chat, missions, KB, portfolio, watchlist, alerts, tickets, briefs, and screener summary.

### Tests for User Story 5

- [X] T034 [P] [US5] Add chat route contract test in `apps/api/src/lib/__tests__/chat-route.test.ts` (FR-010, SC-006)
- [X] T035 [P] [US5] Add mission list/detail route tests in `apps/api/src/lib/__tests__/missions-route.test.ts` (FR-011, SC-006)
- [X] T036 [P] [US5] Add KB route tests in `apps/api/src/lib/__tests__/kb-route.test.ts` (FR-012, SC-006)
- [X] T037 [P] [US5] Add portfolio route tests in `apps/api/src/lib/__tests__/portfolio-route.test.ts` (FR-013, SC-006)
- [X] T038 [P] [US5] Add watchlist route tests in `apps/api/src/lib/__tests__/watchlist-route.test.ts` (FR-014, SC-006)
- [X] T039 [P] [US5] Add alerts route tests in `apps/api/src/lib/__tests__/alerts-route.test.ts` (FR-015, SC-006)
- [X] T040 [P] [US5] Add ticket transition guard tests in `apps/api/src/lib/__tests__/tickets-route.test.ts` (FR-016, FR-026, SC-006)
- [X] T041 [P] [US5] Add briefs latest and screener summary route tests in `apps/api/src/lib/__tests__/briefs-route.test.ts` and `apps/api/src/lib/__tests__/screener-route.test.ts` (FR-017, FR-029, SC-006, SC-009)

### Implementation for User Story 5

- [X] T042 [US5] Implement missions routes in `apps/api/src/routes/missions.ts` and mount via `apps/api/src/app.ts` (FR-011, SC-006)
- [X] T043 [US5] Implement KB routes in `apps/api/src/routes/kb.ts` and mount via `apps/api/src/app.ts` (FR-012, SC-006)
- [X] T044 [US5] Implement portfolio routes in `apps/api/src/routes/portfolio.ts` and mount via `apps/api/src/app.ts` (FR-013, SC-006)
- [X] T045 [US5] Implement watchlist routes in `apps/api/src/routes/watchlist.ts` and mount via `apps/api/src/app.ts` (FR-014, SC-006)
- [X] T046 [US5] Implement alert routes in `apps/api/src/routes/alerts.ts` and mount via `apps/api/src/app.ts` (FR-015, SC-006)
- [X] T047 [US5] Implement ticket routes with transition guards in `apps/api/src/routes/tickets.ts` and mount via `apps/api/src/app.ts` (FR-016, FR-026, SC-006)
- [X] T048 [US5] Extend/align briefs route contract in `apps/api/src/routes/briefs.ts` and route mounting in `apps/api/src/app.ts` (FR-017)
- [X] T049 [US5] Implement screener summary route in `apps/api/src/routes/screener.ts` and mount via `apps/api/src/app.ts` (FR-029, SC-009)

**Checkpoint**: US5 independently functional and testable.

---

## Phase 8: User Story 6 - Provide Mission-Level Observability (Priority: P2)

**Goal**: Persist and expose mission-level trace metadata for operator debugging.

**Independent Test**: Execute mission and verify mission detail includes trace-link metadata.

### Tests for User Story 6

- [X] T050 [P] [US6] Add mission trace-link persistence test in `apps/api/src/lib/__tests__/manager.test.ts` (FR-028)
- [X] T051 [P] [US6] Add mission detail trace metadata response test in `apps/api/src/lib/__tests__/missions-route.test.ts` (FR-028)

### Implementation for User Story 6

- [X] T052 [US6] Implement mission-level trace metadata capture in `apps/api/src/agents/manager.ts` and `apps/api/src/lib/status-aggregation.ts` (FR-028)
- [X] T053 [US6] Expose trace metadata in mission detail route responses in `apps/api/src/routes/missions.ts` (FR-028)

**Checkpoint**: US6 independently functional and testable.

---

## Phase 9: Workers and Cross-Cutting Compatibility

**Purpose**: Complete worker orchestration and lock 006/007/008 compatibility guarantees.

- [X] T054 Implement alert pipeline worker orchestration in `apps/api/src/workers/alert-pipeline-worker.ts` and register in `apps/api/src/workers/init-workers.ts` (FR-018, FR-027)
- [X] T055 Implement/align daily brief worker orchestration in `apps/api/src/workers/brief-worker.ts` and scheduler hookup in `apps/api/src/scheduler/init-scheduler.ts` (FR-019, FR-027)
- [X] T056 Implement/align earnings worker orchestration in `apps/api/src/workers/earnings-worker.ts` and scheduler hookup in `apps/api/src/scheduler/init-scheduler.ts` (FR-020, FR-027)
- [X] T057 [P] Add worker orchestration tests in `apps/api/src/lib/__tests__/alert-pipeline-worker.test.ts`, `apps/api/src/lib/__tests__/brief-worker.test.ts`, and `apps/api/src/lib/__tests__/earnings-worker.test.ts` (FR-018..FR-020)
- [X] T058 [P] Add 006/007/008 compatibility tests in `apps/api/src/lib/__tests__/orchestration-compatibility.test.ts` (FR-021, FR-022, CFR-006-001..CFR-007-002, SC-008)
- [X] T059 [P] Add/update compatibility checklist notes in `specs/008-orchestration/checklists/requirements.md` (FR-023)

---

## Phase 10: Polish & Validation

**Purpose**: Final validation and quality-gate closure.

- [X] T060 Run targeted orchestration suites in `apps/api/src/lib/__tests__/manager.test.ts`, route tests, and worker tests (SC-001..SC-009)
- [X] T061 Run repository quality gates and resolve findings in workspace configs `package.json`, `pnpm-workspace.yaml`, and app packages via `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm check:secrets` (FR-001..FR-029)
- [X] T062 Validate `specs/008-orchestration/quickstart.md` end-to-end scenarios and record completion evidence (SC-001..SC-009)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user-story implementation.
- Phases 3-8 (User Stories): depend on Phase 2; then can proceed independently by priority.
- Phase 9 (Workers/Cross-Cutting): depends on completion of core manager and route stories.
- Phase 10 (Polish): depends on all implementation phases.

### User Story Dependencies

- US1 (P1): starts after Phase 2; establishes Manager orchestration baseline.
- US2 (P1): depends on US1 manager baseline.
- US3 (P1): depends on US1 manager baseline.
- US4 (P2): depends on US1 and US3 reasoning orchestration paths.
- US5 (P1): depends on US1 for chat/mission integration.
- US6 (P2): depends on US1 + mission route surfaces from US5.

### Within Each User Story

- Write tests first and confirm they fail.
- Implement core story behavior.
- Wire integration touchpoints.
- Re-run story-specific tests before moving on.

## Parallel Opportunities

- Setup tasks T002-T004 run in parallel.
- Foundational tasks T006-T009 and T011 run in parallel.
- US5 route tests T034-T041 run in parallel.
- Worker/cross-cutting tests T057-T059 run in parallel.

## Parallel Example: Core Orchestration Build

```bash
Task: "T015 [US1] Implement Manager orchestrator entrypoint in apps/api/src/agents/manager.ts"
Task: "T042 [US5] Implement missions routes in apps/api/src/routes/missions.ts"
Task: "T054 Implement alert pipeline worker orchestration in apps/api/src/workers/alert-pipeline-worker.ts"
```

## Implementation Strategy

### MVP First (US1 + US2 + US5 core)

1. Complete Phase 1 and Phase 2.
2. Complete US1 for manager routing.
3. Complete US2 for fast-path behavior.
4. Complete US5 chat/mission/KB/ticket/brief route surface.
5. Validate end-to-end core operator query path.

### Incremental Delivery

1. Add US3 parallel comparison behavior.
2. Add US4 bounded re-dispatch behavior.
3. Add US6 mission trace observability.
4. Add worker and cross-feature compatibility completion (Phase 9).
5. Execute Phase 10 quality gates.

## Requirement-to-Task Traceability

- US1 -> T012-T018 (FR-001, FR-002, FR-003, FR-009, FR-010, FR-024; SC-001, SC-005)
- US2 -> T019-T022 (FR-004, FR-005, FR-025; SC-002, SC-003)
- US3 -> T023-T028 (FR-006, CFR-007-001; SC-004)
- US4 -> T029-T033 (FR-007, FR-008; SC-007)
- US5 -> T034-T049 (FR-010..FR-017, FR-026, FR-029; SC-006, SC-009)
- US6 -> T050-T053 (FR-028)
- Workers/Cross-cutting -> T054-T062 (FR-018..FR-023, FR-027, CFR-006-001..CFR-007-002; SC-008)

