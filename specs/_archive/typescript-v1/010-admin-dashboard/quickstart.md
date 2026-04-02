# Quickstart: Admin Dashboard Mission Control (010)

## Prerequisites

- Features 003, 008, and 009 completed and validated.
- `specs/010-admin-dashboard/spec.md` and `plan.md` available.
- API app runs with admin/auth routes and status aggregation enabled.
- Workspace dependencies installed (`pnpm install`).

## 1) Verify planning artifacts

Required files:

- `specs/010-admin-dashboard/plan.md`
- `specs/010-admin-dashboard/research.md`
- `specs/010-admin-dashboard/data-model.md`
- `specs/010-admin-dashboard/contracts/admin-dashboard-contracts.md`
- `specs/010-admin-dashboard/quickstart.md`
- `specs/010-admin-dashboard/decisions.md`
- `specs/010-admin-dashboard/checklists/requirements.md`

## 2) Generate implementation tasks

```bash
/speckit.tasks
```

## 3) Scope verification before implementation

Confirm tasks cover:

- Admin-only route gating and session continuity behavior.
- Dashboard status polling every 3 seconds.
- Visibility-aware polling pause/resume.
- 9-agent floor rendering with state semantics.
- Active mission pipeline + recent mission log rendering.
- Health, queue, KB, and spend panels.
- Admin action controls (config reload, screener trigger, watchdog trigger).
- Degraded-connection handling with last-known snapshot preservation.
- Reference-design fidelity mapping from `docs/dashboard-reference.html`.

## 4) Implement feature

```bash
/speckit.implement
```

## 5) Validation focus

### Security and Access

- Unauthenticated/non-admin access is blocked from protected dashboard views.
- Authorization failures clear session state and return user to sign-in.

### Polling and Resilience

- Status refresh runs every 3 seconds while visible.
- Polling pauses while hidden and resumes when visible.
- Last-known data remains visible during transient fetch failures.

### Monitoring Surface

- All 9 agents are always represented.
- Active mission and recent mission views render correctly.
- Health, queue, KB, and spend sections reflect status payload accurately.

### Admin Actions

- Config reload returns visible success/failure feedback.
- Screener and watchdog triggers return visible enqueue feedback.

## 6) Quality gates

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

## 7) Suggested targeted tests during implementation

```bash
pnpm --filter @finsight/api test -- admin-status
pnpm --filter @finsight/api test -- admin-config
pnpm --filter @finsight/api test -- triggers
pnpm --filter @finsight/dashboard test
```

## 8) Completion evidence (to fill during implementation)

Implementation session date: 2026-03-31

Executed commands:

- `pnpm --filter @finsight/dashboard typecheck` -> pass
- `pnpm --filter @finsight/dashboard test -- --pool=threads` -> pass
- `pnpm -r lint` -> pass
- `pnpm -r test -- --pool=threads` -> pass
- `pnpm check:secrets` -> pass

Observed notes:

- Dashboard app scaffold and core panels implemented; 9-slot agent floor, mission pipeline/log, health/spend/actions, and degraded status banner are functional.

Manual parity validation:

- 3-second polling cadence preserved.
- Visibility pause/resume preserved.
- Mission-control and 9-agent floor behavior preserved.
- Deterministic admin action feedback preserved.
