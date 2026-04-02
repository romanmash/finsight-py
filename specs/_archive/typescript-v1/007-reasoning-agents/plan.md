# Implementation Plan: Reasoning Agents

**Branch**: `007-reasoning-agents` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-reasoning-agents/spec.md`

## Summary

Implement the four reasoning-layer agents (Analyst, Bookkeeper, Reporter, Trader) as strict role-bound modules in the API runtime. The implementation must preserve explicit mode-driven analysis behavior, transactional KB persistence with contradiction handling, reliable user-facing report delivery with provider fallback, and human-approval-only trade ticket generation. The design keeps all behavior-critical values configuration-driven and enforces compatibility with upstream collector contracts (006) and downstream orchestration expectations (008).

## Scope Preservation (From Original Manual Spec)

The following points are mandatory carryover details and must remain explicit in implementation tasks:

- **Analyst behavior**:
  - Three modes are mandatory: `standard`, `devil_advocate`, `comparison`.
  - Portfolio-aware context path is required when user position exists.
  - Output validation failure retries once, then fails explicitly.
  - Analyst synthesis remains tool-free.
- **Bookkeeper behavior**:
  - Always read prior thesis state before writing updates.
  - Snapshot prior thesis on non-initial updates before overwrite.
  - Contradiction assessment produces alerts only for high severity.
  - KB write path is transactional (entry + snapshot + contradiction effects).
  - Embeddings are mandatory for persisted thesis entries.
- **Reporter behavior**:
  - Mission-type labeling is required in delivery output.
  - Formatter provider fallback is required when primary formatter is unavailable.
  - Oversized Telegram messages are split to valid chunk sizes.
  - Daily brief missions persist a brief record in addition to delivery.
- **Trader behavior**:
  - Ticket creation is proposal-only and pending approval.
  - Rationale is exactly three sentences.
  - Every ticket includes explicit human-approval warning text.
  - Sell requests for non-held instruments are rejected.
- **Cross-feature compatibility**:
  - 007 consumes 006 outputs by published contract shape only.
  - 007 does not couple to 006 internals.
  - Any contract-breaking change requires synchronized 006/007/008 updates.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Hono runtime, Prisma Client, BullMQ, Vercel AI SDK, Zod, LangChain embeddings abstraction, Pino, Vitest, msw  
**Storage**: PostgreSQL (knowledge records, snapshots, alerts, briefs, mission updates), pgvector (embeddings), Redis (queue/state integration)  
**Testing**: Vitest unit/integration tests with mocked providers/MCP tools (offline)  
**Target Platform**: Linux Docker production and Windows local development  
**Project Type**: Monorepo backend feature implementation (`apps/api`)  
**Performance Goals**: Reasoning flows produce valid outputs without malformed downstream payloads; comparison flow preserves parallel throughput expectations from orchestration  
**Constraints**: No hardcoded behavior values/secrets, strict agent boundaries, fail-fast invalid output handling, configuration-driven model/provider routing, offline-testable behavior  
**Scale/Scope**: 4 reasoning agents with mission-path integration into existing Manager/worker runtime and KB/alert/ticket/brief persistence

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Temperatures, models, fallback routing, and thresholds remain config-owned.
- **Agent Boundaries**: PASS. Analyst synthesizes only, Bookkeeper writes KB, Reporter formats only, Trader creates tickets only.
- **MCP Server Independence**: PASS. Reasoning consumes MCP tools through existing client abstractions only.
- **Cost Observability**: PASS (non-regressive). Reasoning agent runs remain compatible with required mission cost accounting fields.
- **Fail-Safe Defaults**: PASS. Invalid outputs fail predictably; fallback behavior specified for formatter availability.
- **Test-First Where Practical**: PASS. Offline unit/integration validation planned for each reasoning agent.
- **Simplicity Over Cleverness**: PASS. Explicit module boundaries and direct runtime integration; no orchestration framework additions.

## Project Structure

### Documentation (this feature)

```text
specs/007-reasoning-agents/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── reasoning-agents-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── agents/
│   │   ├── analyst.ts
│   │   ├── analyst.prompt.ts
│   │   ├── analyst.devil-advocate.prompt.ts
│   │   ├── portfolio-context.prompt.ts
│   │   ├── bookkeeper.ts
│   │   ├── bookkeeper.contradiction.prompt.ts
│   │   ├── reporter.ts
│   │   ├── reporter.prompt.ts
│   │   ├── trader.ts
│   │   └── trader.prompt.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── config.ts
│   │   ├── pricing.ts
│   │   └── __tests__/
│   │       ├── analyst.test.ts
│   │       ├── bookkeeper.test.ts
│   │       ├── reporter.test.ts
│   │       └── trader.test.ts
│   ├── workers/
│   │   └── brief-worker.ts
│   └── routes/
│       └── briefs.ts
config/runtime/
└── agents.yaml
```

**Structure Decision**: Keep 007 implementation inside `apps/api/src/agents` with colocated prompts and minimal integration-touch updates in existing runtime modules. This preserves constitution boundaries and avoids introducing new service layers.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Mode-driven analyst synthesis and schema-validation retry strategy
- Transaction-safe KB update/snapshot/contradiction handling
- Embedding abstraction and failure behavior requirements
- Reporter formatter fallback and message chunking policy
- Trader ticket safety and enforcement policy
- 006/008 contract compatibility guardrails for reasoning layer

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/reasoning-agents-contracts.md](./contracts/reasoning-agents-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (all behavior values and provider routing remain configuration-driven)
- **Agent Boundaries**: PASS (reasoning responsibilities remain isolated per agent role)
- **MCP Server Independence**: PASS (contracted tool access only through MCP client boundaries)
- **Cost Observability**: PASS (design is compatible with full agent-run usage accounting)
- **Fail-Safe Defaults**: PASS (retry/fail paths and fallback behavior are explicit)
- **Test-First Where Practical**: PASS (offline unit/integration matrix defined in quickstart)
- **Simplicity Over Cleverness**: PASS (direct modules and existing runtime primitives)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.
