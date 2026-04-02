# Quickstart: Reasoning Agents (007)

## Prerequisites

- Features 005 and 006 completed
- `specs/007-reasoning-agents/spec.md` finalized
- Runtime config loads successfully
- Dependencies installed (`pnpm install`)

## 1) Verify planning artifacts

Required files:

- `specs/007-reasoning-agents/plan.md`
- `specs/007-reasoning-agents/research.md`
- `specs/007-reasoning-agents/data-model.md`
- `specs/007-reasoning-agents/contracts/reasoning-agents-contracts.md`
- `specs/007-reasoning-agents/quickstart.md`
- `specs/007-reasoning-agents/checklists/requirements.md`

## 2) Generate implementation tasks

```bash
/speckit.tasks
```

## 3) Scope verification before implementation

Confirm tasks map explicitly to all in-scope reasoning agents:

- Analyst (standard, devil_advocate, comparison)
- Bookkeeper (KB update, snapshot, contradiction handling)
- Reporter (formatting, fallback, delivery, chunking)
- Trader (ticket proposal with safety guardrails)

And confirm all preserved decisions in `spec.md -> Important Decisions To Preserve` are represented in tasks.

## 4) Contract compatibility checks

- Verify 006 collector contract assumptions in `contracts/reasoning-agents-contracts.md`
- Confirm 007 outputs are shaped for orchestration handoff (008)
- Ensure no coupling to 006 internal implementation details

## 5) Implement feature

```bash
/speckit.implement
```

## 6) Validation focus

### Analyst

- Mode behavior (`standard`, `devil_advocate`, `comparison`)
- Tool-free synthesis boundary
- Output schema validation retry behavior
- Portfolio-context aware synthesis path

### Bookkeeper

- Non-initial snapshot-before-overwrite behavior
- High-severity-only contradiction alerting
- Embedding-required persistence
- Transactional write integrity

### Reporter

- Mission-aware label selection
- Formatter primary/fallback behavior
- Telegram message chunk splitting
- Daily brief persistence behavior

### Trader

- Thesis-aware ticket creation
- Exactly 3-sentence rationale enforcement
- Mandatory human-approval warning
- Reject invalid sell intents for non-held positions

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
pnpm --filter @finsight/api test -- analyst
pnpm --filter @finsight/api test -- bookkeeper
pnpm --filter @finsight/api test -- reporter
pnpm --filter @finsight/api test -- trader
```

## 9) Completion evidence

Populate after implementation with executed command outputs and dates.
