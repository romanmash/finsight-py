# Implementation Plan: Orchestration

**Branch**: `008-orchestration` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-orchestration/spec.md`

## Summary

Implement the Manager-driven orchestration layer that turns user/system triggers into deterministic mission pipelines, with KB fast-path, parallel comparison dispatch, confidence-gated re-dispatch, complete route coverage for mission-facing surfaces, and worker-driven mission automation. The design preserves strict contract coupling to 006/007, enforces mission/agent-run observability, and keeps all orchestration policy configuration-driven.

## Scope Preservation (From Original Manual Spec)

The following points are mandatory carryover details and must remain explicit in implementation tasks:

- **Manager behavior**:
  - Manager is the single orchestration entry point.
  - Intent routing table across 8 mission types is explicit and auditable.
  - KB fast-path applies only for `operator_query` with fresh high-confidence thesis.
  - Comparison dispatch must be parallel (not serial).
  - Low-confidence re-dispatch is policy-controlled and bounded.
- **Route surface behavior**:
  - Chat creates mission and returns mission-bound response.
  - Mission, KB, portfolio, watchlist, alerts, tickets, briefs routes remain role/auth constrained.
  - Ticket approval/rejection enforces deterministic transition guards.
- **Worker behavior**:
  - Alert pipeline worker runs alert-investigation mission path.
  - Daily brief worker generates missions for active users.
  - Earnings worker evaluates event signals and emits mission triggers.
- **Observability behavior**:
  - Mission and AgentRun accounting fields remain complete (`provider`, `model`, `tokensIn`, `tokensOut`, `costUsd`, `durationMs`, `status`).
  - Mission-level trace-link metadata remains visible for operator debugging.
- **Cross-feature compatibility**:
  - 008 consumes 006/007 outputs by contract only (no internal coupling).
  - Contract-breaking changes require synchronized 006/007/008 updates.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Hono, Prisma Client, BullMQ, Vercel AI SDK, Zod, Pino, LangSmith SDK/hooks, Vitest, msw  
**Storage**: PostgreSQL (Mission/AgentRun/KB/Alert/Ticket/Brief records), Redis (queues, scheduling, rate/worker state)  
**Testing**: Vitest unit/integration tests with mocked MCP/provider dependencies (offline)  
**Target Platform**: Linux Docker production and Windows local development  
**Project Type**: Monorepo backend feature implementation (`apps/api`)  
**Performance Goals**: Comparison dispatch starts concurrent branches within <=1s; fast-path bypass avoids full pipeline for eligible requests  
**Constraints**: No hardcoded policy/secrets, strict manager non-reasoning boundary, fail-fast malformed outputs, role-guarded admin/state-changing routes, offline-testable flows  
**Scale/Scope**: One orchestration manager module + route expansion + worker orchestration integration across existing API runtime

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Fast-path window, confidence re-dispatch, scheduling, and provider routing remain config-driven.
- **Agent Boundaries**: PASS. Manager classifies/routes only; content reasoning stays in 007 agents.
- **MCP Server Independence**: PASS. Orchestration consumes MCP via client/contracts only.
- **Cost Observability**: PASS. Mission pipeline requires complete AgentRun accounting fields.
- **Fail-Safe Defaults**: PASS. Invalid contracts/routes/transition states fail explicitly.
- **Test-First Where Practical**: PASS. Route and orchestration behavior covered by offline tests.
- **Simplicity Over Cleverness**: PASS. Direct orchestration module and explicit routing table, no extra orchestration framework.

## Project Structure

### Documentation (this feature)

```text
specs/008-orchestration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── orchestration-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── agents/
│   │   ├── manager.ts
│   │   └── shared/
│   │       ├── mission-routing.ts
│   │       ├── fast-path.ts
│   │       ├── re-dispatch.ts
│   │       ├── orchestration-compatibility.ts
│   │       └── mission-lifecycle.ts
│   ├── routes/
│   │   ├── chat.ts
│   │   ├── missions.ts
│   │   ├── kb.ts
│   │   ├── portfolio.ts
│   │   ├── watchlist.ts
│   │   ├── alerts.ts
│   │   ├── tickets.ts
│   │   ├── briefs.ts
│   │   └── screener.ts
│   ├── types/
│   │   └── orchestration.ts
│   ├── workers/
│   │   ├── alert-pipeline-worker.ts
│   │   ├── brief-worker.ts
│   │   ├── earnings-worker.ts
│   │   └── init-workers.ts
│   ├── lib/
│   │   ├── status-aggregation.ts
│   │   └── __tests__/
│   │       ├── manager.test.ts
│   │       ├── manager-foundation.test.ts
│   │       ├── chat-route.test.ts
│   │       ├── missions-route.test.ts
│   │       ├── kb-route.test.ts
│   │       ├── briefs-route.test.ts
│   │       ├── alerts-route.test.ts
│   │       ├── tickets-route.test.ts
│   │       ├── portfolio-route.test.ts
│   │       ├── watchlist-route.test.ts
│   │       ├── screener-route.test.ts
│   │       ├── alert-pipeline-worker.test.ts
│   │       ├── brief-worker.test.ts
│   │       ├── earnings-worker.test.ts
│   │       ├── orchestration-compatibility.test.ts
│   │       └── mocks/
│   │           └── orchestration.ts
│   ├── scheduler/
│   │   └── init-scheduler.ts
│   ├── middleware/
│   │   └── langsmith.ts
│   └── app.ts
config/runtime/
├── agents.yaml
└── scheduler.yaml
```

Additional cross-cutting files:
- `config/types/agents.schema.ts`
- `config/types/scheduler.schema.ts`
- `package.json`
- `pnpm-workspace.yaml`
- `specs/008-orchestration/checklists/requirements.md`
- `specs/008-orchestration/quickstart.md`
**Structure Decision**: Keep orchestration logic inside `apps/api/src/agents/manager.ts` and route/worker modules under existing API runtime boundaries. Extend existing route and worker composition instead of introducing a new service layer.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Explicit intent-routing table as a single source of orchestration truth
- Fast-path gating strategy (confidence + freshness + mission-type constraints)
- Parallel comparison branch execution strategy and failure semantics
- Bounded confidence re-dispatch strategy without loops
- Route authorization/transition policy for ticket and alert mutations
- Worker orchestration patterns for alert pipeline, daily brief, and earnings triggers
- 006/007 contract-compatibility enforcement points in manager/routes/workers

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/orchestration-contracts.md](./contracts/orchestration-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (routing/threshold/schedule controls remain config-driven)
- **Agent Boundaries**: PASS (manager classifies/routes; analyst/bookkeeper/reporter/trader preserve responsibilities)
- **MCP Server Independence**: PASS (all external calls flow through existing MCP client contracts)
- **Cost Observability**: PASS (Mission + AgentRun accounting fields enforced in orchestration path)
- **Fail-Safe Defaults**: PASS (explicit mission failures for contract mismatch, transition violations, missing branch outputs)
- **Test-First Where Practical**: PASS (offline route/manager/worker matrix defined in quickstart)
- **Simplicity Over Cleverness**: PASS (explicit table + direct composition in existing runtime)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.

