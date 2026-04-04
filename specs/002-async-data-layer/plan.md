# Implementation Plan: Async Data Layer

**Branch**: `002-async-data-layer` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Build the full async data persistence layer: SQLAlchemy 2.x async ORM models for all 7 domain
entities (Operator, Mission, AgentRun, KnowledgeEntry with pgvector, WatchlistItem, Alert,
RefreshToken), typed repository classes for each entity, an async Redis cache singleton, and
Alembic migration for the initial schema. All tests run against an in-process SQLite database —
no Docker, no network required.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: sqlalchemy[asyncio]>=2.0, alembic, asyncpg, pgvector, redis[hiredis], aiosqlite, fakeredis
**Storage**: PostgreSQL 16 + pgvector (prod) / SQLite in-memory (test)
**Testing**: pytest + pytest-asyncio (asyncio_mode=auto) + aiosqlite + fakeredis (offline)
**Target Platform**: Linux server (Docker) / Windows 11 dev (Podman)
**Project Type**: Python monorepo sub-package (apps/api-service)
**Performance Goals**: Single entity CRUD < 50 ms; pgvector similarity search over 10k entries < 500 ms
**Constraints**: mypy --strict zero errors; ruff zero warnings; all tests offline; no Docker
**Scale/Scope**: 7 entity types, initial migration, offline test suite

## Constitution Check

- [x] Everything-as-Code — no hardcoded DB URLs; connection string from .env via Pydantic Settings
- [x] Agent Boundaries — N/A (data layer has no agent logic)
- [x] MCP Server Independence — N/A (data layer is internal)
- [x] Cost Observability — AgentRun model stores tokens_in, tokens_out, cost_usd, provider, model, duration_ms
- [x] Fail-Safe Defaults — engine creation fails fast with descriptive error on bad DB URL
- [x] Test-First — repositories tested against in-memory SQLite
- [x] Simplicity Over Cleverness — repository pattern (not Unit of Work); one class per entity

## Project Structure

### Documentation (this feature)

```text
specs/002-async-data-layer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md  (created by /speckit.tasks)
```

### Source Code

```text
packages/shared/src/finsight/shared/models/
├── __init__.py
├── operator.py          # Operator Pydantic domain model
├── mission.py           # Mission + MissionStatus domain model
├── agent_run.py         # AgentRun domain model
├── knowledge_entry.py   # KnowledgeEntry domain model
├── watchlist_item.py    # WatchlistItem domain model
├── alert.py             # Alert + AlertSeverity domain model
└── refresh_token.py     # RefreshToken domain model

apps/api-service/src/api/db/
├── __init__.py
├── base.py              # DeclarativeBase, metadata
├── models/
│   ├── operator.py
│   ├── mission.py
│   ├── agent_run.py
│   ├── knowledge_entry.py   # includes Vector(1536) column
│   ├── watchlist_item.py
│   ├── alert.py
│   └── refresh_token.py
└── repositories/
    ├── base.py          # BaseRepository[T] generic
    ├── operator.py
    ├── mission.py
    ├── agent_run.py
    ├── knowledge_entry.py   # includes search_similar()
    ├── watchlist_item.py
    ├── alert.py
    └── refresh_token.py

apps/api-service/src/api/lib/
├── db.py                # async engine + get_session() FastAPI dependency
└── redis.py             # Redis client singleton

apps/api-service/alembic/
├── env.py               # async-compatible
└── versions/
    └── 001_initial_schema.py

apps/api-service/tests/db/
├── conftest.py          # SQLite async engine + session fixtures
├── test_operator.py
├── test_mission.py
├── test_agent_run.py
├── test_knowledge_entry.py
├── test_watchlist_item.py
├── test_alert.py
└── test_refresh_token.py
```

## Implementation Phases

### Phase 1: Shared Domain Models (Pydantic)

**Files**: `packages/shared/src/finsight/shared/models/*.py`

**Key decisions**:
- All IDs: `uuid.UUID`, `default_factory=uuid.uuid4`
- `MissionStatus` enum: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`
- `AlertSeverity` enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `KnowledgeEntry.embedding: list[float] | None = None` (1536 dims when present; `None` for seed entries and entries awaiting embedding generation)
- Zero external dependencies in `packages/shared`

### Phase 2: SQLAlchemy ORM Models

**Files**: `apps/api-service/src/api/db/base.py` + `apps/api-service/src/api/db/models/*.py`

**Key decisions**:
- UUID PKs with `server_default=text("gen_random_uuid()")`
- `KnowledgeEntry` uses `pgvector.sqlalchemy.Vector(1536)`
- Soft-delete via `deleted_at: Mapped[datetime | None]` on Mission, KnowledgeEntry, Alert (NULL = active; timestamp = deleted). Repositories filter `WHERE deleted_at IS NULL` by default.
- `AgentRun` FK to `missions.id` ON DELETE CASCADE

### Phase 3: Repository Layer

**Files**: `apps/api-service/src/api/db/repositories/*.py`

**Key decisions**:
- `BaseRepository[T]` provides `get_by_id`, `create`, `update`, `list`, `delete`
- Session injected by caller (not created internally)
- `KnowledgeEntryRepository.search_similar(vector, limit, filters)` uses `<=>` operator
- `AlertRepository.get_unacknowledged()` ordered by `created_at ASC` (oldest first — chronological order per spec; surfaces the most time-sensitive alerts at the top)

### Phase 4: Engine + Redis Singletons

**Files**: `apps/api-service/src/api/lib/db.py`, `apps/api-service/src/api/lib/redis.py`

### Phase 5: Alembic Migration

**Files**: `apps/api-service/alembic/env.py`, `apps/api-service/alembic/versions/001_initial_schema.py`

**Key decisions**:
- `env.py` uses `run_sync` with async engine
- Migration includes `CREATE EXTENSION IF NOT EXISTS vector`

### Phase 6: Tests

**Files**: `apps/api-service/tests/db/conftest.py` + `test_*.py`

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test database | SQLite in-memory via aiosqlite | No Docker; full SQLAlchemy async compat |
| Redis in tests | fakeredis.aioredis | No real Redis server needed |
| Session injection | FastAPI Depends(get_session) | Testable; no global state |
| Soft delete | deleted_at timestamp (NULL = active) | Records when deleted; preserves full audit trail |
| Embedding dimension | 1536 | Matches text-embedding-3-small |

## Testing Strategy

- `conftest.py` creates in-memory SQLite engine and runs `Base.metadata.create_all()`
- All tests are `async def` via `asyncio_mode=auto`
- Vector search not tested offline (SQLite has no pgvector); insert/retrieve only
- Redis tests use `fakeredis.aioredis.FakeRedis()`

## Dependencies

- **Requires**: 001-python-foundation-config
- **Required by**: 003 through 011
