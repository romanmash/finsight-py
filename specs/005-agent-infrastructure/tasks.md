# Tasks: Agent Infrastructure

**Input**: Design documents from `/specs/005-agent-infrastructure/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story?] Description with file path`

- `[P]` = parallelizable (different files, no dependency on incomplete sibling tasks)
- `[US#]` = user story label for story-phase tasks only
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare module layout and baseline fixtures for agent infrastructure implementation.

- [X] T001 Create infrastructure module directories in `apps/api/src/mcp/`, `apps/api/src/providers/`, and `apps/api/src/lib/__tests__/__fixtures__/infrastructure/`
- [X] T002 [P] Add MCP infrastructure file stubs in `apps/api/src/mcp/client.ts`, `apps/api/src/mcp/registry.ts`, and `apps/api/src/mcp/invoke.ts`
- [X] T003 [P] Add provider infrastructure file stubs in `apps/api/src/providers/model-router.ts` and `apps/api/src/providers/lmstudio-health.ts`
- [X] T004 [P] Add test stub files in `apps/api/src/lib/__tests__/mcp-client.test.ts`, `apps/api/src/lib/__tests__/model-router.test.ts`, and `apps/api/src/lib/__tests__/lmstudio-health.test.ts`
- [X] T005 Add deterministic fixture payloads in `apps/api/src/lib/__tests__/__fixtures__/infrastructure/mcp-manifest.json`, `apps/api/src/lib/__tests__/__fixtures__/infrastructure/mcp-invoke-success.json`, `apps/api/src/lib/__tests__/__fixtures__/infrastructure/mcp-invoke-error.json`, and `apps/api/src/lib/__tests__/__fixtures__/infrastructure/provider-policy.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared contracts and runtime primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story work should start before this phase completes.

- [X] T006 Define infrastructure domain types in `apps/api/src/types/agent-infrastructure.ts` (server definition, manifest entry, registry, resolution profile, health snapshot)
- [X] T007 Implement MCP invocation envelope validation helpers in `apps/api/src/mcp/invoke.ts`
- [X] T008 [P] Implement provider override validation helpers in `apps/api/src/providers/model-router.ts`
- [X] T009 [P] Implement local-provider probe result normalization in `apps/api/src/providers/lmstudio-health.ts`
- [X] T010 Implement infrastructure-level logger bindings for MCP tool initialization and invocation outcomes in `apps/api/src/lib/logger.ts`, `apps/api/src/mcp/client.ts`, `apps/api/src/mcp/registry.ts`, and `apps/api/src/mcp/invoke.ts`
- [X] T011 Add fixture-driven foundational unit tests for validation helpers in `apps/api/src/lib/__tests__/mcp-client.test.ts` and `apps/api/src/lib/__tests__/model-router.test.ts`

**Checkpoint**: Foundation ready; story implementation can proceed.

---

## Phase 3: User Story 1 - Unified Tool Availability for Agents (Priority: P1) 🎯 MVP

**Goal**: Initialize and expose deterministic per-server + merged tool registries from MCP manifests.

**Independent Test**: Run MCP client tests to confirm required server validation, merged registry creation, collision rejection, structured invoke failure handling, and startup timeout-budget enforcement.

### Tests for User Story 1

- [X] T012 [P] [US1] Add startup reachability and manifest-load tests in `apps/api/src/lib/__tests__/mcp-client.test.ts`
- [X] T013 [P] [US1] Add merged-registry collision tests in `apps/api/src/lib/__tests__/mcp-client.test.ts`
- [X] T014 [P] [US1] Add structured invocation success/failure envelope tests in `apps/api/src/lib/__tests__/mcp-client.test.ts`
- [X] T050 [P] [US1] Add startup-timeout budget test coverage (<10s failure path) in `apps/api/src/lib/__tests__/mcp-client.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Implement required MCP server readiness checks in `apps/api/src/mcp/client.ts`
- [X] T016 [P] [US1] Implement manifest fetch + parse pipeline in `apps/api/src/mcp/client.ts`
- [X] T017 [US1] Implement per-server registry builder in `apps/api/src/mcp/registry.ts`
- [X] T018 [US1] Implement merged all-tools registry composition with duplicate-name rejection in `apps/api/src/mcp/registry.ts`
- [X] T019 [US1] Implement MCP invoke binding execution path in `apps/api/src/mcp/invoke.ts`
- [X] T020 [US1] Wire structured error/result mapping for invocation failures in `apps/api/src/mcp/invoke.ts`
- [X] T021 [US1] Export initialized registry surface for downstream agents in `apps/api/src/mcp/index.ts`
- [X] T051 [US1] Implement startup readiness timeout budget enforcement using runtime config in `apps/api/src/mcp/client.ts`

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Deterministic Model Routing with Fallback (Priority: P1)

**Goal**: Resolve provider/model settings deterministically from runtime policy with bounded overrides and clear fallback behavior.

**Independent Test**: Run model router tests for primary selection, fallback selection, missing fallback errors, and override validation.

### Tests for User Story 2

- [X] T022 [P] [US2] Add primary-provider selection tests in `apps/api/src/lib/__tests__/model-router.test.ts`
- [X] T023 [P] [US2] Add fallback-selection tests for unavailable primary in `apps/api/src/lib/__tests__/model-router.test.ts`
- [X] T024 [P] [US2] Add no-fallback error tests in `apps/api/src/lib/__tests__/model-router.test.ts`
- [X] T025 [P] [US2] Add bounded-override validation tests in `apps/api/src/lib/__tests__/model-router.test.ts`

### Implementation for User Story 2

- [X] T026 [US2] Implement provider policy extraction from runtime config in `apps/api/src/providers/model-router.ts`
- [X] T027 [US2] Implement deterministic primary/fallback resolution logic in `apps/api/src/providers/model-router.ts`
- [X] T028 [US2] Implement bounded override application and validation in `apps/api/src/providers/model-router.ts`
- [X] T029 [US2] Implement explicit resolution error paths for unknown/invalid provider policy in `apps/api/src/providers/model-router.ts`
- [X] T030 [US2] Implement resolution telemetry hooks (provider, model, resolutionPath) in `apps/api/src/providers/model-router.ts`
- [X] T048 [US2] Implement structured logs for provider-resolution and fallback decisions in `apps/api/src/providers/model-router.ts`

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Local-Provider Health Awareness (Priority: P2)

**Goal**: Probe local provider availability on startup + interval and feed latest state into routing decisions.

**Independent Test**: Run LM Studio health tests validating available/unavailable snapshots, timeout handling, and periodic refresh behavior.

### Tests for User Story 3

- [X] T031 [P] [US3] Add available/unavailable probe result tests in `apps/api/src/lib/__tests__/lmstudio-health.test.ts`
- [X] T032 [P] [US3] Add timeout and malformed-response tests in `apps/api/src/lib/__tests__/lmstudio-health.test.ts`
- [X] T033 [P] [US3] Add periodic refresh scheduler tests in `apps/api/src/lib/__tests__/lmstudio-health.test.ts`
- [X] T034 [P] [US3] Add router integration tests consuming health snapshot in `apps/api/src/lib/__tests__/model-router.test.ts`

### Implementation for User Story 3

- [X] T035 [US3] Implement bounded-timeout probe function for local provider in `apps/api/src/providers/lmstudio-health.ts`
- [X] T036 [US3] Implement health snapshot state holder and accessor in `apps/api/src/providers/lmstudio-health.ts`
- [X] T037 [US3] Implement startup probe + periodic refresh scheduler in `apps/api/src/providers/lmstudio-health.ts`
- [X] T038 [US3] Integrate health snapshot consumption into provider resolution in `apps/api/src/providers/model-router.ts`
- [X] T039 [US3] Wire infrastructure startup initialization into API boot path in `apps/api/src/index.ts`
- [X] T049 [US3] Implement structured logs for local-provider probe outcomes and state transitions in `apps/api/src/providers/lmstudio-health.ts`

**Checkpoint**: US3 is independently functional and testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final alignment, documentation consistency, and quality-gate evidence.

- [X] T040 [P] Reconcile 005 contracts with final planned interfaces in `specs/005-agent-infrastructure/contracts/agent-infrastructure-contracts.md`
- [X] T041 [P] Reconcile data model terminology with implemented module names in `specs/005-agent-infrastructure/data-model.md`
- [X] T042 [P] Update quickstart validation flow with final command set in `specs/005-agent-infrastructure/quickstart.md`
- [X] T043 Run `pnpm --filter @finsight/api typecheck` and record evidence in `specs/005-agent-infrastructure/quickstart.md`
- [X] T044 Run `pnpm --filter @finsight/api lint` and record evidence in `specs/005-agent-infrastructure/quickstart.md`
- [X] T045 Run `pnpm --filter @finsight/api test` and record evidence in `specs/005-agent-infrastructure/quickstart.md`
- [X] T046 Run `pnpm check:secrets` and record evidence in `specs/005-agent-infrastructure/quickstart.md`
- [X] T047 Mark completed tasks in `specs/005-agent-infrastructure/tasks.md` as implementation progresses

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories
- **Phase 3-5 (User Stories)**: depend on Phase 2 completion
- **Final Phase**: depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: starts after Foundational; provides required runtime tool registry base
- **US2 (P1)**: starts after Foundational; can proceed in parallel with US1 once shared types exist, but final integration depends on US1 exports
- **US3 (P2)**: depends on US2 router surface and startup integration points from US1

### Within Each User Story

- Tests first (expected to fail), then implementation
- Build primitive modules before integration wiring
- Complete story checkpoint before moving to lower-priority scope

---

## Parallel Opportunities

- Setup: T002, T003, T004 can run in parallel after T001
- Foundational: T008 and T009 parallel; T011 can begin once T006-T009 primitives exist
- US1: T012/T013/T014/T050 parallel tests; T016 parallel with T017 after T015; T051 follows readiness primitives
- US2: T022-T025 parallel tests; T026-T028 and T048 parallelizable with careful file sequencing
- US3: T031-T034 parallel tests; T035-T037 sequential core, T038/T039/T049 integration after core
- Final: T040/T041/T042 parallel; T043-T046 sequential validation run set

---

## Parallel Example: User Story 2

```bash
# Parallel test tasks
Task: "T022 [US2] Primary-provider selection tests in apps/api/src/lib/__tests__/model-router.test.ts"
Task: "T023 [US2] Fallback-selection tests in apps/api/src/lib/__tests__/model-router.test.ts"
Task: "T024 [US2] No-fallback error tests in apps/api/src/lib/__tests__/model-router.test.ts"
Task: "T025 [US2] Bounded-override validation tests in apps/api/src/lib/__tests__/model-router.test.ts"

# Parallel implementation slices
Task: "T026 [US2] Provider policy extraction in apps/api/src/providers/model-router.ts"
Task: "T030 [US2] Resolution telemetry hooks in apps/api/src/providers/model-router.ts"
```

---

## Implementation Strategy

### MVP First (P1 stories)

1. Complete Phase 1 + Phase 2
2. Implement US1 and validate tool registry/readiness behavior
3. Implement US2 and validate deterministic provider routing/fallback
4. Stop for MVP checkpoint before US3 enhancements

### Incremental Delivery

1. Setup + Foundational
2. US1 -> validate
3. US2 -> validate
4. US3 -> local-provider health enhancements
5. Final polish and quality gates

---

## Notes

- `[P]` tasks are safe for parallel execution only when they do not compete on the same file.
- Keep routing, fallback, and health behavior configuration-driven per feature requirements.
- Preserve strict boundary: agents consume MCP tools via infrastructure modules; no direct external provider/tool bypass in agent logic.
