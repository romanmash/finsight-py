# Research: Async Data Layer

**Feature**: `002-async-data-layer` | **Date**: 2026-04-02

## Technology Decisions

### ORM: SQLAlchemy 2.x Async

**Decision**: SQLAlchemy 2.x with `AsyncSession` via `asyncpg` driver. All queries use the 2.x
`select()` / `insert()` style (no legacy 1.x patterns).

**Rationale**: Locked stack. SQLAlchemy 2.x async is the production standard for FastAPI
applications. `asyncpg` is the fastest PostgreSQL async driver for Python.

**Session factory pattern**:
```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(settings.database_url.unicode_string(), echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

### Vector Search: pgvector Python

**Decision**: `pgvector` Python package (`pgvector>=0.3`) for storing and querying
`VECTOR(1536)` columns. Similarity search via `<->` (L2) or `<=>` (cosine) operators.

**Rationale**: pgvector is the only vector search option that works within PostgreSQL — keeping
the stack to a single database. The `pgvector` Python package integrates with SQLAlchemy via
`Vector` column type. Embedding dimension 1536 matches OpenAI `text-embedding-3-small`.

**Column type**:
```python
from pgvector.sqlalchemy import Vector
embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=True)
```

**Similarity query**:
```python
from sqlalchemy import select
from pgvector.sqlalchemy import Vector
stmt = (
    select(KnowledgeEntryORM)
    .order_by(KnowledgeEntryORM.embedding.cosine_distance(vector))
    .limit(limit)
)
```

### Repository Pattern

**Decision**: One `AsyncRepository[T]` generic base class + one concrete repository per entity.

**Rationale**: Keeps raw SQLAlchemy out of service layer code. Makes offline testing trivial —
inject a test repository backed by SQLite in-memory. Consistent interface across all entities.

**Base interface**:
```python
class BaseRepository(Generic[T]):
    async def get(self, id: UUID) -> T | None: ...
    async def create(self, obj: T) -> T: ...
    async def update(self, obj: T) -> T: ...
    async def delete(self, id: UUID) -> None: ...
    async def list(self, **filters: Any) -> list[T]: ...
```

### Testing with In-Memory SQLite

**Decision**: Use `aiosqlite` with SQLAlchemy async engine for offline tests. The same ORM models
work with both PostgreSQL and SQLite because all column types used (`String`, `DateTime`, `UUID`,
`JSON`, `Boolean`, `Integer`) are portable. `Vector` columns are skipped in SQLite tests via a
`TEST_DATABASE_URL=sqlite+aiosqlite:///:memory:` env override.

**Rationale**: No Docker required. Tests run in under 5 seconds. pgvector-specific tests (cosine
similarity) are marked `@pytest.mark.pgvector` and skipped when not running against PostgreSQL.

**Vector handling in SQLite**: The `Vector` column is declared as `String` in test mode. A
`pytest` fixture replaces the `Vector` type with `Text` via SQLAlchemy `TypeDecorator` when
`TEST_DATABASE_URL` is set. This is acceptable because similarity search tests do not need to
run offline — the repository interface contract is what matters.

### Redis Client: redis-py async

**Decision**: `redis[asyncio]>=5.0` with `Redis.from_url()` connection pool.

**Rationale**: Official Redis Python client; async variant uses `asyncio` natively. Connection
pooling is managed by the client. `get_redis()` returns a cached singleton.

### Soft Deletion

**Decision**: `deleted_at: datetime | None` column on Mission, KnowledgeEntry, and Alert.
Repositories filter `WHERE deleted_at IS NULL` by default.

**Rationale**: Preserves audit trail as required by the spec. Hard deletion is only used for
RefreshToken (no audit need).

## Embedding Dimension Choice

**1536** — matches OpenAI `text-embedding-3-small`. This is the baseline embedding model. If
switched to a larger model later (e.g., 3072 dims), a migration is required. The dimension is
declared as a constant `EMBEDDING_DIM = 1536` in `packages/shared/src/finsight/shared/types.py`
so a single-line change + migration handles any future switch.

## Resolved Questions

| Question | Resolution |
|----------|------------|
| Offline test DB | `aiosqlite` in-memory; `Vector` column shimmed to `Text` in test mode |
| Concurrent writes | SQLAlchemy row-level locking via `with_for_update()` on hot paths |
| Orphaned AgentRun on Mission delete | Cascade `DELETE` via SQLAlchemy `cascade="all, delete-orphan"` |
| Cache key collisions | Prefix all keys with entity type: `mission:{id}`, `ke:{id}` |
| pgvector extension creation | Alembic migration runs `CREATE EXTENSION IF NOT EXISTS vector` |
