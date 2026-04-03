# Tasks: Async Data Layer

**Input**: Design documents from `/specs/002-async-data-layer/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | research.md ✅ | quickstart.md ✅
**Total Tasks**: 44

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to ([US1]–[US5])
- Exact file paths are included in every description

---

## Phase 1: Setup (Package Structure)

**Purpose**: Create all `__init__.py` files and directory structure so imports work before any
model code is written. No business logic here — pure scaffolding.

- [ ] T001 Create `apps/api/src/api/db/__init__.py`, `apps/api/src/api/db/models/__init__.py`, and `apps/api/src/api/db/repositories/__init__.py` (all empty) to make the db package importable
- [ ] T002 [P] Create `packages/shared/src/finsight/shared/models/__init__.py` exporting all domain model classes (will be populated as models are written) in `packages/shared/src/finsight/shared/models/__init__.py`
- [ ] T003 [P] Create `apps/api/tests/db/__init__.py` (empty) in `apps/api/tests/db/__init__.py`
- [ ] T004 [P] Add `sqlalchemy[asyncio]>=2.0`, `alembic`, `asyncpg`, `pgvector`, `redis[hiredis]`, `aiosqlite`, `fakeredis` to `apps/api/pyproject.toml` dependencies in `apps/api/pyproject.toml`

**Checkpoint**: `uv sync` completes without errors; all package directories importable.

---

## Phase 2: Foundational (ORM Base + DB/Redis Singletons)

**Purpose**: `DeclarativeBase`, engine singleton, session factory, and Redis client must exist before
any ORM model or repository can be written. These are shared by all user stories.

**⚠️ CRITICAL**: No ORM model or repository work can begin until this phase is complete.

- [ ] T005 Create `apps/api/src/api/db/base.py` with `DeclarativeBase` subclass (`Base`), shared `metadata` object, and `TimestampMixin` (provides `created_at: Mapped[datetime]` with `server_default=func.now()` and `updated_at: Mapped[datetime]` with `onupdate=func.now()`) in `apps/api/src/api/db/base.py`
- [ ] T006 Create `apps/api/src/api/lib/db.py` with:
  - `create_async_engine()` from `DATABASE_URL` via `get_settings()`
  - `async_sessionmaker` producing `AsyncSession` instances
  - `get_session() -> AsyncGenerator[AsyncSession, None]` FastAPI dependency (yields session, commits/rolls back on exit)
  - Engine created at module level; fails fast with descriptive error on bad URL
  in `apps/api/src/api/lib/db.py`
- [ ] T007 [P] Create `apps/api/src/api/lib/redis.py` with:
  - `get_redis() -> Redis` singleton returning `redis.asyncio.Redis.from_url(settings.redis_url)`
  - `CacheClient` wrapper with `get(key)`, `set(key, value, ttl)`, `delete(key)` methods — all typed with `str` keys and `bytes | str` values
  - Raises `CacheError` (custom exception) with message on connection failure (no silent failure)
  in `apps/api/src/api/lib/redis.py`
- [ ] T008 Create `apps/api/tests/db/conftest.py` with:
  - `async_engine` fixture: creates in-memory SQLite async engine (`sqlite+aiosqlite:///:memory:`)
  - `session` fixture: runs `Base.metadata.create_all(engine)` then yields an `AsyncSession`; drops all tables after test
  - `fake_redis` fixture: returns `fakeredis.aioredis.FakeRedis()` instance
  - All fixtures are `async` and use `asyncio_mode=auto`
  in `apps/api/tests/db/conftest.py`

**Checkpoint**: `async_engine` and `session` fixtures work; `Base.metadata` is importable; `get_session()` type-checks.

---

## Phase 3: User Story 1 — Agent Persists and Retrieves a Mission Record (Priority: P1) 🎯 MVP

**Goal**: Operator, Mission, AgentRun ORM models + repositories. A mission can be created, status
updated, agent runs attached, and the whole graph retrieved by mission ID.

**Independent Test**: `uv run pytest apps/api/tests/db/test_mission.py apps/api/tests/db/test_agent_run.py` — all pass offline.

- [ ] T009 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/operator.py` with `OperatorModel(BaseModel)`: id (UUID), email (str), role (Literal["admin","viewer"]), telegram_handle (str | None), telegram_user_id (int | None), telegram_chat_id (str | None), is_active (bool), created_at (datetime) — no password hash field in `packages/shared/src/finsight/shared/models/operator.py`
- [ ] T010 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/mission.py` with `MissionStatus` enum (PENDING, RUNNING, COMPLETED, FAILED) and `MissionModel(BaseModel)` matching all Mission columns in `packages/shared/src/finsight/shared/models/mission.py`
- [ ] T011 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/agent_run.py` with `AgentRunModel(BaseModel)` including tokens_in, tokens_out, cost_usd (Decimal), provider, model, duration_ms fields in `packages/shared/src/finsight/shared/models/agent_run.py`
- [ ] T012 [P] Create SQLAlchemy ORM model `apps/api/src/api/db/models/operator.py` with `OperatorORM` — all columns from data-model.md including `telegram_user_id: Mapped[int | None]` and `telegram_chat_id: Mapped[str | None]`; relationships to `MissionORM` (back_populates) and `RefreshTokenORM` in `apps/api/src/api/db/models/operator.py`
- [ ] T013 [P] Create SQLAlchemy ORM model `apps/api/src/api/db/models/mission.py` with `MissionORM` — all columns from data-model.md; `deleted_at: Mapped[datetime | None] = mapped_column(default=None)`; relationship to `AgentRunORM` (cascade="all, delete-orphan"); indexes on `status`, `operator_id`, `created_at` in `apps/api/src/api/db/models/mission.py`
- [ ] T014 Create SQLAlchemy ORM model `apps/api/src/api/db/models/agent_run.py` with `AgentRunORM` — all columns from data-model.md; `mission_id` FK with `ondelete="CASCADE"`; `cost_usd: Mapped[Decimal] = mapped_column(Numeric(12,8))`; indexes on `mission_id`, `agent_name`, `started_at` in `apps/api/src/api/db/models/agent_run.py`
- [ ] T015 Create `apps/api/src/api/db/repositories/base.py` with `BaseRepository[ModelT, ORMT]` generic class providing: `get_by_id(id: UUID) -> ModelT | None`, `create(data: dict) -> ModelT`, `update(id: UUID, data: dict) -> ModelT | None`, `list(limit, offset) -> list[ModelT]`, `delete(id: UUID) -> bool` — session injected via `__init__`; all methods `async def` in `apps/api/src/api/db/repositories/base.py`
- [ ] T016 [P] Create `apps/api/src/api/db/repositories/operator.py` with `OperatorRepository(BaseRepository)` adding `get_by_email(email: str) -> OperatorORM | None` and `get_by_telegram_user_id(user_id: int) -> OperatorORM | None` in `apps/api/src/api/db/repositories/operator.py`
- [ ] T017 Create `apps/api/src/api/db/repositories/mission.py` with `MissionRepository(BaseRepository)` adding:
  - `get_with_runs(mission_id: UUID) -> MissionORM | None` — eager-loads `agent_runs`
  - `update_status(mission_id: UUID, status: MissionStatus) -> None`
  - `list_by_status(status: MissionStatus, limit, offset) -> list[MissionORM]`
  - All list queries filter `WHERE deleted_at IS NULL`
  in `apps/api/src/api/db/repositories/mission.py`
- [ ] T018 Create `apps/api/src/api/db/repositories/agent_run.py` with `AgentRunRepository(BaseRepository)` adding `list_by_mission(mission_id: UUID) -> list[AgentRunORM]` ordered by `started_at ASC` in `apps/api/src/api/db/repositories/agent_run.py`
- [ ] T019 Write `apps/api/tests/db/test_operator.py`: create operator, retrieve by ID, retrieve by email, retrieve by telegram_user_id in `apps/api/tests/db/test_operator.py`
- [ ] T020 Write `apps/api/tests/db/test_mission.py`: create mission (PENDING), update status to RUNNING then COMPLETED, retrieve with agent_runs, verify soft delete (deleted_at set, list returns empty) in `apps/api/tests/db/test_mission.py`
- [ ] T021 Write `apps/api/tests/db/test_agent_run.py`: create mission + two agent_runs, list_by_mission returns both ordered by started_at ASC, verify cost_usd precision in `apps/api/tests/db/test_agent_run.py`

**Checkpoint**: `uv run pytest apps/api/tests/db/test_operator.py apps/api/tests/db/test_mission.py apps/api/tests/db/test_agent_run.py` — all pass offline.

---

## Phase 4: User Story 2 — Bookkeeper Stores and Searches Knowledge Entries (Priority: P1)

**Goal**: KnowledgeEntry ORM model + repository with `search_similar()`. Vector insert/retrieve
tested offline (SQLite, no actual cosine search); the method signature and filter logic are verified.

**Independent Test**: `uv run pytest apps/api/tests/db/test_knowledge_entry.py` — all pass offline.

- [ ] T022 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/knowledge_entry.py` with `KnowledgeEntryModel(BaseModel)`: id, content, embedding (`list[float] | None = None`), source_url, source_type, author_agent, confidence (Decimal), tickers (list[str]), tags (list[str]), freshness_date (date | None), conflict_markers (list[str]), mission_id (UUID | None), created_at, deleted_at — note: `conflict_markers` is the domain model field (list of marker strings); maps to DB `conflict_marker: bool` column in `packages/shared/src/finsight/shared/models/knowledge_entry.py`
- [ ] T023 Create SQLAlchemy ORM model `apps/api/src/api/db/models/knowledge_entry.py` with `KnowledgeEntryORM`:
  - `embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)` — use `pgvector.sqlalchemy.Vector`
  - `tickers: Mapped[list[str]] = mapped_column(ARRAY(String))` and same for `tags`
  - `conflict_marker: Mapped[bool] = mapped_column(default=False)`
  - `deleted_at: Mapped[datetime | None] = mapped_column(default=None)`
  - IVFFlat index on embedding (PostgreSQL-only, wrapped in `if not context.is_offline_mode()`)
  - GIN indexes on tickers and tags
  in `apps/api/src/api/db/models/knowledge_entry.py`
- [ ] T024 Create `apps/api/src/api/db/repositories/knowledge_entry.py` with `KnowledgeEntryRepository(BaseRepository)` adding:
  - `search_similar(vector: list[float], limit: int, filters: dict | None) -> list[KnowledgeEntryORM]` — uses `<=>` (cosine) operator; filters by `WHERE embedding IS NOT NULL`; applies optional ticker/tag/source_type filters; skips similarity ordering in SQLite (fallback to `created_at DESC`)
  - `list_by_ticker(ticker: str, limit, offset) -> list[KnowledgeEntryORM]`
  - All queries filter `WHERE deleted_at IS NULL`
  in `apps/api/src/api/db/repositories/knowledge_entry.py`
- [ ] T025 Write `apps/api/tests/db/test_knowledge_entry.py`: create entry with embedding=None, create entry with embedding=[0.1]*1536, retrieve by ID (all fields correct), test list_by_ticker filter, test soft delete, test `search_similar` returns entries with non-null embedding (verify signature; no actual cosine ranking in SQLite) in `apps/api/tests/db/test_knowledge_entry.py`

**Checkpoint**: `uv run pytest apps/api/tests/db/test_knowledge_entry.py` — all pass offline.

---

## Phase 5: User Story 3 — Watchdog Writes and Reads Watchlist Items and Alerts (Priority: P2)

**Goal**: WatchlistItem and Alert ORM models + repositories. `get_unacknowledged()` returns
alerts ordered ASC (chronological, oldest first) with acknowledged alerts excluded.

**Independent Test**: `uv run pytest apps/api/tests/db/test_watchlist_item.py apps/api/tests/db/test_alert.py` — all pass offline.

- [ ] T026 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/watchlist_item.py` with `WatchlistItemModel(BaseModel)` matching all WatchlistItem columns (nullable threshold fields use `Decimal | None`) in `packages/shared/src/finsight/shared/models/watchlist_item.py`
- [ ] T027 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/alert.py` with `AlertSeverity` enum (`INFO`, `WARNING`, `CRITICAL`) and `AlertModel(BaseModel)` matching all Alert columns in `packages/shared/src/finsight/shared/models/alert.py`
- [ ] T028 [P] Create SQLAlchemy ORM model `apps/api/src/api/db/models/watchlist_item.py` with `WatchlistItemORM` — all columns from data-model.md; relationship to `AlertORM` (back_populates); no soft delete on this entity in `apps/api/src/api/db/models/watchlist_item.py`
- [ ] T029 Create SQLAlchemy ORM model `apps/api/src/api/db/models/alert.py` with `AlertORM` — all columns from data-model.md; `watchlist_item_id` FK with `ondelete="RESTRICT"`; `acknowledged_at: Mapped[datetime | None]`; `deleted_at: Mapped[datetime | None]`; indexes on `acknowledged_at`, `created_at`, `watchlist_item_id` in `apps/api/src/api/db/models/alert.py`
- [ ] T030 [P] Create `apps/api/src/api/db/repositories/watchlist_item.py` with `WatchlistItemRepository(BaseRepository)` adding `list_active() -> list[WatchlistItemORM]` (filters `is_active=True`) in `apps/api/src/api/db/repositories/watchlist_item.py`
- [ ] T031 Create `apps/api/src/api/db/repositories/alert.py` with `AlertRepository(BaseRepository)` adding:
  - `get_unacknowledged(limit: int = 100) -> list[AlertORM]` — filters `WHERE acknowledged_at IS NULL AND deleted_at IS NULL`, ordered `created_at ASC` (oldest first, chronological)
  - `acknowledge(alert_id: UUID, operator_id: UUID) -> None` — sets `acknowledged_at = now()`, `acknowledged_by = operator_id`
  in `apps/api/src/api/db/repositories/alert.py`
- [ ] T032 Write `apps/api/tests/db/test_watchlist_item.py`: create two items (one active, one inactive), `list_active()` returns only the active one; update threshold; verify all fields round-trip in `apps/api/tests/db/test_watchlist_item.py`
- [ ] T033 Write `apps/api/tests/db/test_alert.py`: create watchlist_item + three alerts with distinct `created_at` timestamps, `get_unacknowledged()` returns all three in ASC order, `acknowledge()` one alert, subsequent `get_unacknowledged()` returns two, verify soft delete excludes alert in `apps/api/tests/db/test_alert.py`

**Checkpoint**: `uv run pytest apps/api/tests/db/test_watchlist_item.py apps/api/tests/db/test_alert.py` — all pass offline.

---

## Phase 6: User Story 4 — Schema Migrations Apply Cleanly (Priority: P2)

**Goal**: Alembic migration `001_initial_schema.py` creates all tables and extensions in the
correct order; runs idempotently; tested against a real PostgreSQL in CI (manual test for local).

**Independent Test**: `uv run alembic upgrade head` on empty DB → `alembic current` shows head; run again → no error.

- [ ] T034 [P] Create Pydantic domain model `packages/shared/src/finsight/shared/models/refresh_token.py` with `RefreshTokenModel(BaseModel)`: id, operator_id, token_hash, expires_at, revoked_at (datetime | None), created_at in `packages/shared/src/finsight/shared/models/refresh_token.py`
- [ ] T035 [P] Create SQLAlchemy ORM model `apps/api/src/api/db/models/refresh_token.py` with `RefreshTokenORM` — FK to `operators.id` with `ondelete="CASCADE"`; `token_hash: Mapped[str] = mapped_column(String(64), unique=True)`; `revoked_at: Mapped[datetime | None]` in `apps/api/src/api/db/models/refresh_token.py`
- [ ] T036 [P] Create `apps/api/src/api/db/repositories/refresh_token.py` with `RefreshTokenRepository(BaseRepository)` adding `get_by_hash(token_hash: str) -> RefreshTokenORM | None` and `revoke(token_id: UUID) -> None` in `apps/api/src/api/db/repositories/refresh_token.py`
- [ ] T037 [P] Write `apps/api/tests/db/test_refresh_token.py`: create operator + refresh token, get_by_hash returns correct record, revoke sets revoked_at, verify revoked token is not returned as active in `apps/api/tests/db/test_refresh_token.py`
- [ ] T038 Update `apps/api/alembic/env.py` to import all ORM models so `Base.metadata` is fully populated: add `from api.db.models import operator, mission, agent_run, knowledge_entry, watchlist_item, alert, refresh_token` before the migration context setup in `apps/api/alembic/env.py`
- [ ] T039 Create `apps/api/alembic/versions/001_initial_schema.py` Alembic migration implementing all 11 operations from data-model.md in order:
  1. `CREATE EXTENSION IF NOT EXISTS vector`
  2. `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`
  3. Create `operators` table (all columns)
  4. Create `refresh_tokens` table (FK to operators CASCADE)
  5. Create `missions` table (FK to operators SET NULL)
  6. Create `agent_runs` table (FK to missions CASCADE)
  7. Create `knowledge_entries` table (VECTOR(1536) column, FK to missions SET NULL)
  8. Create IVFFlat index on `knowledge_entries.embedding` (skip if extension unavailable)
  9. Create `watchlist_items` table
  10. Create `alerts` table (FK to watchlist_items RESTRICT, FK to operators nullable)
  11. Create all secondary indexes (status, operator_id, created_at, mission_id, agent_name, tickers GIN, tags GIN)
  in `apps/api/alembic/versions/001_initial_schema.py`

**Checkpoint**: `uv run alembic upgrade head` succeeds on empty PostgreSQL; `uv run alembic downgrade base` rolls back cleanly.

---

## Phase 7: User Story 5 — Cache Layer Stores and Expires Temporary Data (Priority: P3)

**Goal**: `CacheClient` in `redis.py` fully tested with `fakeredis`. TTL expiry verified, connection
error raises `CacheError` (not silent failure).

**Independent Test**: `uv run pytest apps/api/tests/db/test_redis_cache.py` — all pass offline.

- [ ] T040 [US5] Write `apps/api/tests/db/test_redis_cache.py` using the `fake_redis` fixture:
  - `test_set_and_get` — write value with TTL, read back within TTL, assert correct value
  - `test_ttl_expiry` — write value with 1s TTL, advance fake time or use `fakeredis` TTL mechanics, read after expiry → None
  - `test_delete` — write value, delete it, read → None
  - `test_cache_miss` — get on non-existent key → None (not exception)
  - `test_connection_error_raises` — `CacheClient` instantiated with invalid URL → `CacheError` raised on first operation
  in `apps/api/tests/db/test_redis_cache.py`

**Checkpoint**: `uv run pytest apps/api/tests/db/test_redis_cache.py` — all 5 tests pass offline.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Update shared models `__init__.py`, quality gates, and ensure all imports work.

- [ ] T041 [P] Update `packages/shared/src/finsight/shared/models/__init__.py` to export all 7 domain model classes: `OperatorModel`, `MissionModel`, `MissionStatus`, `AgentRunModel`, `KnowledgeEntryModel`, `WatchlistItemModel`, `AlertModel`, `AlertSeverity`, `RefreshTokenModel` in `packages/shared/src/finsight/shared/models/__init__.py`
- [ ] T042 [P] Update `packages/shared/src/finsight/shared/__init__.py` to re-export models package symbols for clean import paths in `packages/shared/src/finsight/shared/__init__.py`
- [ ] T043 [P] Update `apps/api/src/api/db/models/__init__.py` to import all ORM classes (so `Base.metadata` is populated when this package is imported) in `apps/api/src/api/db/models/__init__.py`
- [ ] T044 Run full quality gate: `uv run pytest apps/api/tests/db/` (all offline, all pass) + `uv run mypy --strict apps/api/src/api/db/ apps/api/src/api/lib/db.py apps/api/src/api/lib/redis.py packages/shared/src/` (zero errors) + `uv run ruff check` (zero warnings) — fix any remaining issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (package structure); T005→T006→T007 sequential; T008 depends on T005
- **US1 (Phase 3)**: Depends on Phase 2 (Base, session fixture); T009–T011 (Pydantic) and T012–T014 (ORM) can run in parallel after T005; T015 (BaseRepo) must precede T016–T018; T019–T021 (tests) after T016–T018
- **US2 (Phase 4)**: Depends on T015 (BaseRepository) and T005 (Base); T022–T024 can run in parallel
- **US3 (Phase 5)**: Depends on T015 and T005; T026–T030 can run in parallel; T031 after T028–T029
- **US4 (Phase 6)**: T034–T037 parallelisable after T005; T038 needs all ORM models complete; T039 after T038
- **US5 (Phase 7)**: Depends only on T007 (redis.py)
- **Polish (Phase 8)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Foundation of all other repositories — BaseRepository must be here
- **US2 (P1)**: Parallel with US1 (different ORM model); shares BaseRepository
- **US3 (P2)**: Parallel with US1+US2; only needs BaseRepository from US1
- **US4 (P2)**: Depends on all ORM models from US1+US2+US3 existing (migration references them all)
- **US5 (P3)**: Fully independent — only depends on redis.py from Foundational

### Parallel Execution Map

```
Phase 1: T001 → [T002, T003, T004] in parallel
Phase 2: T005 → T006 → T008; T007 parallel with T006
Phase 3: [T009, T010, T011] parallel → [T012, T013] parallel → T014 → T015 → [T016, T017, T018] → [T019, T020, T021]
Phase 4: T022 parallel with T023 (both after T005); T024 after T023; T025 after T024
Phase 5: [T026, T027, T028] parallel → T029 → [T030, T031] → [T032, T033]
Phase 6: [T034, T035, T036, T037] parallel (after all ORM models) → T038 → T039
Phase 7: T040 after T007
Phase 8: [T041, T042, T043] parallel → T044
```

---

## Parallel Example: Phase 3 (Pydantic + ORM Models)

```
# Pydantic domain models — all independent files:
Task T009: packages/shared/src/finsight/shared/models/operator.py
Task T010: packages/shared/src/finsight/shared/models/mission.py
Task T011: packages/shared/src/finsight/shared/models/agent_run.py

# After T005 (Base exists), ORM models:
Task T012: apps/api/src/api/db/models/operator.py
Task T013: apps/api/src/api/db/models/mission.py
Task T014: apps/api/src/api/db/models/agent_run.py (after T013 for FK)
```

---

## Implementation Strategy

### MVP First (User Story 1 + Foundation)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (Base, db.py, redis.py, test conftest)
3. Complete Phase 3: US1 (Operator + Mission + AgentRun ORM, repos, tests)
4. **STOP and VALIDATE**: `uv run pytest apps/api/tests/db/test_mission.py` — all pass
5. Core mission persistence is production-ready

### Incremental Delivery

1. Setup + Foundational → DB infrastructure ready
2. US1 → mission/agent-run persistence tested → Feature 003 can start (needs Operator + RefreshToken)
3. US2 → KnowledgeEntry with vector search → Feature 007 can start (Bookkeeper needs this)
4. US3 → Watchlist + Alert persistence → Feature 006 can start (Watchdog needs this)
5. US4 → Migration complete → clean DB deploy works
6. US5 → Cache tested → Feature 004 MCP caching can rely on this

---

## Notes

- Tests are **required** by spec (FR-008: all data access operations covered, offline)
- SQLite has no pgvector — `search_similar()` falls back to `created_at DESC` ordering in tests; the method signature and filter logic are still verified
- `conflict_markers: list[str]` is the Pydantic domain model field name (Feature 007's Bookkeeper writes these); the DB column is `conflict_marker: bool` — the repository layer handles the mapping
- `get_unacknowledged()` orders ASC (oldest first) per spec User Story 3 — do not change to DESC
- `fakeredis.aioredis.FakeRedis()` does not simulate real TTL expiry tick-by-tick; use `FakeRedis(connected=True)` and call `expire` / check with `ttl()` for expiry tests
- All `async def` test functions — `asyncio_mode=auto` in root conftest handles event loop
- `get_session()` uses `async with` pattern; tests inject session from fixture, not via FastAPI Depends
