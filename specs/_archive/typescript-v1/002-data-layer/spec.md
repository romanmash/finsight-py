# Feature Specification: Data Layer

**Feature**: `002-data-layer`
**Created**: 2026-03-28
**Status**: Draft
**Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)
**Depends on**: `001-foundation-config`

## Overview

Create the Prisma schema with full PostgreSQL + pgvector support, the Docker Compose configuration for all 12 containers, the database singleton, the Redis singleton, and the BullMQ queue definitions. This feature establishes the persistence and container orchestration layer that all services run on.

**Why this feature exists:** Every agent writes to the database (AgentRun records), every scheduled job uses BullMQ queues, every cache operation uses Redis, and every service runs in a Docker container. The data layer must exist before any business logic can be tested against real infrastructure.

---

## User Scenarios & Testing

### User Story 1 — Database Schema & Migrations (Priority: P1)

As a developer, I want a complete Prisma schema with all domain models so that I can persist missions, agent runs, KB entries, trade tickets, and all other domain data with type-safe queries.

**Why P1**: Without the schema, no agent can persist results, no mission can be tracked, and no dashboard data can be served.

**Independent Test**: Run `docker compose up -d postgres`, then `pnpm prisma migrate dev --name init`, then verify all model tables exist with `db.user.findMany()`.

**Acceptance Scenarios**:

1. **Given** PostgreSQL is running, **When** `pnpm prisma migrate dev --name init` is executed, **Then** all 13 models are created without error
2. **Given** the migration is applied, **When** I run `db.user.create({ data: { email: 'test@test.com', passwordHash: 'hash', name: 'Test' } })`, **Then** a user record is created with `role: 'analyst'` (default) and auto-generated `id`
3. **Given** pgvector extension is enabled, **When** I insert at least two `KbEntry` embeddings and execute a cosine-similarity query, **Then** the results are ranked by vector distance as expected

---

### User Story 2 — Docker Compose (Priority: P1)

As a developer, I want a Docker Compose configuration with all 12 services so that I can start the entire platform with a single command.

**Why P1**: The containerized environment is how the system runs in both development and production. Without it, integration testing is impossible.

**Independent Test**: Run `docker compose config` to validate the full stack definition, then run `docker compose up -d postgres redis` to verify core infrastructure starts with healthy dependencies.

**Acceptance Scenarios**:

1. **Given** Docker is running, **When** `docker compose up -d postgres redis` is executed, **Then** both services start cleanly and health checks pass
2. **Given** all services are defined, **When** `docker compose config` is executed, **Then** it validates with 12 services: `hono-api`, `agent-worker`, `market-data-mcp`, `macro-signals-mcp`, `news-mcp`, `rag-retrieval-mcp`, `enterprise-connector-mcp`, `trader-platform-mcp`, `frontend`, `telegram-bot`, `postgres`, `redis`
3. **Given** `config/runtime/` directory exists, **When** containers start, **Then** YAML config files are available inside containers at `/app/config/runtime/` (mounted read-only)
4. **Given** `.env` file exists, **When** containers start, **Then** environment variables from `.env` are injected into all app containers
5. **Given** health checks are configured, **When** I inspect compose service definitions, **Then** postgres uses `pg_isready`, redis uses `redis-cli ping`, and each MCP service checks `GET /health`

---

### User Story 3 — Redis & BullMQ Queues (Priority: P1)

As a developer, I want Redis connection management and pre-defined BullMQ queues so that I can schedule recurring jobs and enqueue work items.

**Why P1**: The Watchdog scan, Screener scan, Daily Brief, and Earnings check all run on BullMQ repeatable schedules. Alert processing uses a standard queue. All agent state is stored in Redis.

**Independent Test**: Start Redis, instantiate all queues, verify they accept jobs without error.

**Acceptance Scenarios**:

1. **Given** Redis is running, **When** `redis.ping()` is called, **Then** it returns `'PONG'`
2. **Given** Redis is configured, **When** all 6 BullMQ queues are instantiated, **Then** no errors occur
3. **Given** `RedisKey.agentState('manager')` is called, **Then** it returns the string `'agent:state:manager'`
4. **Given** `RedisKey.mcpCache('market-data', 'get_quote', 'abc123')` is called, **Then** it returns `'mcp:market-data:get_quote:abc123'`

---

### User Story 4 — Docker Dev Overrides (Priority: P2)

As a developer, I want development-specific Docker Compose overrides so that I can expose ports for debugging and mount source code for hot-reload during development.

**Why P2**: Development convenience — the core system works without dev overrides.

**Independent Test**: Run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` and verify additional ports are exposed.

**Acceptance Scenarios**:

1. **Given** `docker-compose.dev.yml` exists, **When** applied as an override, **Then** PostgreSQL port 5432 is exposed to the host
2. **Given** dev overrides are applied, **When** containers start, **Then** Redis port 6379 is exposed to the host
3. **Given** dev overrides are applied, **When** API container starts, **Then** source code is mounted for hot-reload

---

### Edge Cases

- What happens when PostgreSQL is not ready when the API starts? -> Startup dependency checks retry for a bounded interval and then exit non-zero (fail-fast) if the database remains unavailable
- What happens when Redis is unavailable? → Queue and worker initialization fails fast with clear startup error logs (no silent degraded mode)
- What if pgvector extension fails to install? → Init script in Docker runs `CREATE EXTENSION IF NOT EXISTS vector;` — fail-fast if extension not available
- What if two migrations conflict? -> Migration run halts with explicit error; rollback/backout steps must be documented and executed before retry
- What if `config/runtime` mount is missing or not read-only? -> App containers fail startup validation rather than running with mutable or missing runtime config

---

## Requirements

### Functional Requirements

- **FR-001**: Prisma schema MUST define all 13 models from CASE.md: `User`, `RefreshToken`, `PortfolioItem`, `WatchlistItem`, `PriceSnapshot`, `Mission`, `AgentRun`, `KbEntry`, `KbThesisSnapshot`, `ScreenerRun`, `Alert`, `DailyBrief`, `TradeTicket`
- **FR-002**: `User` model MUST include `telegramHandle String? @unique` for Telegram authentication and `telegramChatId BigInt?` for proactive Telegram push
- **FR-003**: `KbEntry` model MUST include `embedding` field of type `Unsupported("vector(1536)")` for pgvector
- **FR-004**: `KbThesisSnapshot` MUST have `missionId` field with a `Mission` relation for traceability
- **FR-005**: All mission-related records (`AgentRun`, `Alert`, `KbEntry`, `KbThesisSnapshot`, `DailyBrief`, `TradeTicket`) MUST support mission traceability via a relation or foreign key to `Mission`
- **FR-006**: `Mission.trigger` MUST accept values: `telegram`, `watchdog`, `scheduled`, `kb_fast_path`, `manual`
- **FR-007**: Docker Compose MUST define 12 services with health checks on postgres, redis, and all 6 MCP servers
- **FR-008**: Docker Compose MUST mount `config/runtime/` as read-only (`:ro`) into every app service
- **FR-009**: Docker Compose MUST use `restart: unless-stopped` for all app containers (`hono-api`, `agent-worker`, 6 MCP services, `frontend`, `telegram-bot`)
- **FR-010**: PostgreSQL container MUST enable pgvector extension via init script
- **FR-011**: `lib/db.ts` MUST export a singleton `PrismaClient` instance
- **FR-012**: `lib/redis.ts` MUST export a singleton Redis connection and `RedisKey` helper object
- **FR-013**: `lib/queues.ts` MUST define 6 named BullMQ queues: `watchdogScan`, `screenerScan`, `dailyBrief`, `earningsCheck`, `ticketExpiry`, `alertPipeline`
- **FR-014**: First 5 queues are repeatable (cron from `scheduler.yaml`); `alertPipeline` is standard (push-based)
- **FR-015**: Healthcheck definitions MUST be explicit: postgres via `pg_isready`, redis via `redis-cli ping`, MCP services via `GET /health`
- **FR-016**: App containers (`hono-api`, `agent-worker`, 6 MCP services, `frontend`, `telegram-bot`) MUST mount `config/runtime` read-only and use `.env` injection consistently
- **FR-017**: Migration execution documentation MUST include conflict handling and rollback/backout steps before rerun
- **FR-018**: Prisma schema MUST include required fields, unique constraints, and indexes for each model as defined by this feature's data model

### Key Entities

#### Prisma Schema Summary (13 models)

| Model | Purpose | Key Relations |
|---|---|---|
| `User` | Platform users with auth + Telegram | → Missions, Alerts, Tickets, Portfolio, Watchlist |
| `RefreshToken` | JWT refresh token tracking | → User |
| `Mission` | A single pipeline run end-to-end | → User, AgentRuns, Alerts, KbEntries, Tickets |
| `AgentRun` | One agent's execution within a Mission | → Mission (provider, model, tokens, cost, duration) |
| `PriceSnapshot` | Point-in-time price record per ticker | standalone, indexed by ticker + timestamp |
| `Alert` | System-generated alert for review | → User, Mission |
| `WatchlistItem` | User-tracked ticker with type | → User |
| `KbEntry` | Knowledge Base entry with pgvector embedding | → Mission |
| `KbThesisSnapshot` | Historical thesis version per ticker | → Mission |
| `ScreenerRun` | Sector scan results | standalone |
| `TradeTicket` | Trade proposal awaiting approval | → User, Mission |
| `DailyBrief` | Morning briefing content per user | → User, Mission |
| `PortfolioItem` | User's holdings (ticker + quantity) | → User |

#### BullMQ Queue Definitions

| Queue | Type | Schedule Source | Purpose |
|---|---|---|---|
| `watchdogScan` | Repeatable | `scheduler.yaml` cron | Periodic price + news scan |
| `screenerScan` | Repeatable | `scheduler.yaml` cron | Weekday sector scan |
| `dailyBrief` | Repeatable | `scheduler.yaml` cron | Morning briefing generation |
| `earningsCheck` | Repeatable | `scheduler.yaml` cron | Earnings calendar check |
| `ticketExpiry` | Repeatable | `scheduler.yaml` cron (hourly) | Expire stale trade tickets |
| `alertPipeline` | Standard | Push (by Watchdog) | Process alerts through investigation pipeline |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: `docker compose up -d postgres redis` starts cleanly, both health checks pass
- **SC-002**: `pnpm prisma migrate dev --name init` creates schema for all 13 models without error
- **SC-003**: `db.user.findMany()` returns empty array (schema works)
- **SC-004**: `redis.ping()` returns `'PONG'`
- **SC-005**: All 6 BullMQ queues instantiate without error
- **SC-006**: pgvector cosine similarity query works on `KbEntry.embedding`
- **SC-007**: `docker compose config` validates all 12 services

---

## Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Docker Network: finsight                                     │
│                                                              │
│   ┌──────────┐  ┌──────────────┐  ┌────────────────────┐   │
│   │ postgres │  │    redis     │  │     frontend       │   │
│   │  :5432   │  │    :6379     │  │      :4000         │   │
│   └──────────┘  └──────────────┘  └────────────────────┘   │
│                                                              │
│   ┌──────────┐  ┌──────────────┐                            │
│   │ hono-api │  │ agent-worker │  (no exposed port)         │
│   │  :3000   │  │   internal   │                            │
│   └──────────┘  └──────────────┘                            │
│                                                              │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│   │ market-data  │ │macro-signals │ │   news-mcp   │       │
│   │  -mcp :3001  │ │  -mcp :3002  │ │    :3003     │       │
│   └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                              │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│   │rag-retrieval │ │  enterprise  │ │   trader     │       │
│   │  -mcp :3004  │ │-connect :3005│ │-platform:3006│       │
│   └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                              │
│   ┌──────────────┐                                          │
│   │ telegram-bot │ (polling, no port needed)                │
│   └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

## Assumptions

- The data-layer schema for this feature follows the canonical Prisma models defined in docs/CASE.md (13 models), and any additional entities are out of scope for feature 002.
- Docker Compose in this feature provides service definitions and wiring only; application business logic and route behavior are implemented in later features.
- Queue schedules are sourced from config/runtime/scheduler.yaml created in feature 001, with `ticketExpiry` represented as an hourly cron in that file.





