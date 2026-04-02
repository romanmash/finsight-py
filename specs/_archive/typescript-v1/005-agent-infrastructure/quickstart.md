# Quickstart: Agent Infrastructure (005)

## Prerequisites

- Features 003 and 004 completed
- Runtime config validated and loadable
- Dependencies installed (`pnpm install`)

## 1) Verify planning artifacts

Required files:

- `specs/005-agent-infrastructure/plan.md`
- `specs/005-agent-infrastructure/research.md`
- `specs/005-agent-infrastructure/data-model.md`
- `specs/005-agent-infrastructure/contracts/agent-infrastructure-contracts.md`
- `specs/005-agent-infrastructure/quickstart.md`

## 2) Generate implementation tasks

```bash
/speckit.tasks
```

## 3) Implement feature

```bash
/speckit.implement
```

## 4) Validation focus

### MCP client/registry

- Required MCP servers validated at startup
- Per-server and merged tool sets available
- Tool collisions are rejected deterministically

### Provider router

- Primary provider resolution works for configured agents
- Fallback path activates deterministically when primary unavailable
- Invalid or missing provider paths fail with clear errors

### Local-provider health

- Probe returns available/unavailable deterministically
- Probe timeout is bounded
- Periodic re-probe updates routing state

## 5) Quality gates

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

## 6) Suggested implementation smoke tests

```bash
# run targeted tests once implemented
pnpm --filter @finsight/api test -- mcp
pnpm --filter @finsight/api test -- provider
```

## 7) Completion evidence

Executed on 2026-03-31:

- `pnpm --filter @finsight/api typecheck` -> PASS
- `pnpm --filter @finsight/api lint` -> PASS
- `pnpm --filter @finsight/api test` -> PASS (19 files, 69 tests)
- `pnpm check:secrets` -> PASS (`Secret policy check passed.`)

Notes:

- In this environment, `vitest` and `check:secrets` required execution outside sandbox restrictions because process spawning was blocked inside the sandbox (`EPERM`).
