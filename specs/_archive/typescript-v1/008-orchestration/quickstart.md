# Quickstart: Orchestration (008)

## Prerequisites

- Features 006 and 007 finalized
- `specs/008-orchestration/spec.md` finalized
- Runtime config loads successfully
- Dependencies installed (`pnpm install`)

## 1) Verify planning artifacts

Required files:

- `specs/008-orchestration/plan.md`
- `specs/008-orchestration/research.md`
- `specs/008-orchestration/data-model.md`
- `specs/008-orchestration/contracts/orchestration-contracts.md`
- `specs/008-orchestration/quickstart.md`
- `specs/008-orchestration/checklists/requirements.md`

## 2) Generate implementation tasks

```bash
/speckit.tasks
```

## 3) Scope verification before implementation

Confirm tasks cover:

- Manager routing table for all 8 mission types
- KB fast-path confidence/freshness gating
- Parallel comparison dispatch and failure semantics
- Optional bounded low-confidence re-dispatch
- Chat/mission/KB/portfolio/watchlist/alerts/tickets/briefs route contracts
- Alert pipeline, daily brief, and earnings worker mission orchestration
- Mission + AgentRun observability and trace metadata surfaces

## 4) Contract compatibility checks

- Validate 006 collector compatibility constraints (trigger provenance, confidence range semantics)
- Validate 007 reasoning handoff compatibility (mode semantics and trade proposal boundary)
- Ensure no coupling to 006/007 internal implementation details

## 5) Implement feature

```bash
/speckit.implement
```

## 6) Validation focus

### Manager

- Intent classification and explicit routing table conformance
- KB fast-path eligibility and bypass rules
- Parallel comparison branch execution
- Low-confidence re-dispatch bounded to one cycle

### Routes

- Auth/role guard correctness
- Mission and AgentRun data exposure correctness
- Ticket transition guardrails (approve/reject)
- KB/brief retrieval contract correctness

### Workers

- Alert pipeline mission dispatch
- Daily brief mission generation for active users
- Earnings trigger mission creation behavior

## 7) Quality gates

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm check:secrets
```

Expected:

- zero type errors
- zero lint warnings
- all tests pass offline with mocks
- secret policy check passes

## 8) Suggested targeted tests during implementation

```bash
pnpm --filter @finsight/api test -- manager
pnpm --filter @finsight/api test -- missions
pnpm --filter @finsight/api test -- tickets
pnpm --filter @finsight/api test -- alert-pipeline-worker
```

## 9) Completion evidence

Implementation session date: 2026-03-31

Executed commands:

- `pnpm -r typecheck` -> pass
- `pnpm -r lint` -> pass
- `pnpm -r test` -> pass
- `pnpm check:secrets` -> pass

Observed notes:

- API tests pass offline; BullMQ emits expected Redis `ECONNREFUSED` warnings in tests where no Redis is running.
- No hardcoded-secret policy violations detected.
