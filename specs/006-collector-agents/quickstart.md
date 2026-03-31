# Quickstart: Collector Agents (006)

## Prerequisites

- Features 004 and 005 completed
- Runtime config loadable and validated
- Dependencies installed (`pnpm install`)

## 1) Verify planning artifacts

Required files:

- `specs/006-collector-agents/plan.md`
- `specs/006-collector-agents/research.md`
- `specs/006-collector-agents/data-model.md`
- `specs/006-collector-agents/contracts/collector-agents-contracts.md`
- `specs/006-collector-agents/quickstart.md`
- `specs/006-collector-agents/checklists/compatibility-007-008.md`

## 2) Generate implementation tasks

```bash
/speckit.tasks
```

## 3) Explicit scope verification before implementation

Confirm tasks explicitly map to all four in-scope collector agents:

- Watchdog (monitoring)
- Screener (discovery)
- Researcher (mission collection)
- Technician (technical collection)

And confirm scheduler/worker coverage for periodic collector execution.

## 4) Compatibility verification for 007/008 handoff

- Review `checklists/compatibility-007-008.md`
- Confirm all `CCHK00x` items are satisfied before starting 007/008 implementation

## 5) Implement feature

```bash
/speckit.implement
```

## 6) Validation focus

### Watchdog

- Snapshot persistence for all active monitored instruments
- Alert generation only on threshold/event criteria
- Operational state transitions for run lifecycle

### Screener

- Scheduled/manual trigger attribution
- Ranked findings with required supporting fields

### Researcher

- Validation-conformant mission collection output
- Recoverable failure behavior on malformed output
- Boundary compliance (collection-only payload content)

### Technician

- Indicator range consistency and required output fields
- Confidence downgrade + limitations when inputs are insufficient

### Scheduler & workers

- Duplicate-free registration across restart/re-init
- Retry behavior on transient failures with observable outcomes

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
pnpm --filter @finsight/api test -- watchdog
pnpm --filter @finsight/api test -- screener
pnpm --filter @finsight/api test -- researcher
pnpm --filter @finsight/api test -- technician
pnpm --filter @finsight/api test -- scheduler
```

## 9) Completion evidence

Populate after implementation with executed command outputs and dates.
