# Implementation Plan: MCP Platform

**Branch**: `004-mcp-platform` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-mcp-platform/spec.md`

## Summary

Implement the MCP platform by introducing a reusable server factory and delivering six independent MCP servers (market-data, macro-signals, news, rag-retrieval, enterprise-connector, trader-platform) with deterministic invocation contracts, schema validation, Redis-backed cache behavior, and offline-testable mocks. This feature establishes the strict agent-to-tool boundary required for all downstream agent features.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Hono, Zod, ioredis, Prisma Client, pgvector-enabled PostgreSQL access, Pino, Vitest, msw  
**Storage**: Redis 7 (cache), PostgreSQL 16 + pgvector (retrieval read paths), external provider APIs (market/macro/news)  
**Testing**: Vitest + msw with fully offline provider mocks and deterministic fixtures  
**Target Platform**: Linux Docker (prod), Windows local dev via Docker/Podman-compatible workflow  
**Project Type**: Monorepo backend microservice set (`apps/mcp-servers`)  
**Performance Goals**: Deterministic MCP invoke latency with cache-hit acceleration; support polling/agent workloads without unbounded retries or hangs  
**Constraints**: Everything-as-Code config, no hardcoded secrets/magic behavior values, strict schema validation, no direct agent imports, offline test capability  
**Scale/Scope**: 1 shared MCP factory + 6 independent MCP services + 20+ tools + shared contract tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Tool TTLs/weights/timeouts/provider routing come from runtime YAML, not hardcoded source constants.
- **Agent Boundaries**: PASS. MCP servers expose tools only; agent reasoning and orchestration remain out of scope.
- **MCP Server Independence**: PASS. Plan keeps six deployable Hono apps with own health/manifest/invoke endpoints.
- **Cost Observability**: PASS (non-regressive). MCP feature does not bypass existing AgentRun cost tracking.
- **Fail-Safe Defaults**: PASS. Schema errors and dependency failures return structured deterministic errors; cache unavailable path bypasses cache.
- **Test-First Where Practical**: PASS. Contract and integration-style tests with offline mocks are first-class deliverables.
- **Simplicity Over Cleverness**: PASS. Direct Hono + explicit tool registry/factory; no orchestration framework coupling.

## Project Structure

### Documentation (this feature)

```text
specs/004-mcp-platform/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mcp-platform-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/mcp-servers/
├── package.json
├── src/
│   ├── shared/
│   │   ├── create-mcp-server.ts
│   │   ├── cache.ts
│   │   ├── errors.ts
│   │   └── tool-types.ts
│   ├── market-data/
│   │   ├── server.ts
│   │   ├── tools/
│   │   └── providers/
│   ├── macro-signals/
│   │   ├── server.ts
│   │   └── tools/
│   ├── news/
│   │   ├── server.ts
│   │   └── tools/
│   ├── rag-retrieval/
│   │   ├── server.ts
│   │   └── tools/
│   ├── enterprise-connector/
│   │   ├── server.ts
│   │   └── tools/
│   └── trader-platform/
│       ├── server.ts
│       └── tools/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

config/runtime/
└── mcp.yaml
```

**Structure Decision**: Use one `apps/mcp-servers` workspace app containing shared MCP factory utilities and six explicit server modules so each server stays independent while avoiding duplicated plumbing.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Shared MCP factory contract and validation behavior
- Provider fallback and timeout policy for data tools
- Hybrid retrieval ranking and read-only boundaries
- Cache key/TTL policy from runtime config
- Trader mock-first behavior with explicit approval gating for non-mock paths
- Offline test strategy with msw fixtures

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/mcp-platform-contracts.md](./contracts/mcp-platform-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (cache TTLs, provider routing, retrieval weights remain config-driven)
- **MCP Server Independence**: PASS (all six services preserve strict endpoint/tool boundaries)
- **Fail-Safe Defaults**: PASS (structured errors, cache-bypass fallback, timeout-bounded calls)
- **Test-First Where Practical**: PASS (quickstart enforces offline contract/integration tests)
- **Simplicity Over Cleverness**: PASS (single shared factory + explicit per-server tool registries)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.
