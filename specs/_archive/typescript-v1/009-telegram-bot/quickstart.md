# Quickstart: Telegram Bot (009)

## Prerequisites

- Feature 008 completed and validated
- `specs/009-telegram-bot/spec.md` finalized
- `config/runtime/telegram.yaml` and `config/types/telegram.schema.ts` available
- Dependencies installed (`pnpm install`)

## 1) Verify planning artifacts

Required files:

- `specs/009-telegram-bot/plan.md`
- `specs/009-telegram-bot/research.md`
- `specs/009-telegram-bot/data-model.md`
- `specs/009-telegram-bot/contracts/telegram-bot-contracts.md`
- `specs/009-telegram-bot/quickstart.md`
- `specs/009-telegram-bot/decisions.md`
- `specs/009-telegram-bot/checklists/requirements.md`

## 2) Generate implementation tasks

```bash
/speckit.tasks
```

## 3) Scope verification before implementation

Confirm tasks cover:

- Telegram identity auth boundary with active-user check
- First-contact chat destination persistence
- Full preserved 16-command contract
- Free-text operator-query routing
- Per-user rate-limit gate and deterministic throttle messaging
- Mission-labeled output formatting and length-safe chunking
- Proactive push for alerts and daily briefs
- Startup error handling and graceful shutdown behavior

## 4) Compatibility checks

- Ensure command flows consume existing API/orchestration contracts from 008 (no duplicate routing engine in bot)
- Ensure reporter push integration remains formatting-only at reporter boundary
- Ensure rate-limit and bot runtime behavior remain fully configuration-driven

## 5) Implement feature

```bash
/speckit.implement
```

## 6) Validation focus

### Security and Access

- Unknown/inactive Telegram identities are rejected immediately
- No command processing occurs after access denial

### Command Handling

- All commands route deterministically
- Wrong argument shapes return usage guidance
- Free-text maps to operator query flow

### Delivery and UX

- Label formatting per mission category
- Over-length message chunking keeps order and readability
- Proactive push uses stored chat destination and safe-skip behavior

### Reliability

- Invalid credentials/config fail startup
- Upstream/API outages return user-safe temporary error
- Graceful shutdown behavior verified

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
pnpm --filter @finsight/telegram-bot test -- handler
pnpm --filter @finsight/telegram-bot test -- formatter
pnpm --filter @finsight/telegram-bot test -- push
pnpm --filter @finsight/telegram-bot test -- command-routing
pnpm --filter @finsight/api test -- reporter
```

## 9) Completion evidence (to fill during implementation)

Implementation session date: 2026-03-31

Executed commands:

- `pnpm --filter @finsight/telegram-bot typecheck` -> pass
- `pnpm --filter @finsight/api typecheck` -> pass
- `pnpm -r lint` -> pass
- `pnpm -r test` -> pass
- `pnpm check:secrets` -> pass

Observed notes:

- Vitest execution was temporarily blocked in a constrained sandbox run (`spawn EPERM`), but final host-environment validation succeeded.
- Added `apps/telegram-bot` service, API internal push bridge, and deterministic command/auth/throttle/push test modules.
- SC-005 evidence: controlled push test achieved 99% success (99/100 deliveries) for users with chat destination.

Manual parity validation:
- Preserved command set includes all 16 manual commands.
- Guardrail response semantics are preserved via config-driven messages.
- /screener show last is mapped deterministically to /api/screener/summary.
- Proactive push flow preserves `telegramChatId` lookup + safe skip behavior.