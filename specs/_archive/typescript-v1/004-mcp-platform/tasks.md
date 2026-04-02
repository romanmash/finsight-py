# Tasks: MCP Platform

**Input**: Design documents from `/specs/004-mcp-platform/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story?] Description with file path`

- `[P]` = parallelizable (different files, no dependency on incomplete sibling tasks)
- `[US#]` = user story label for story-phase tasks only
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize MCP workspace and baseline project scaffolding.

- [X] T001 Create MCP workspace package scaffold in `apps/mcp-servers/package.json` and `apps/mcp-servers/tsconfig.json`
- [X] T002 Register `apps/mcp-servers` in `pnpm-workspace.yaml` and add root scripts in `package.json` for MCP lint/test/typecheck runs
- [X] T003 [P] Add MCP runtime env placeholders to `.env.example` (provider keys, base URLs, optional mock toggles) without secrets
- [X] T004 [P] Create MCP source entry files in `apps/mcp-servers/src/shared/index.ts`, `apps/mcp-servers/src/market-data/server.ts`, `apps/mcp-servers/src/macro-signals/server.ts`, `apps/mcp-servers/src/news/server.ts`, `apps/mcp-servers/src/rag-retrieval/server.ts`, `apps/mcp-servers/src/enterprise-connector/server.ts`, `apps/mcp-servers/src/trader-platform/server.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core MCP plumbing that MUST be complete before user stories.

**⚠️ CRITICAL**: No user story work should start before this phase completes.

- [X] T005 Implement shared MCP types/contracts in `apps/mcp-servers/src/shared/tool-types.ts`
- [X] T006 Implement shared structured MCP error helpers in `apps/mcp-servers/src/shared/errors.ts`
- [X] T007 [P] Implement shared Redis cache helper with config-driven TTL/key policy in `apps/mcp-servers/src/shared/cache.ts`
- [X] T008 Implement reusable MCP factory (`/health`, `/mcp/tools`, `/mcp/invoke`) in `apps/mcp-servers/src/shared/create-mcp-server.ts`
- [X] T009 [P] Implement shared runtime config loader bridge for MCP servers in `apps/mcp-servers/src/shared/runtime-config.ts`
- [X] T010 [P] Add MCP test harness + fixture helpers in `apps/mcp-servers/tests/helpers/test-app.ts` and `apps/mcp-servers/tests/helpers/fixtures.ts`
- [X] T011 Add common MSW server setup for MCP tests in `apps/mcp-servers/tests/setup/msw.ts`

**Checkpoint**: MCP foundation is ready; story implementation can proceed.

---

## Phase 3: User Story 1 - Reusable MCP Server Factory (Priority: P1) 🎯 MVP

**Goal**: Deliver one reusable server factory with strict invocation/validation contract.

**Independent Test**: Instantiate one-tool sample server and verify `/health`, `/mcp/tools`, `/mcp/invoke` success + failure envelopes.

### Tests for User Story 1

- [X] T012 [P] [US1] Add contract tests for factory base routes in `apps/mcp-servers/tests/contract/create-mcp-server.contract.test.ts`
- [X] T013 [P] [US1] Add validation/error tests for unknown tool, invalid input, invalid output, and duplicate tool-name registration in `apps/mcp-servers/tests/contract/create-mcp-server.errors.test.ts`

### Implementation for User Story 1

- [X] T014 [US1] Implement minimal sample server using shared factory in `apps/mcp-servers/src/shared/__fixtures__/sample-server.ts`
- [X] T015 [US1] Ensure deterministic invoke response envelope (`output|error` + `durationMs`) in `apps/mcp-servers/src/shared/create-mcp-server.ts`
- [X] T016 [US1] Ensure tool manifest serialization includes input/output schema metadata in `apps/mcp-servers/src/shared/create-mcp-server.ts`
- [X] T017 [US1] Enforce duplicate tool-name rejection in `apps/mcp-servers/src/shared/create-mcp-server.ts`

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Market Data MCP Coverage (Priority: P1)

**Goal**: Deliver market-data MCP with required tool set, provider fallback, and cache-hit behavior.

**Independent Test**: Invoke each market-data tool with offline mocks; verify schemas, fallback handling, and cache semantics.

### Tests for User Story 2

- [X] T018 [P] [US2] Add market-data manifest/invoke contract tests in `apps/mcp-servers/tests/contract/market-data.contract.test.ts`
- [X] T019 [P] [US2] Add fallback behavior tests (primary fail -> fallback success) in `apps/mcp-servers/tests/integration/market-data-fallback.test.ts`
- [X] T020 [P] [US2] Add cache hit/miss/expiry tests for market-data tools in `apps/mcp-servers/tests/integration/market-data-cache.test.ts`

### Implementation for User Story 2

- [X] T021 [P] [US2] Implement market-data provider clients in `apps/mcp-servers/src/market-data/providers/finnhub-client.ts` and `apps/mcp-servers/src/market-data/providers/fmp-client.ts`
- [X] T022 [P] [US2] Implement market-data tool handlers in `apps/mcp-servers/src/market-data/tools/get-quote.ts`, `apps/mcp-servers/src/market-data/tools/get-ohlcv.ts`, `apps/mcp-servers/src/market-data/tools/get-fundamentals.ts`, `apps/mcp-servers/src/market-data/tools/get-earnings.ts`
- [X] T023 [P] [US2] Implement market-data tool handlers in `apps/mcp-servers/src/market-data/tools/get-multiple-quotes.ts`, `apps/mcp-servers/src/market-data/tools/get-analyst-ratings.ts`, `apps/mcp-servers/src/market-data/tools/get-price-targets.ts`
- [X] T024 [US2] Implement market-data tool registry and server bootstrap in `apps/mcp-servers/src/market-data/server.ts`
- [X] T025 [US2] Wire provider fallback and cache policy from runtime config in `apps/mcp-servers/src/market-data/tool-registry.ts`

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Remaining MCP Server Set (Priority: P1)

**Goal**: Deliver macro-signals, news, rag-retrieval, enterprise-connector, and trader-platform MCP servers.

**Independent Test**: Start each server independently and validate health/tools/invoke contract with mocked dependencies.

### Tests for User Story 3

- [X] T026 [P] [US3] Add macro-signals MCP contract tests in `apps/mcp-servers/tests/contract/macro-signals.contract.test.ts`
- [X] T027 [P] [US3] Add news MCP contract tests in `apps/mcp-servers/tests/contract/news.contract.test.ts`
- [X] T028 [P] [US3] Add rag-retrieval MCP contract tests (search/current/history) in `apps/mcp-servers/tests/contract/rag-retrieval.contract.test.ts`
- [X] T029 [P] [US3] Add enterprise-connector MCP contract tests in `apps/mcp-servers/tests/contract/enterprise-connector.contract.test.ts`
- [X] T030 [P] [US3] Add trader-platform MCP contract tests in `apps/mcp-servers/tests/contract/trader-platform.contract.test.ts`
- [X] T031 [P] [US3] Add trader approval-gating tests for non-mock paths in `apps/mcp-servers/tests/integration/trader-approval-gating.test.ts`

### Implementation for User Story 3

- [X] T032 [P] [US3] Implement macro-signals tools and registry in `apps/mcp-servers/src/macro-signals/tools/index.ts` and `apps/mcp-servers/src/macro-signals/server.ts`
- [X] T033 [P] [US3] Implement news tools and registry in `apps/mcp-servers/src/news/tools/index.ts` and `apps/mcp-servers/src/news/server.ts`
- [X] T034 [P] [US3] Implement rag-retrieval tools and registry in `apps/mcp-servers/src/rag-retrieval/tools/index.ts` and `apps/mcp-servers/src/rag-retrieval/server.ts`
- [X] T035 [P] [US3] Implement enterprise connector repository-backed tools in `apps/mcp-servers/src/enterprise-connector/repository.ts`, `apps/mcp-servers/src/enterprise-connector/tools/index.ts`, and `apps/mcp-servers/src/enterprise-connector/server.ts`
- [X] T036 [US3] Implement trader-platform ticket lifecycle tools and registry in `apps/mcp-servers/src/trader-platform/tools/index.ts` and `apps/mcp-servers/src/trader-platform/server.ts`
- [X] T037 [US3] Enforce non-mock approval context rejection behavior in `apps/mcp-servers/src/trader-platform/approval-guard.ts`

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: User Story 4 - Cache, Resilience, and Degraded Behavior (Priority: P2)

**Goal**: Ensure deterministic degraded behavior under Redis and upstream failure modes.

**Independent Test**: Simulate Redis outages and upstream failures; confirm structured errors and cache bypass semantics.

### Tests for User Story 4

- [X] T038 [P] [US4] Add Redis-unavailable bypass and cache hit/expiry tests for macro-signals/news servers in `apps/mcp-servers/tests/integration/cache-bypass.test.ts`
- [X] T039 [P] [US4] Add upstream timeout/shape-drift error tests with retry-bound assertions in `apps/mcp-servers/tests/integration/upstream-resilience.test.ts`
- [X] T040 [P] [US4] Add deterministic error envelope consistency tests in `apps/mcp-servers/tests/contract/error-envelope.contract.test.ts`
- [X] T041 [P] [US4] Add concurrent invocation determinism tests for identical inputs in `apps/mcp-servers/tests/integration/concurrency-determinism.test.ts`
- [X] T042 [P] [US4] Add degraded-to-normal recovery tests after dependency restoration in `apps/mcp-servers/tests/integration/recovery-behavior.test.ts`

### Implementation for User Story 4

- [X] T043 [US4] Implement shared timeout wrappers and upstream error normalization in `apps/mcp-servers/src/shared/errors.ts`
- [X] T044 [US4] Implement cache-bypass behavior and fallback logging in `apps/mcp-servers/src/shared/cache.ts`
- [X] T045 [US4] Implement minimum invocation logging fields (`requestId`, `server`, `tool`, `status`, `durationMs`, `errorCode`) in `apps/mcp-servers/src/shared/create-mcp-server.ts`
- [X] T046 [US4] Apply resilience wrappers in `apps/mcp-servers/src/market-data/server.ts`, `apps/mcp-servers/src/macro-signals/server.ts`, `apps/mcp-servers/src/news/server.ts`, `apps/mcp-servers/src/rag-retrieval/server.ts`, `apps/mcp-servers/src/enterprise-connector/server.ts`, and `apps/mcp-servers/src/trader-platform/server.ts`

**Checkpoint**: US4 is independently functional and testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and docs/contract alignment across all stories.

- [X] T047 [P] Add MCP scripts `mcp:typecheck`, `mcp:lint`, `mcp:test`, `mcp:dev:market-data`, `mcp:dev:macro-signals`, `mcp:dev:news`, `mcp:dev:rag-retrieval`, `mcp:dev:enterprise-connector`, and `mcp:dev:trader-platform` in `package.json` and `apps/mcp-servers/package.json`
- [X] T048 [P] Ensure `config/runtime/mcp.yaml` includes required cache/provider/retrieval/trader keys and validation alignment with config loader
- [X] T049 [P] Reconcile contracts with implementation-ready surfaces in `specs/004-mcp-platform/contracts/mcp-platform-contracts.md`
- [X] T050 [P] Update smoke/test commands and expected outputs in `specs/004-mcp-platform/quickstart.md`
- [X] T051 Run `pnpm -r typecheck` and record results in `specs/004-mcp-platform/quickstart.md`
- [X] T052 Run `pnpm -r lint` and record results in `specs/004-mcp-platform/quickstart.md`
- [X] T053 Run `pnpm -r test` and record MCP test evidence in `specs/004-mcp-platform/quickstart.md`
- [X] T054 Run `pnpm check:secrets` and record MCP secret-policy results in `specs/004-mcp-platform/quickstart.md`
- [X] T055 Mark completed tasks in `specs/004-mcp-platform/tasks.md` as implementation progresses

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories
- **Phase 3-6 (User Stories)**: depend on Phase 2 completion
- **Final Phase**: depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: starts after Foundational; independent baseline for all MCP contracts
- **US2 (P1)**: starts after Foundational and can proceed in parallel with US3 once shared factory exists
- **US3 (P1)**: starts after Foundational; depends on shared factory and common error/cache utilities
- **US4 (P2)**: starts after US2/US3 baseline server implementations exist

### Within Each User Story

- Write tests first where defined
- Implement tool handlers/server bootstraps next
- Verify independent test criteria before moving forward

---

## Parallel Opportunities

- Setup: T003 and T004 parallel after T001/T002 begin
- Foundational: T007, T009, T010 parallel after base package setup
- US1: T012 and T013 parallel; T014-T017 sequential in shared factory area
- US2: T018/T019/T020 parallel; T021/T022/T023 parallel before T024/T025 integration
- US3: T026-T031 parallel tests; T032-T035 parallel implementations; T036/T037 sequential trader hardening
- US4: T038-T042 parallel tests; T043-T045 parallel then T046 integration
- Final: T047/T048/T049/T050 parallel; T051/T052/T053/T054 sequential validation run set

---

## Parallel Example: User Story 3

```bash
# Parallel contract tests
Task: "T026 [US3] Macro-signals contract tests in apps/mcp-servers/tests/contract/macro-signals.contract.test.ts"
Task: "T027 [US3] News contract tests in apps/mcp-servers/tests/contract/news.contract.test.ts"
Task: "T028 [US3] RAG retrieval contract tests in apps/mcp-servers/tests/contract/rag-retrieval.contract.test.ts"

# Parallel implementation slices
Task: "T032 [US3] Implement macro-signals server in apps/mcp-servers/src/macro-signals/server.ts"
Task: "T033 [US3] Implement news server in apps/mcp-servers/src/news/server.ts"
Task: "T035 [US3] Implement enterprise connector server in apps/mcp-servers/src/enterprise-connector/server.ts"
```

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1 + Phase 2
2. Implement US1 and validate base MCP contract
3. Implement US2 and validate market-data server
4. Implement US3 and validate remaining server set
5. Stop for MVP checkpoint before US4 hardening

### Incremental Delivery

1. Setup + Foundational
2. US1 -> validate
3. US2 -> validate
4. US3 -> validate
5. US4 -> resilience hardening
6. Final polish and quality gates

---

## Notes

- `[P]` tasks are safe for parallel execution only when file scopes do not overlap.
- Keep all behavioral values and provider/timeout/cache policies configuration-driven from runtime YAML.
- Preserve strict MCP boundary: agents consume tools via MCP client, never direct provider calls.


