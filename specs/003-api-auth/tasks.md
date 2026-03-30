# Tasks: API & Auth

**Input**: Design documents from `/specs/003-api-auth/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story?] Description with file path`

- `[P]` = parallelizable (different files, no dependency on incomplete sibling tasks)
- `[US#]` = user story label for story-phase tasks only
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare API package dependencies and baseline file scaffolding required by all stories.

- [X] T001 Update `apps/api/package.json` to include auth/security dependencies (`jose`, `bcryptjs`, and `hono/cookie` helper usage with no additional cookie package)
- [X] T002 Add auth/rate-limit/runtime env variable placeholders to `.env.example` (no secrets, placeholders only)
- [X] T003 [P] Create route and middleware module skeletons in `apps/api/src/routes/` and `apps/api/src/middleware/` per plan structure
- [X] T004 [P] Add API test bootstrap utilities in `apps/api/src/lib/__tests__/test-app.ts`, including offline mock setup for external integrations used by auth/admin/status tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build core API app composition and shared helpers that every user story depends on.

**⚠️ CRITICAL**: No user story work should start before this phase completes.

- [X] T005 Create typed Hono context extensions for authenticated principal/request context in `apps/api/src/types/hono-context.ts`
- [X] T006 Implement API bootstrap and route mounting in `apps/api/src/app.ts`
- [X] T007 Implement server entrypoint in `apps/api/src/index.ts`
- [X] T008 [P] Implement request-id middleware with `x-request-id` propagation in `apps/api/src/middleware/request-id.ts`
- [X] T009 [P] Implement structured request logger middleware in `apps/api/src/middleware/logger.ts`
- [X] T010 Implement deterministic API error response helpers/shared error mapping in `apps/api/src/lib/errors.ts`
- [X] T011 [P] Implement auth token utility module (issue/verify/rotate helpers) in `apps/api/src/lib/auth-tokens.ts`, with access/refresh TTL values read from runtime config (no hardcoded token windows)
- [X] T012 [P] Implement authentication middleware attaching principal context in `apps/api/src/middleware/auth.ts`
- [X] T013 [P] Implement role guard middleware in `apps/api/src/middleware/role-guard.ts`
- [X] T014 [P] Implement Redis-backed rate-limit middleware with fail-open semantics in `apps/api/src/middleware/rate-limit.ts`
- [X] T015 Wire middleware ordering (`request-id -> logger -> rate-limit -> auth/role`) and shared error handling in `apps/api/src/app.ts`

**Checkpoint**: API foundation ready; user stories can proceed with feature routes.

---

## Phase 3: User Story 1 - JWT Authentication Flow (Priority: P1) 🎯 MVP

**Goal**: Deliver secure login/refresh/logout/me lifecycle with access tokens and refresh-session cookies.

**Independent Test**: `POST /auth/login` + `GET /auth/me` + `POST /auth/refresh` + `POST /auth/logout` verifies happy/negative paths and revoked token behavior.

### Tests for User Story 1

- [X] T016 [P] [US1] Add auth route contract/integration tests for login success and credential rejection in `apps/api/src/lib/__tests__/auth-routes-login.test.ts`
- [X] T017 [P] [US1] Add token validation tests (`/auth/me`, `/auth/refresh`, `/auth/logout`) in `apps/api/src/lib/__tests__/auth-routes-session.test.ts`
- [X] T018 [P] [US1] Add token utility tests for runtime-config TTL sourcing and refresh-session revocation/rotation in `apps/api/src/lib/__tests__/auth-tokens.test.ts`

### Implementation for User Story 1

- [X] T019 [US1] Implement `POST /auth/login` in `apps/api/src/routes/auth.ts` with one-way hash password verification and sanitized profile response
- [X] T020 [US1] Implement token issuance and secure refresh-cookie issuance/clearing helpers in `apps/api/src/routes/auth.ts` using runtime-configured token windows
- [X] T021 [US1] Implement `POST /auth/refresh` with Redis failure closed behavior (`503`) in `apps/api/src/routes/auth.ts`
- [X] T022 [US1] Implement `POST /auth/logout` with refresh invalidation in `apps/api/src/routes/auth.ts`
- [X] T023 [US1] Implement `GET /auth/me` using authenticated principal context in `apps/api/src/routes/auth.ts`
- [X] T024 [US1] Mount auth routes in `apps/api/src/app.ts`

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Middleware Security & Traceability (Priority: P1)

**Goal**: Ensure every request is traceable and protected by consistent auth/authorization/rate-limit behavior.

**Independent Test**: Protected route calls validate request-id header/logs, 401/403 semantics, and 429 threshold behavior.

### Tests for User Story 2

- [X] T025 [P] [US2] Add middleware tests for request-id propagation and logger fields in `apps/api/src/lib/__tests__/request-logging.test.ts`
- [X] T026 [P] [US2] Add middleware tests for auth 401 and role-guard 403 responses in `apps/api/src/lib/__tests__/auth-role.test.ts`
- [X] T027 [P] [US2] Add rate-limit threshold + Redis fail-open tests in `apps/api/src/lib/__tests__/rate-limit.test.ts`

### Implementation for User Story 2

- [X] T028 [US2] Apply auth middleware to protected route groups in `apps/api/src/app.ts`
- [X] T029 [US2] Apply role guard to admin-only route groups in `apps/api/src/app.ts`
- [X] T030 [US2] Ensure deterministic structured error bodies for 401/403/429 in `apps/api/src/lib/errors.ts` and middleware modules
- [X] T031 [US2] Ensure request logger includes `requestId`, `method`, `path`, `statusCode`, `durationMs` in `apps/api/src/middleware/logger.ts`

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Admin User Management (Priority: P1)

**Goal**: Provide admin-only user creation, listing, and update endpoints with safe output projection.

**Independent Test**: Admin creates/lists/deactivates user; non-admin receives `403`.

### Tests for User Story 3

- [X] T032 [P] [US3] Add admin user-management route tests (`POST/GET/PATCH /admin/users`) in `apps/api/src/lib/__tests__/admin-users.test.ts`
- [X] T033 [P] [US3] Add duplicate identity conflict and response-sanitization tests (no password hash leakage) in `apps/api/src/lib/__tests__/admin-users.test.ts`

### Implementation for User Story 3

- [X] T034 [US3] Implement `POST /admin/users` in `apps/api/src/routes/admin.ts` with role assignment, duplicate checks, and one-way password hashing before persistence
- [X] T035 [US3] Implement `GET /admin/users` sanitized projection in `apps/api/src/routes/admin.ts`
- [X] T036 [US3] Implement `PATCH /admin/users/:id` active/role updates in `apps/api/src/routes/admin.ts`
- [X] T037 [US3] Mount user-management admin routes with role guard in `apps/api/src/app.ts`

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: User Story 4 - Mission Control Status Endpoint (Priority: P1)

**Goal**: Deliver consolidated polling endpoint with bounded latency, all 9 agent slots, and degraded-mode behavior.

**Independent Test**: `GET /api/admin/status` returns stable schema under healthy and degraded dependency conditions within 5s budget.

### Tests for User Story 4

- [X] T038 [P] [US4] Add status endpoint schema tests (all sections + 9 agent slots) in `apps/api/src/lib/__tests__/admin-status.test.ts`
- [X] T039 [P] [US4] Add status degraded-mode tests for dependency failures and partial payload markers in `apps/api/src/lib/__tests__/admin-status.test.ts`
- [X] T040 [P] [US4] Add timeout-budget tests ensuring bounded completion under slow dependencies in `apps/api/src/lib/__tests__/status-aggregation.test.ts`

### Implementation for User Story 4

- [X] T041 [US4] Implement status aggregation service (Redis + Prisma fan-out with timeout budget) in `apps/api/src/lib/status-aggregation.ts`
- [X] T042 [US4] Implement `GET /api/admin/status` route in `apps/api/src/routes/admin.ts`
- [X] T043 [US4] Add short TTL caching for spend aggregation in `apps/api/src/lib/status-aggregation.ts`
- [X] T044 [US4] Ensure health summary covers postgres, redis, all MCP services, LM Studio, Telegram in `apps/api/src/lib/status-aggregation.ts`

**Checkpoint**: US4 is independently functional and testable.

---

## Phase 7: User Story 5 - Admin Config Visibility & Reload (Priority: P2)

**Goal**: Provide admin config introspection/reload and manual trigger endpoints for watchdog/screener queues.

**Independent Test**: Admin fetches merged config, reloads config, and triggers watchdog/screener jobs receiving immediate `202`.

### Tests for User Story 5

- [X] T045 [P] [US5] Add config routes tests (`GET /admin/config`, `POST /admin/config/reload`) in `apps/api/src/lib/__tests__/admin-config.test.ts`
- [X] T046 [P] [US5] Add manual trigger route tests for `POST /api/watchdog/trigger` and `POST /api/screener/trigger` in `apps/api/src/lib/__tests__/triggers.test.ts`

### Implementation for User Story 5

- [X] T047 [US5] Implement `GET /admin/config` and `POST /admin/config/reload` in `apps/api/src/routes/admin.ts`
- [X] T048 [US5] Implement `POST /api/watchdog/trigger` in `apps/api/src/routes/watchdog.ts`
- [X] T049 [US5] Implement `POST /api/screener/trigger` in `apps/api/src/routes/screener.ts`
- [X] T050 [US5] Mount trigger routes with admin protection in `apps/api/src/app.ts`

**Checkpoint**: US5 is independently functional and testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Verify full feature behavior, documentation alignment, and quality gates.

- [X] T051 [P] Update `specs/003-api-auth/quickstart.md` with final command paths and verification notes matching implemented files
- [X] T052 [P] Run `pnpm -r typecheck` and capture results in `specs/003-api-auth/quickstart.md`
- [X] T053 [P] Run `pnpm -r lint` and capture results in `specs/003-api-auth/quickstart.md`
- [X] T054 Run `pnpm -r test` and capture auth/admin/status validation evidence in `specs/003-api-auth/quickstart.md`
- [X] T055 [P] Review `specs/003-api-auth/contracts/api-auth-routes.md` and reconcile any implementation-driven contract adjustments
- [X] T056 Mark completed tasks in `specs/003-api-auth/tasks.md` as implementation progresses
- [X] T057 [P] Verify tests run fully offline with mocks enabled (no network calls) and record evidence in `specs/003-api-auth/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories
- **Phase 3-7 (User Stories)**: depend on Phase 2 completion
- **Final Phase**: depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: starts after Foundational; independent authentication baseline
- **US2 (P1)**: starts after Foundational; validates/wires middleware guarantees used by all routes
- **US3 (P1)**: starts after Foundational and benefits from US2 middleware protections
- **US4 (P1)**: starts after Foundational; uses shared auth/admin protections from US2
- **US5 (P2)**: starts after Foundational; depends on admin route baseline from US3/US4 wiring but remains independently testable

### Within Each User Story

- Write tests first where defined
- Implement route/service files next
- Validate story-independent test criteria before moving on

---

## Parallel Opportunities

- Setup: T003 and T004 parallel after dependency decision in T001
- Foundational: T008/T009/T011/T012/T013/T014 parallel with integration in T015
- US1: T016/T017/T018 parallel; route handlers T019-T023 mostly sequential in same file
- US2: T025/T026/T027 parallel; T028-T031 integrate behavior
- US3: T032/T033 parallel; T034-T036 in same route module
- US4: T038/T039/T040 parallel; T041-T044 integrate aggregation/status behavior
- US5: T045/T046 parallel; T048/T049 parallel after T047 base admin config work
- Final: T051/T052/T053/T055/T057 parallel; T054 after implementation complete

---

## Parallel Example: User Story 4

```bash
# Parallel test authoring
Task: "T038 [US4] Add status schema tests in apps/api/src/lib/__tests__/admin-status.test.ts"
Task: "T039 [US4] Add degraded-mode tests in apps/api/src/lib/__tests__/admin-status.test.ts"
Task: "T040 [US4] Add timeout-budget tests in apps/api/src/lib/__tests__/status-aggregation.test.ts"

# Parallel implementation where safe
Task: "T042 [US4] Implement GET /api/admin/status route in apps/api/src/routes/admin.ts"
Task: "T044 [US4] Implement dependency health mappers in apps/api/src/lib/status-aggregation.ts"
```

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1 + Phase 2
2. Implement US1 (auth lifecycle) and validate independently
3. Implement US2 (middleware guarantees) and validate independently
4. Implement US3 (admin users) and validate independently
5. Implement US4 (mission-control status) and validate independently
6. Stop for MVP checkpoint before US5

### Incremental Delivery

1. Setup + Foundational
2. US1 -> validate
3. US2 -> validate
4. US3 -> validate
5. US4 -> validate
6. US5 -> validate
7. Final polish and quality gates

---

## Notes

- `[P]` tasks are safe for parallel execution only when they do not touch the same file sections.
- Keep deterministic status/error contracts aligned with `specs/003-api-auth/contracts/api-auth-routes.md`.
- Keep config-driven behavior in runtime YAML and avoid hardcoded operational values.

