# Implementation Plan: Data Layer

**Branch**: `002-data-layer` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-data-layer/spec.md`

## Summary

Establish the platform persistence and runtime infrastructure baseline by implementing the canonical Prisma schema (PostgreSQL + pgvector), Docker Compose topology for all 12 services, Redis and BullMQ queue singletons, and queue naming/key contracts consumed by later features. The approach keeps this feature strictly infrastructure-focused: schema, containers, connectivity, and queue primitives only.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Prisma, `@prisma/client`, `pg`, `ioredis`, `bullmq`, Docker Compose  
**Storage**: PostgreSQL 16 + pgvector, Redis 7  
**Testing**: Vitest unit tests + infra smoke checks (`docker compose config`, queue and connection instantiation tests)  
**Target Platform**: Linux Docker (prod), Windows Podman-through-docker-cli (dev)  
**Project Type**: Monorepo backend infrastructure for multi-service web platform  
**Performance Goals**: Infra startup succeeds consistently; Redis/DB clients initialize under normal local dev conditions; queue registration is idempotent  
**Constraints**: Offline-capable tests by default, strict TypeScript, fail-fast startup behavior, no business logic leakage into infra modules  
**Scale/Scope**: 13 Prisma models, 12 containers, 6 BullMQ queues, root-level compose and schema assets for all subsequent features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. This feature consumes runtime YAML from feature 001 and adds no behavior constants in code.
- **Agent Boundaries**: PASS. No agent behavior implemented in this feature.
- **MCP Server Independence**: PASS. Compose wiring preserves MCP service boundaries; no cross-imports introduced.
- **Cost Observability**: PASS (non-regressive). `AgentRun` schema fields for cost/tokens/provider remain first-class in DB model.
- **Fail-Safe Defaults**: PASS. Startup/connectivity failures surface immediately through connection/queue initialization paths.
- **Test-First Where Practical**: PASS. Plan includes schema, redis, and queue smoke/unit validations.
- **Simplicity Over Cleverness**: PASS. Direct Prisma/Redis/BullMQ integration, no additional abstraction layers.

## Project Structure

### Documentation (this feature)

```text
specs/002-data-layer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── data-layer-interfaces.md
└── tasks.md
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma
└── migrations/

apps/api/
├── src/lib/
│   ├── db.ts
│   ├── redis.ts
│   └── queues.ts
└── src/lib/__tests__/

infra/postgres/init/
└── 00_extensions.sql

docker-compose.yml
docker-compose.dev.yml
```

**Structure Decision**: Use root `prisma/` as the schema source-of-truth (aligned with repository architecture), keep runtime infrastructure singletons in `apps/api/src/lib/`, and define container topology in root compose files.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Canonical schema scope and model set
- pgvector enablement strategy for Dockerized PostgreSQL
- BullMQ queue registration and naming conventions
- Redis key namespace contract
- Compose healthcheck/read-only config mount strategy

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/data-layer-interfaces.md](./contracts/data-layer-interfaces.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (no drift; schedule/config values sourced from YAML)
- **Fail-Safe Defaults**: PASS (DB/Redis/queue startup expected to fail loudly on misconfiguration)
- **Test-First Where Practical**: PASS (quickstart includes test/typecheck gates and infra verification)
- **Simplicity Over Cleverness**: PASS (minimal infra primitives, no speculative abstractions)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.
