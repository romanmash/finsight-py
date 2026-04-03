# Quickstart: Orchestration (008)

## Prerequisites

- Features 001-007 complete
- Celery worker running: `uv run celery -A api.lib.queues worker --loglevel=info`
- Celery beat running: `uv run celery -A api.lib.queues beat --loglevel=info`
- PostgreSQL + Redis running

## Running

```bash
# Start backing services
docker compose up -d postgres redis

# Start Celery worker (separate terminal)
uv run celery -A api.lib.queues worker --loglevel=info

# Start Celery beat scheduler (separate terminal)
uv run celery -A api.lib.queues beat --loglevel=info

# Start API
uv run uvicorn api.main:app --reload --port 8000

# Trigger a mission via API
curl -X POST http://localhost:8000/missions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Why is Gold moving today?"}'
```

## Testing (offline)

```bash
# Celery tasks run synchronously in tests (task_always_eager=True)
uv run pytest apps/api/tests/orchestration/ -v

# Type check
uv run mypy apps/api/src/api/graphs/ apps/api/src/api/workers/ --strict
```

## Verifying

```bash
# Check mission status
curl http://localhost:8000/missions/{mission_id} \
  -H "Authorization: Bearer $TOKEN"

# View Celery task status
uv run celery -A api.lib.queues inspect active
```
