# Quickstart: Data Layer (002)

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker/Podman with `docker compose` compatibility
- `.env` created from `.env.example`

## 1) Install dependencies and generate Prisma client

```bash
pnpm install
pnpm prisma:generate
```

Expected:
- Workspace dependencies installed
- Prisma client generated from `prisma/schema.prisma`

## 2) Validate compose topology

```bash
docker compose config
```

Expected:
- Valid config
- Exactly 12 services:
  - `hono-api`, `agent-worker`, `market-data-mcp`, `macro-signals-mcp`, `news-mcp`, `rag-retrieval-mcp`, `enterprise-connector-mcp`, `trader-platform-mcp`, `frontend`, `telegram-bot`, `postgres`, `redis`

## 3) Start core infrastructure

```bash
docker compose up -d postgres redis
```

Expected:
- `postgres` healthcheck via `pg_isready` becomes healthy
- `redis` healthcheck via `redis-cli ping` becomes healthy

## 4) Apply initial database migration

```bash
pnpm prisma:migrate:dev --name init
```

Expected:
- Migration succeeds
- 13 models are materialized

## 5) Migration conflict/backout procedure

If migration fails due to conflict:

```bash
pnpm prisma migrate resolve --rolled-back <migration_name>
```

Then repair schema/migration files and rerun:

```bash
pnpm prisma:migrate:dev --name init
```

If local dev DB must be reset:

```bash
pnpm prisma migrate reset
```

Expected:
- Migration state is consistent before rerun
- Backout path is explicit and deterministic

## 6) Validate DB/Redis/queue contracts via tests

```bash
pnpm --filter @finsight/api test
```

Expected:
- `db.test.ts`: singleton + `db.user.findMany()` smoke + pgvector SQL contract
- `redis.test.ts`: `redis.ping()` + Redis key contract
- `queues.test.ts`: six queue names and repeatable-vs-push registration behavior

## 7) Validate typecheck + lint

```bash
pnpm -r typecheck
pnpm -r lint
```

Expected:
- Zero type errors
- Zero lint warnings

## 8) Validate dev override

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

Expected:
- `postgres:5432` and `redis:6379` exposed
- `hono-api` and `agent-worker` have source mounts in dev override

## Validation Log (2026-03-30)

- `pnpm prisma:generate`: PASS
- `pnpm -r typecheck`: PASS
- `pnpm -r lint`: PASS
- `pnpm -r test`: PASS (`packages/shared-types` + `apps/api`)
- `docker compose config`: PASS (12 services resolved)
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`: PASS (dev overrides merged)
- `docker compose up -d postgres redis`: PASS (containers started; postgres/redis started successfully)

