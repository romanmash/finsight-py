# Research: Data Layer (002)

## Decision 1: Canonical Prisma model set is 13 models
- **Decision**: Implement exactly 13 models: `User`, `RefreshToken`, `PortfolioItem`, `WatchlistItem`, `PriceSnapshot`, `Mission`, `AgentRun`, `KbEntry`, `KbThesisSnapshot`, `ScreenerRun`, `Alert`, `DailyBrief`, `TradeTicket`.
- **Rationale**: This is the internally consistent schema set across current architecture docs and downstream feature dependencies.
- **Alternatives considered**:
  - 15-model variant including `WatchList` and `SystemEvent`.
  - Rejected because it introduces inconsistency with canonical schema block used by later features.

## Decision 2: Prisma schema location remains root `prisma/`
- **Decision**: Keep schema and migrations under repository root `prisma/`.
- **Rationale**: Matches repository architecture and keeps migrations centralized for all services using the same DB.
- **Alternatives considered**:
  - `apps/api/prisma/` local schema.
  - Rejected because project docs and key file table define root `prisma/` as source-of-truth.

## Decision 3: pgvector extension enabled via Postgres init SQL
- **Decision**: Add init SQL script (`CREATE EXTENSION IF NOT EXISTS vector;`) executed by postgres container startup.
- **Rationale**: Deterministic and environment-agnostic extension provisioning during container bootstrap.
- **Alternatives considered**:
  - Manual extension creation after container startup.
  - Rejected due to non-repeatable setup and onboarding friction.

## Decision 4: Queue definitions in dedicated `lib/queues.ts`
- **Decision**: Define six named BullMQ queues in one module, backed by shared Redis connection.
- **Rationale**: Centralized queue naming avoids drift and makes scheduler/worker integration deterministic.
- **Alternatives considered**:
  - Ad-hoc queue construction per worker.
  - Rejected because it risks naming mismatch and duplicate queue options.

## Decision 5: Redis key namespace contract
- **Decision**: Standardize key helpers (`agent:state:{agent}`, `mcp:{server}:{tool}:{hash}`).
- **Rationale**: Consistent observability and cache key traceability across components.
- **Alternatives considered**:
  - Free-form keys in each module.
  - Rejected due to collision/debug risks.

## Decision 6: Compose service policy
- **Decision**: 12-service compose topology with healthchecks for `postgres`, `redis`, and MCP services; mount `config/runtime` read-only to app services; `restart: unless-stopped` for app containers.
- **Rationale**: Aligns with deployment model and constitution safety constraints.
- **Alternatives considered**:
  - Minimal compose for only API dependencies.
  - Rejected because feature 002 explicitly establishes full runtime topology baseline.
