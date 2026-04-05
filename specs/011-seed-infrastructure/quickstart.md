# Quickstart: Seed & Infrastructure (011)

## Prerequisites

- All prior features (001-010) complete
- `.env` with `SERVER_HOST`, `SERVER_USER`, `SERVER_PATH`, `SERVER_SSH_KEY`
- SSH key-based auth to server configured

## Deploy to Server

```bash
# Full deploy (rsync + migrate + restart)
bash scripts/deploy.sh

# Expected output:
# [1/4] Syncing files to server...
# [2/4] Running database migrations...
# [3/4] Rebuilding and restarting services...
# [4/4] Health check...
# Deploy complete in Xs. All services healthy.
```

## Seed Database

```bash
# Against local dev DB
uv run python -m api.seeds.seed

# Idempotency test (run twice, same result)
uv run python -m api.seeds.seed
uv run python -m api.seeds.seed
# Should produce no errors and identical DB state
```

## View Logs

```bash
# Stream logs for any service
bash scripts/logs.sh api
bash scripts/logs.sh telegram-bot
bash scripts/logs.sh market-data-mcp

# Available service names:
# api, celery-beat, worker-mission, worker-alert, worker-screener,
# worker-watchdog, worker-brief, telegram-bot, telegram-worker,
# dashboard, db, redis, market-data-mcp, news-macro-mcp, rag-retrieval-mcp
```

## Provision Infrastructure (first time)

```bash
cd infra/pulumi
pulumi up
```

## Testing

```bash
# Seed idempotency test (offline, SQLite)
uv run pytest apps/api-service/tests/seeds/ -v
```
