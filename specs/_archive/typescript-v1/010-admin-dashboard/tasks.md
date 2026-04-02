# Tasks: Admin Dashboard Mission Control

**Input**: Design documents from `/specs/010-admin-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included as required by constitution quality gates and offline validation policy.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create dashboard workspace and baseline frontend shell.

- [X] T001 Create dashboard workspace package in `apps/dashboard/package.json`
- [X] T002 Create dashboard TypeScript and Vite config in `apps/dashboard/tsconfig.json` and `apps/dashboard/vite.config.ts`
- [X] T003 [P] Create dashboard HTML entrypoint in `apps/dashboard/index.html`
- [X] T004 [P] Create dashboard React bootstrap files in `apps/dashboard/src/main.tsx` and `apps/dashboard/src/app/App.tsx`
- [X] T005 [P] Create dashboard router shell in `apps/dashboard/src/app/router.tsx`
- [X] T006 Register dashboard workspace in root `pnpm-workspace.yaml` and root `package.json` scripts
- [X] T007 Create dashboard Vitest setup in `apps/dashboard/src/__tests__/setup.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared contracts, clients, and state foundations required by all stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 Implement dashboard status and UI domain types in `apps/dashboard/src/status/status-types.ts`
- [X] T009 Implement authenticated API client foundation in `apps/dashboard/src/status/status-client.ts`
- [X] T010 Implement reusable session-state module in `apps/dashboard/src/auth/session.ts`
- [X] T011 Implement `AuthProvider` context shell in `apps/dashboard/src/auth/AuthProvider.tsx`
- [X] T012 Implement shared app styles and design tokens bridge in `apps/dashboard/src/app/styles.css`
- [X] T013 Implement base dashboard page layout scaffold in `apps/dashboard/src/dashboard/DashboardPage.tsx`
- [X] T014 Implement `useAdminStatus` hook skeleton with polling lifecycle in `apps/dashboard/src/status/useAdminStatus.ts`
- [X] T015 Add foundational tests for status-client/session helpers in `apps/dashboard/src/__tests__/foundation.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Admin Access and Session Continuity (Priority: P1) 🎯 MVP

**Goal**: Enforce admin-only access, sign-in flow, and deterministic session-clear behavior.

**Independent Test**: Start unauthenticated, confirm sign-in gate; authenticate as admin, confirm dashboard access; force auth failure, confirm session clear + redirect.

### Tests for User Story 1

- [X] T016 [P] [US1] Add auth-gate route tests in `apps/dashboard/src/__tests__/auth-gate.test.tsx`
- [X] T017 [P] [US1] Add login/session continuity tests in `apps/dashboard/src/__tests__/auth-session.test.tsx`
- [X] T018 [P] [US1] Add unauthorized-response handling tests in `apps/dashboard/src/__tests__/auth-failure.test.tsx`

### Implementation for User Story 1

- [X] T019 [US1] Implement login page and form state in `apps/dashboard/src/auth/LoginPage.tsx`
- [X] T020 [US1] Implement sign-in and session bootstrap flow in `apps/dashboard/src/auth/AuthProvider.tsx`
- [X] T021 [US1] Implement protected route behavior in `apps/dashboard/src/app/router.tsx`
- [X] T022 [US1] Implement session clear + redirect on 401/403 handling in `apps/dashboard/src/status/status-client.ts` and `apps/dashboard/src/auth/session.ts`
- [X] T023 [US1] Implement session-renewal lead window logic (60s before expiry) in `apps/dashboard/src/auth/session.ts` and `apps/dashboard/src/auth/AuthProvider.tsx`
- [X] T024 [US1] Wire auth shell into app root in `apps/dashboard/src/app/App.tsx`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Live Agent and Mission Visibility (Priority: P1)

**Goal**: Render 9-agent floor and active mission pipeline with clear execution states.

**Independent Test**: With mocked status snapshots, verify all 9 agent cards render and mission panel reflects active/no-active states with ordered pipeline semantics.

### Tests for User Story 2

- [X] T025 [P] [US2] Add agent-floor rendering tests for 9-agent coverage in `apps/dashboard/src/__tests__/agent-floor.test.tsx`
- [X] T026 [P] [US2] Add mission-pipeline state rendering tests in `apps/dashboard/src/__tests__/mission-pipeline.test.tsx`
- [X] T027 [P] [US2] Add mission-log rendering tests in `apps/dashboard/src/__tests__/mission-log.test.tsx`

### Implementation for User Story 2

- [X] T028 [US2] Implement `AgentFloor` component with state semantics in `apps/dashboard/src/dashboard/AgentFloor.tsx`
- [X] T029 [US2] Implement `MissionPipeline` component with step/tool-call status visualization in `apps/dashboard/src/dashboard/MissionPipeline.tsx`
- [X] T030 [US2] Implement `MissionLog` component for recent mission list in `apps/dashboard/src/dashboard/MissionLog.tsx`
- [X] T031 [US2] Implement mission-log cap (last 10 completed/failed) and LangSmith link rendering when trace URL is available in `apps/dashboard/src/dashboard/MissionLog.tsx`
- [X] T032 [US2] Compose agent/mission sections in `apps/dashboard/src/dashboard/DashboardPage.tsx`
- [X] T033 [US2] Map reference visual-state classes/tokens in `apps/dashboard/src/app/styles.css`
- [X] T034 [US2] Implement exact dashboard shell grid (`280px 1fr 200px 180px`) and agent-card internal grid (`84px 1fr auto`) in `apps/dashboard/src/app/styles.css`
- [X] T035 [US2] Implement explicit agent-state color semantics (`active`, `queued`, `idle`, `error`) in `apps/dashboard/src/app/styles.css` and `apps/dashboard/src/dashboard/AgentFloor.tsx`
- [X] T036 [US2] Implement explicit pipeline node/tool visuals (pulsing ring, spinner ~0.8s, done/pending dots) in `apps/dashboard/src/app/styles.css` and `apps/dashboard/src/dashboard/MissionPipeline.tsx`

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Operational Health and Spend Oversight (Priority: P1)

**Goal**: Provide health, queue, KB, and spend panels from the status snapshot with deterministic formatting.

**Independent Test**: Feed healthy/degraded snapshots and verify panel values/states match payload for health indicators, queue pressure, KB metrics, and provider spend.

### Tests for User Story 3

- [X] T037 [P] [US3] Add health-panel rendering tests in `apps/dashboard/src/__tests__/health-panel.test.tsx`
- [X] T038 [P] [US3] Add spend-panel formatting tests in `apps/dashboard/src/__tests__/spend-panel.test.tsx`
- [X] T039 [P] [US3] Add queue/KB metrics rendering tests in `apps/dashboard/src/__tests__/ops-panels.test.tsx`

### Implementation for User Story 3

- [X] T040 [US3] Implement `HealthPanel` component in `apps/dashboard/src/dashboard/HealthPanel.tsx`
- [X] T041 [US3] Implement health-panel 10-slot baseline rendering (postgres, redis, 6 MCP, LM Studio, telegram-bot) in `apps/dashboard/src/dashboard/HealthPanel.tsx`
- [X] T042 [US3] Implement `SpendPanel` component with provider breakdown and budget progress in `apps/dashboard/src/dashboard/SpendPanel.tsx`
- [X] T043 [US3] Implement spend provider baseline rows (Anthropic, OpenAI, Azure, LM Studio) in `apps/dashboard/src/dashboard/SpendPanel.tsx`
- [X] T044 [US3] Implement queue + KB summary panel block in `apps/dashboard/src/dashboard/DashboardPage.tsx`
- [X] T045 [US3] Add display helpers for currency/percent/time formatting in `apps/dashboard/src/dashboard/formatters.ts`

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: User Story 4 - Admin Control Actions (Priority: P2)

**Goal**: Expose deterministic admin action controls for config reload and manual triggers.

**Independent Test**: Trigger each action in mocked success/failure paths and verify explicit operator feedback with no dashboard crash.

### Tests for User Story 4

- [X] T046 [P] [US4] Add admin-actions success/failure tests in `apps/dashboard/src/__tests__/admin-actions.test.tsx`
- [X] T047 [P] [US4] Add action API contract tests in `apps/dashboard/src/__tests__/action-contracts.test.ts`

### Implementation for User Story 4

- [X] T048 [US4] Implement `AdminActions` component in `apps/dashboard/src/dashboard/AdminActions.tsx`
- [X] T049 [US4] Implement action request methods in `apps/dashboard/src/status/status-client.ts`
- [X] T050 [US4] Implement deterministic action feedback/toast state in `apps/dashboard/src/dashboard/useActionFeedback.ts`
- [X] T051 [US4] Integrate `AdminActions` into dashboard layout in `apps/dashboard/src/dashboard/DashboardPage.tsx`

**Checkpoint**: User Story 4 is independently functional and testable.

---

## Phase 7: User Story 5 - Resilient Polling Behavior (Priority: P2)

**Goal**: Preserve last-known status during transient failures with visibility-aware pause/resume.

**Independent Test**: Simulate fetch failures and visibility changes; verify paused polling, resumed polling, stale-state indicator, and data retention behavior.

### Tests for User Story 5

- [X] T052 [P] [US5] Add polling cadence and pause/resume tests in `apps/dashboard/src/__tests__/status-polling.test.tsx`
- [X] T053 [P] [US5] Add degraded-connection and last-known-data tests in `apps/dashboard/src/__tests__/status-resilience.test.tsx`

### Implementation for User Story 5

- [X] T054 [US5] Implement visibility-aware polling lifecycle in `apps/dashboard/src/status/useAdminStatus.ts`
- [X] T055 [US5] Implement stale/degraded state model and indicator mapping in `apps/dashboard/src/status/useAdminStatus.ts` and `apps/dashboard/src/dashboard/DashboardPage.tsx`
- [X] T056 [US5] Implement last-known snapshot retention behavior in `apps/dashboard/src/status/useAdminStatus.ts`

**Checkpoint**: User Story 5 is independently functional and testable.

---

## Phase 8: API Contract Alignment (Cross-Feature Integration)

**Purpose**: Ensure dashboard assumptions remain aligned with admin/status backend contracts.

- [X] T057 Add/extend status contract tests for dashboard-required fields in `apps/api/src/lib/__tests__/admin-status.test.ts`
- [X] T058 Add/extend config reload response tests for deterministic feedback fields in `apps/api/src/lib/__tests__/admin-config.test.ts`
- [X] T059 Add/extend manual trigger contract tests for screener/watchdog actions in `apps/api/src/lib/__tests__/triggers.test.ts`
- [X] T060 Verify admin route protection on dashboard-facing endpoints in `apps/api/src/app.ts` and `apps/api/src/lib/__tests__/auth-role.test.ts`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story hardening, docs, and full validation.

- [X] T061 [P] Add dashboard quickstart run instructions in `docs/SETUP.md` and `specs/010-admin-dashboard/quickstart.md`
- [X] T062 [P] Validate visual-state parity notes against `docs/dashboard-reference.html` in `specs/010-admin-dashboard/quickstart.md`
- [X] T063 [P] Add accessibility baseline checks for focus/keyboard flow in `apps/dashboard/src/__tests__/accessibility.test.tsx`
- [X] T064 [P] Add privacy/logging guardrail tests for auth/session handling in `apps/dashboard/src/__tests__/privacy.test.tsx`
- [X] T065 Run full validation gates (`typecheck`, `lint`, `test`, `check:secrets`) and record evidence in `specs/010-admin-dashboard/quickstart.md`
- [X] T066 Verify no hardcoded values/secrets and no UTF-8 BOM in 010 scope files
- [X] T067 Validate manual-detail parity vs `specs/010-admin-dashboard/manual-spec-original.md` and `specs/010-admin-dashboard/decisions.md`
- [X] T068 Add UI fidelity regression tests for grid/layout/state tokens in `apps/dashboard/src/__tests__/dashboard-fidelity.test.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies, starts immediately.
- **Phase 2 (Foundational)**: Depends on Setup completion and blocks all user stories.
- **Phases 3-7 (User Stories)**: Depend on Foundational completion; can proceed in parallel by team.
- **Phase 8 (API Contract Alignment)**: Can run after foundational context and before final polish.
- **Phase 9 (Polish)**: Depends on completion of all targeted story and alignment phases.

### User Story Dependencies

- **US1**: Starts after Phase 2; required for protected dashboard access.
- **US2**: Starts after Phase 2 and can proceed in parallel with US3.
- **US3**: Starts after Phase 2 and can proceed in parallel with US2.
- **US4**: Starts after Phase 2; depends on auth/session baseline from US1 for protected actions.
- **US5**: Starts after Phase 2; integrates with status polling from US2/US3 but can be implemented independently after hook scaffold exists.

### Within Each User Story

- Tests first (write and fail) before implementation tasks.
- Data/client logic before UI composition.
- Component implementation before integration wiring in `DashboardPage`.
- Story checkpoint validation before moving to polish.

### Parallel Opportunities

- Setup tasks T003-T005 can run in parallel.
- Foundational tasks T008-T011 can run in parallel after setup scaffolding.
- Story test tasks marked [P] can run in parallel.
- US2 and US3 can be developed in parallel after foundational phase.

---

## Parallel Example: User Story 2

```bash
# Parallel tests:
Task: "T025 [US2] agent-floor rendering tests in apps/dashboard/src/__tests__/agent-floor.test.tsx"
Task: "T026 [US2] mission-pipeline tests in apps/dashboard/src/__tests__/mission-pipeline.test.tsx"
Task: "T027 [US2] mission-log tests in apps/dashboard/src/__tests__/mission-log.test.tsx"

# Parallel implementation slices:
Task: "T028 [US2] AgentFloor component in apps/dashboard/src/dashboard/AgentFloor.tsx"
Task: "T029 [US2] MissionPipeline component in apps/dashboard/src/dashboard/MissionPipeline.tsx"
Task: "T030 [US2] MissionLog component in apps/dashboard/src/dashboard/MissionLog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate sign-in gate + session continuity independently.
4. Demo secure admin-only dashboard entry.

### Incremental Delivery

1. Setup + Foundational complete.
2. Deliver US1 (access/session).
3. Deliver US2 (agent + mission visibility).
4. Deliver US3 (health + spend + ops metrics).
5. Deliver US4 (admin control actions).
6. Deliver US5 (polling resilience).
7. Run API alignment and polish.

### Parallel Team Strategy

1. Team aligns on Setup + Foundational.
2. After Phase 2:
   - Dev A: US1 + US5
   - Dev B: US2
   - Dev C: US3 + US4
   - Dev D: Phase 8 API contract alignment
3. Merge by story checkpoints, then complete polish gates.

---

## Notes

- [P] tasks indicate file-disjoint, dependency-safe parallelization.
- Story labels enforce traceability to spec user stories.
- Commit per task or coherent story slice with conventional commits.
- Preserved implementation details in `decisions.md` are mandatory unless explicitly revised with rationale.

