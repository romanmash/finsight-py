# Implementation Plan: Agent Infrastructure

**Branch**: `005-agent-infrastructure` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-agent-infrastructure/spec.md`

## Summary

Implement the shared agent infrastructure layer in the API app by adding: (1) MCP client initialization and tool-registry composition for agent runtime use, (2) deterministic model-provider resolution with policy-based fallback behavior, and (3) local-provider health probing used by routing decisions. The design enforces fail-fast startup validation with an explicit timeout budget, structured failure handling, and fully offline-testable behavior.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Hono runtime (existing API host), Vercel AI SDK provider abstractions, Zod, Pino, native fetch, Vitest, msw  
**Storage**: Runtime YAML config (`config/runtime/*.yaml`), Redis for runtime state where needed, no new persistent schema in this feature  
**Testing**: Vitest + msw with offline mocks for MCP server responses and provider availability probes  
**Target Platform**: Linux Docker production and Windows local development  
**Project Type**: Monorepo backend service enhancement (`apps/api`)  
**Performance Goals**: Startup readiness failure path remains under 10 seconds (policy/config driven); provider resolution remains low-latency and deterministic at runtime  
**Constraints**: Everything-as-Code, no hardcoded secrets, strict agent-to-MCP boundaries, fail-fast startup for missing required dependencies, offline test execution  
**Scale/Scope**: 1 agent infrastructure module set in `apps/api`, consumed by all downstream agent features (006–008)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Provider selection and routing policy remain configuration-driven.
- **Agent Boundaries**: PASS. Infrastructure supports agents; it does not embed domain reasoning into routing/plumbing.
- **MCP Server Independence**: PASS. Design consumes MCP contracts only and does not bypass MCP boundaries.
- **Cost Observability**: PASS (non-regressive). This feature does not remove/override AgentRun accounting paths.
- **Fail-Safe Defaults**: PASS. Missing required MCP connectivity and invalid provider paths fail clearly.
- **Test-First Where Practical**: PASS. Contract-like unit/integration tests are planned before implementation completion.
- **Simplicity Over Cleverness**: PASS. Explicit resolver and probe modules; no orchestration framework complexity.

## Project Structure

### Documentation (this feature)

```text
specs/005-agent-infrastructure/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── agent-infrastructure-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── mcp/
│   │   ├── client.ts
│   │   ├── registry.ts
│   │   └── invoke.ts
│   ├── providers/
│   │   ├── model-router.ts
│   │   └── lmstudio-health.ts
│   └── lib/
│       ├── config.ts (existing runtime config bridge)
│       └── __tests__/
│           ├── mcp-client.test.ts
│           ├── model-router.test.ts
│           └── lmstudio-health.test.ts
└── tests/
    └── (if cross-module integration tests are needed)

config/runtime/
├── agents.yaml (provider routing policy source)
└── mcp.yaml (MCP server readiness + timeout policy source)
```

**Structure Decision**: Implement 005 inside `apps/api` as shared runtime infrastructure modules (`mcp/*` and `providers/*`) because these concerns are consumed by all agent workflows and should remain colocated with API/worker runtime bootstrapping.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- MCP client initialization strategy and startup behavior
- Tool-registry merge policy and name-collision handling
- Deterministic provider fallback rules
- Local-provider health probing behavior and cadence
- Logging/observability requirements for routing outcomes
- Offline-test strategy with deterministic mocks

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/agent-infrastructure-contracts.md](./contracts/agent-infrastructure-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (routing/probe behavior controlled through runtime config assumptions)
- **MCP Server Independence**: PASS (all tool interaction remains via MCP HTTP contract)
- **Fail-Safe Defaults**: PASS (explicit startup and resolution failure modes)
- **Test-First Where Practical**: PASS (offline deterministic tests specified)
- **Simplicity Over Cleverness**: PASS (clear module boundaries and explicit contracts)

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.
