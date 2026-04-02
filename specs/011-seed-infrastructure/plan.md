# Implementation Plan: Seed & Infrastructure Readiness

**Branch**: `011-seed-infrastructure` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-seed-infrastructure/spec.md`

## Summary

Implement the final readiness layer for FinSight by adding deterministic idempotent seed data, deployment automation (CI + remote deploy/log scripts), infrastructure-as-code scaffolding, and complete environment documentation so the platform can be demonstrated and deployed repeatably with strong operational confidence.

## Scope Preservation (From Original Manual Spec)

The following points are mandatory carryover details and must remain explicit in implementation tasks:

- **Demo-first seed objective**:
  - Seed must create a lived-in environment (not just minimal valid rows).
  - Demo walkthrough must surface thesis/history/alerts/missions/dashboard data immediately after seed.
- **Seed content coverage**:
  - Include user personas (admin + analyst), portfolio/watchlist context, thesis + historical contradiction progression, screener run history, alerts, mission history, and document-ingestion baseline.
- **Reliability and safety**:
  - Seed reruns must be idempotent and conflict-safe.
  - No hardcoded secrets in source; credentials flow through environment/config.
- **Delivery and operations**:
  - CI quality gates run before deploy eligibility.
  - Deploy script synchronizes artifacts and validates health post-restart.
  - Logs helper supports service-targeted tailing.
- **Infrastructure intent**:
  - IaC preview/provision path exists for cloud deployment while local/server deployment remains supported.

## Technical Context

**Language/Version**: TypeScript 5.x strict, Node.js 20 LTS, shell scripting (Bash) for ops helpers
**Primary Dependencies**: Prisma, pgvector/PostgreSQL, Redis, Docker Compose, GitHub Actions, Pulumi (TypeScript), existing monorepo workspace tooling (`pnpm`)
**Storage**: Existing PostgreSQL domain schema and Redis queue/cache; no new persistence engine introduced in 011
**Testing**: Vitest unit/integration tests, offline mocks, seed idempotency verification runs, script contract checks
**Target Platform**: Linux server runtime (Docker), Windows dev laptop + WSL/dev shell, GitHub self-hosted runner
**Project Type**: Monorepo backend/infrastructure/delivery feature (seed + IaC + CI/CD + ops scripts + env docs)
**Performance Goals**: Seed completes deterministically for demo scale within practical setup window; deploy verification reports service health promptly
**Constraints**: No hardcoded secrets/magic secrets, fail-fast config behavior, offline-test compatibility, branch-aware deploy gating, preserve decisions from `decisions.md`
**Scale/Scope**: One feature touching database bootstrap, CI pipeline, deployment scripts, infra definitions, and environment documentation across repo-level tooling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Seed behavior, runtime inputs, and deployment/infrastructure definitions remain versioned artifacts with configuration-driven values.
- **Agent Boundaries**: PASS. 011 introduces no new agent-role blending; it seeds and deploys around existing boundaries.
- **MCP Server Independence**: PASS. No direct cross-import shortcuts introduced; seed/deploy works through existing app/service boundaries.
- **Cost Observability**: PASS. Seed includes mission/agent-run data alignment without bypassing existing accounting model.
- **Fail-Safe Defaults**: PASS. Seed/deploy flow designed with fail-fast checks, explicit diagnostics, and gate-blocking on errors.
- **Test-First Where Practical**: PASS. Idempotency checks, contract checks, and script behavior are testable without network dependency.
- **Simplicity Over Cleverness**: PASS. Straightforward seed + scripted deploy + workflow gating, avoiding orchestration complexity.

## Project Structure

### Documentation (this feature)

```text
specs/011-seed-infrastructure/
|- plan.md
|- research.md
|- data-model.md
|- quickstart.md
|- decisions.md
|- manual-spec-original.md
|- contracts/
|  `- seed-infrastructure-contracts.md
`- tasks.md
```

### Source Code (repository root)

```text
.github/
`- workflows/
   |- secret-policy.yml                # existing secret policy workflow
   `- ci-cd.yml                        # new validation + deploy pipeline for 011

prisma/
|- seed.ts                             # new deterministic demo seed bootstrap
`- __tests__/                          # seed validation tests

infra/
`- pulumi/
   |- Pulumi.yaml
   |- Pulumi.dev.yaml
   `- index.ts                         # infrastructure entrypoint for preview/provision

scripts/
|- deploy.sh                           # remote sync + restart + health verification
|- logs.sh                             # service-targeted remote log tail
`- __tests__/                          # deploy/log contract tests

config/
|- runtime/                            # existing YAML runtime controls consumed by app/services
`- types/                              # existing Zod schemas; updated only if 011 introduces config keys

tools/
`- validation/                         # policy/parity/env/pulumi validation scripts

.env.example                           # expanded required variable contract
```

**Structure Decision**: Keep 011 as a repo-level readiness feature touching existing operational layers (`prisma`, `.github/workflows`, `infra`, `scripts`, `.env.example`) while also introducing focused validation harness paths (`prisma/__tests__`, `scripts/__tests__`, `tools/validation`) for constitution-aligned test-first execution.
## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Idempotent seed strategy and reconciliation model
- Seed credential handling aligned with no-hardcoded-secrets rule
- CI gate ordering and branch-gated deployment policy
- Remote deploy script reliability and health verification pattern
- Pulumi stack scoping for reproducible preview/provision intent
- Environment variable documentation and validation coverage strategy

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/seed-infrastructure-contracts.md](./contracts/seed-infrastructure-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)
- Preserved implementation decisions: [decisions.md](./decisions.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (all behavior captured in seed/workflow/IaC/scripts/docs artifacts under version control).
- **Agent Boundaries**: PASS (no role drift introduced; seed only prepares data for existing agents).
- **MCP Server Independence**: PASS (no boundary violations in planned integration paths).
- **Cost Observability**: PASS (seeded mission/agent data remains compatible with existing AgentRun accounting fields).
- **Fail-Safe Defaults**: PASS (explicit failure handling required in seed/deploy/contracts).
- **Test-First Where Practical**: PASS (idempotency and pipeline gating covered by validation guidance).
- **Simplicity Over Cleverness**: PASS (composable scripts and clear workflow stages).

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.

## Manual Detail Preservation (Non-Negotiable)

The following manual details are preserved explicitly and must be reflected in tasks/implementation:

- Seed creates demo-ready data across users, portfolio/watchlists, KB thesis/history (including contradiction), screener, alerts, missions/agent runs, and ingested-document baseline.
- Seed reruns are idempotent and safe.
- No hardcoded secrets; credential-sensitive values remain environment/config-driven.
- CI executes ordered quality gates before any deploy-capable stage.
- Deploy script performs remote synchronization, restart/update, and health verification.
- Logs helper supports named service/container tailing.
- Original manual snapshot retained at `specs/011-seed-infrastructure/manual-spec-original.md`.
- Decision authority retained at `specs/011-seed-infrastructure/decisions.md`; deviations require explicit rationale.

## Manual Parity Enforcement

The planning and tasking workflow for 011 MUST consume:

- `manual-spec-original.md` (source of original concrete detail)
- `decisions.md` (approved preserved decisions)
- `manual-parity.md` (row-by-row preservation map)

Any task omission against a "Preserved" parity row is considered a planning defect.
