# Quickstart: Async Data Layer

**Feature**: `002-async-data-layer` | **Date**: 2026-04-02

## Prerequisites

- Feature 001 (Foundation & Config) implemented and `uv sync` completed
- Docker / Podman running with `docker compose up -d db redis`

---

## 1. Apply the Initial Migration

```bash
# Ensure .env has DATABASE_URL pointing to the running db container
uv run alembic upgrade head
# Expected output:
# INFO  [alembic.runtime.migration] Running upgrade -> 001_initial_schema
```

---

## 2. Verify Schema

```bash
# Connect to the DB and inspect tables
docker compose exec db psql -U finsight -d finsight -c "\dt"
# Expected: operator, refresh_token, mission, agent_run, knowledge_entry, watchlist_item, alert
```

---

## 3. Run the Data Layer Tests (Offline)

No Docker needed for tests — they use an in-memory SQLite database.

```bash
uv run pytest apps/api/tests/db/ -v
# Expected: all tests pass
```

Run only repository tests:

```bash
uv run pytest apps/api/tests/db/test_repositories.py -v
```

---

## 4. Quick Integration Smoke Test

With the database running:

```bash
uv run python - <<'EOF'
import asyncio
from apps.api.src.api.lib.db import AsyncSessionLocal
from apps.api.src.api.db.repositories.mission import MissionRepository
from apps.api.src.api.db.models.mission import MissionStatus, MissionType, MissionSource

async def smoke():
    async with AsyncSessionLocal() as session:
        repo = MissionRepository(session)
        mission = await repo.create(
            title="Test mission",
            query="What is AAPL doing?",
            mission_type=MissionType.RESEARCH,
            status=MissionStatus.PENDING,
            source=MissionSource.OPERATOR,
        )
        print(f"Created: {mission.id}")
        fetched = await repo.get(mission.id)
        assert fetched is not None
        print(f"Retrieved: {fetched.title}")
        await session.commit()

asyncio.run(smoke())
EOF
```

---

## 5. Verify Similarity Search (Requires Running DB + pgvector)

```bash
uv run python - <<'EOF'
import asyncio, random
from apps.api.src.api.lib.db import AsyncSessionLocal
from apps.api.src.api.db.repositories.knowledge import KnowledgeRepository

async def test_search():
    async with AsyncSessionLocal() as session:
        repo = KnowledgeRepository(session)
        # Insert two entries with distinct vectors
        vec_a = [random.random() for _ in range(1536)]
        vec_b = [1.0 - v for v in vec_a]  # roughly opposite
        await repo.create(content="Apple earnings beat", embedding=vec_a, author_agent="bookkeeper", tickers=["AAPL"])
        await repo.create(content="Oil prices rise", embedding=vec_b, author_agent="bookkeeper", tickers=["USO"])
        await session.commit()
        # Search with vec_a — should rank Apple first
        results = await repo.similarity_search(query_vector=vec_a, top_k=2)
        print(f"Top result: {results[0].content}")
        assert "Apple" in results[0].content

asyncio.run(test_search())
EOF
```

---

## 6. Run Migration Idempotency Check

```bash
# Run again on an already-migrated DB — should be a no-op
uv run alembic upgrade head
# Expected: INFO [alembic.runtime.migration] Running upgrade (no operations performed)
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `pgvector not found` error | Extension not installed | Use `pgvector/pgvector:pg16` Docker image |
| `aiosqlite` import error | Dev dep missing | Run `uv add --dev aiosqlite` |
| SQLite tests fail on `Vector` type | Shim not applied | Ensure `conftest.py` applies `VectorShim` when `TEST_DATABASE_URL` is set |
| `alembic upgrade` hangs | DB not ready | Wait for `docker compose ps` to show `db` as healthy |
| Similarity search returns wrong order | IVFFlat index needs lists | Add at least 100 rows before building index, or use exact search for < 100 rows |
