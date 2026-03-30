# Tasks: Data Layer

**Input**: Design documents from `/specs/002-data-layer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story?] Description with file path`

- `[P]` = parallelizable (different files, no dependency on incomplete sibling tasks)
- `[US#]` = user story label for story-phase tasks only
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add required tooling/dependencies and prepare repository structure for data-layer implementation.

- [X] T001 Create `prisma/` and `infra/postgres/init/` directories for schema/migrations and extension bootstrap
- [X] T002 Update root `./package.json` with Prisma CLI scripts (`prisma:generate`, `prisma:migrate:dev`, `prisma:studio`) and `prisma` dev dependency
- [X] T003 Update `apps/api/package.json` dependencies for data layer (`@prisma/client`, `ioredis`, `bullmq`, `pg`) and test/lint scripts if needed
- [X] T004 [P] Ensure `./.env.example` (or docs path with env template) includes `DATABASE_URL` and `REDIS_URL` required by DB/Redis singletons

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure definitions required before user-story implementation can proceed.

**⚠️ CRITICAL**: No user story work should start before this phase completes.

- [X] T005 Create pgvector bootstrap SQL in `infra/postgres/init/00_extensions.sql` with `CREATE EXTENSION IF NOT EXISTS vector;`
- [X] T006 Create base `./docker-compose.yml` scaffold with shared network/volume anchors only (no full service matrix yet)
- [X] T007 [P] Add shared compose conventions in `./docker-compose.yml` (`restart: unless-stopped`, env file usage, `config/runtime` read-only mount policy for app services)
- [X] T008 [P] Implement concrete healthcheck definitions for `postgres`, `redis`, and all MCP services in `./docker-compose.yml`

**Checkpoint**: Base infra scaffolding is ready; story implementation can proceed.

---

## Phase 3: User Story 1 - Database Schema & Migrations (Priority: P1) 🎯 MVP

**Goal**: Deliver canonical Prisma schema (13 models), migration capability, and DB singleton connectivity.

**Independent Test**: `docker compose up -d postgres` + `pnpm prisma migrate dev --name init` + successful `db.user.findMany()` execution.

### Tests for User Story 1

- [X] T009 [P] [US1] Add DB validation tests in `apps/api/src/lib/__tests__/db.test.ts` for migration-ready connectivity and `db.user.findMany()` smoke query
- [X] T010 [P] [US1] Add pgvector similarity test in `apps/api/src/lib/__tests__/db.test.ts` proving cosine-similarity query works for `KbEntry.embedding`

### Implementation for User Story 1

- [X] T011 [US1] Implement full canonical 13-model schema in `prisma/schema.prisma` (User, RefreshToken, PortfolioItem, WatchlistItem, PriceSnapshot, Mission, AgentRun, KbEntry, KbThesisSnapshot, ScreenerRun, Alert, DailyBrief, TradeTicket)
- [X] T012 [US1] Add pgvector datasource extension and `KbEntry.embedding Unsupported("vector(1536)")` in `prisma/schema.prisma`
- [X] T013 [US1] Define mission traceability relations for mission-related models in `prisma/schema.prisma`
- [X] T014 [US1] Define required indexes and unique constraints from data-model decisions in `prisma/schema.prisma`
- [X] T015 [US1] Create DB singleton in `apps/api/src/lib/db.ts` exporting a single `PrismaClient` instance
- [X] T016 [US1] Add Prisma generate/migrate usage notes and migration execution verification steps to `specs/002-data-layer/quickstart.md` aligned with actual scripts

**Checkpoint**: US1 should be fully functional and independently testable.

---

## Phase 4: User Story 2 - Docker Compose Topology (Priority: P1)

**Goal**: Deliver production compose topology with all 12 services, health checks, and immutable runtime config mount behavior.

**Independent Test**: `docker compose config` validates and lists all 12 services; `docker compose up -d postgres redis` reaches healthy state.

### Tests for User Story 2

- [X] T017 [P] [US2] Add compose topology verification checklist to `specs/002-data-layer/quickstart.md` (service names, health checks, config mounts)

### Implementation for User Story 2

- [X] T018 [US2] Complete `./docker-compose.yml` with all 12 services (`hono-api`, `agent-worker`, 6 MCP servers, `frontend`, `telegram-bot`, `postgres`, `redis`)
- [X] T019 [US2] Wire `infra/postgres/init/00_extensions.sql` into `postgres` service init flow in `./docker-compose.yml`
- [X] T020 [US2] Configure MCP service healthcheck endpoints and dependency ordering in `./docker-compose.yml`
- [X] T021 [US2] Configure read-only `config/runtime` mount for every app container in `./docker-compose.yml`
- [X] T022 [US2] Ensure all app containers use `.env` injection and `restart: unless-stopped` in `./docker-compose.yml`

**Checkpoint**: US2 should be fully functional and independently testable.

---

## Phase 5: User Story 3 - Redis & BullMQ Queues (Priority: P1)

**Goal**: Deliver Redis singleton, key namespace helpers, and six queue definitions with repeatable/push semantics.

**Independent Test**: Redis ping succeeds; queues instantiate without error; key helper outputs match contract strings.

### Tests for User Story 3

- [X] T023 [P] [US3] Add Redis tests in `apps/api/src/lib/__tests__/redis.test.ts` for `redis.ping() === "PONG"`, `agentState`, and `mcpCache` contracts
- [X] T024 [P] [US3] Add queue registry tests in `apps/api/src/lib/__tests__/queues.test.ts` validating six queue names and registration mode expectations

### Implementation for User Story 3

- [X] T025 [US3] Implement Redis singleton and key helpers in `apps/api/src/lib/redis.ts`
- [X] T026 [US3] Type `RedisKey.agentState` to `AgentName` from `@finsight/shared-types` in `apps/api/src/lib/redis.ts`
- [X] T027 [US3] Implement queue registry in `apps/api/src/lib/queues.ts` exporting `watchdogScanQueue`, `screenerScanQueue`, `dailyBriefQueue`, `earningsCheckQueue`, `ticketExpiryQueue`, `alertPipelineQueue`
- [X] T028 [US3] Apply repeatable-vs-standard queue semantics in `apps/api/src/lib/queues.ts` aligned to scheduler-config contract
- [X] T029 [US3] Document Redis/BullMQ smoke commands and expected results in `specs/002-data-layer/quickstart.md`

**Checkpoint**: US3 should be fully functional and independently testable.

---

## Phase 6: User Story 4 - Docker Dev Overrides (Priority: P2)

**Goal**: Deliver development compose overrides for debugging ports and source mounts without changing production topology.

**Independent Test**: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` exposes dev ports and mounts expected source paths.

### Tests for User Story 4

- [X] T030 [P] [US4] Add dev-override validation steps to `specs/002-data-layer/quickstart.md` (port exposure and mount checks)

### Implementation for User Story 4

- [X] T031 [US4] Create `./docker-compose.dev.yml` with postgres port `5432` and redis port `6379` host exposure
- [X] T032 [US4] Add API source mount configuration in `./docker-compose.dev.yml` for development hot-reload workflow
- [X] T033 [US4] Add optional dev mounts/ports for relevant app services in `./docker-compose.dev.yml` without weakening prod defaults

**Checkpoint**: US4 should be fully functional and independently testable.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup across all stories.

- [X] T034 [P] Run `pnpm -r typecheck` and record results in `specs/002-data-layer/quickstart.md`
- [X] T035 [P] Run `pnpm -r lint` and record lint results in `specs/002-data-layer/quickstart.md`
- [X] T036 Run `pnpm --filter @finsight/api test` and record DB/Redis/queue coverage results in `specs/002-data-layer/quickstart.md`
- [X] T037 Run `docker compose config` and record 12-service topology verification in `specs/002-data-layer/quickstart.md`
- [X] T038 Run `docker compose up -d postgres redis` and record healthy status check in `specs/002-data-layer/quickstart.md`
- [X] T039 [P] Update `specs/002-data-layer/contracts/data-layer-interfaces.md` if implementation decisions changed any contract details
- [X] T040 Mark completed tasks in `specs/002-data-layer/tasks.md` and record final validation notes in `specs/002-data-layer/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks user stories
- **Phase 3-6 (User Stories)**: depend on Phase 2 completion
- **Final Phase**: depends on completion of selected user stories

### User Story Dependencies

- **US1 (P1)**: can start after Foundational; no dependency on other stories
- **US2 (P1)**: can start after Foundational; independent of US1 at feature level
- **US3 (P1)**: can start after Foundational; depends only on base env/dependency setup
- **US4 (P2)**: can start after US2 baseline compose exists

### Within Each User Story

- Write tests first where defined
- Implement core files next
- Run story-specific independent test before moving on

---

## Parallel Opportunities

- Setup: T004 can run in parallel with T001-T003
- Foundational: T007 and T008 parallel after T006 skeleton exists
- US1: T009 and T010 parallel; T011/T012/T013/T014 mostly sequential in same file
- US2: T017 parallel with T018; T020/T021/T022 parallelizable after service declarations exist
- US3: T023 and T024 parallel; T025 and T027 can proceed in parallel then integrate
- US4: T030 parallel with T031/T032/T033
- Final phase: T034/T035 parallel; T039 parallel with validation commands

---

## Parallel Example: User Story 3

```bash
# Run tests in parallel
Task: "T023 [US3] Redis ping + key contract tests in apps/api/src/lib/__tests__/redis.test.ts"
Task: "T024 [US3] Queue registry tests in apps/api/src/lib/__tests__/queues.test.ts"

# Run implementation in parallel
Task: "T025 [US3] Implement Redis singleton in apps/api/src/lib/redis.ts"
Task: "T027 [US3] Implement queue registry in apps/api/src/lib/queues.ts"
```

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1 + Phase 2
2. Implement US1 (schema + db singleton) and validate
3. Implement US2 (compose topology) and validate
4. Implement US3 (redis + queues) and validate
5. Stop for MVP demo/validation before US4

### Incremental Delivery

1. Setup + Foundational
2. US1 -> validate migration/query
3. US2 -> validate compose topology
4. US3 -> validate redis/queues
5. US4 -> add dev convenience overrides
6. Final polish and cross-cutting validation

---

## Notes

- `[P]` tasks are safe for parallel execution when touching different files.
- Story phases are designed to stay independently testable per spec acceptance criteria.
- Keep implementation aligned with canonical 13-model schema and queue/key contracts from planning artifacts.






