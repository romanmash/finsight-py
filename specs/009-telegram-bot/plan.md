# Implementation Plan: Telegram Bot

**Branch**: `009-telegram-bot` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-telegram-bot/spec.md`

## Summary

Implement the Telegram interaction layer as the primary end-user interface, including authenticated command handling, free-text operator-query routing, configurable per-user throttling, deterministic message formatting/chunking, and proactive push delivery for alert and scheduled-brief workflows. The design preserves the original manual command contract and operational decisions while keeping all runtime behavior configuration-driven.

## Scope Preservation (From Original Manual Spec)

The following points are mandatory carryover details and must remain explicit in implementation tasks:

- **Interaction contract**:
  - Preserve the full 16-command user contract from the original draft.
  - Preserve free-text routing as operator-query behavior.
  - Preserve deterministic user-facing confirmations and denial/throttle messages.
- **Identity and access model**:
  - Authenticate by Telegram handle mapped to active internal users.
  - Persist `telegramChatId` on first successful contact for proactive pushes.
  - Unknown/inactive Telegram identities are denied before any expensive work.
- **Rate-control and delivery behavior**:
  - Per-user throttling remains configurable and restart-resilient.
  - Message formatting applies mission labels and Telegram-safe chunking.
  - Proactive push for alerts and daily briefs is first-class behavior.
  - Missing chat destination is safe-skip with warning logs.
- **Reliability behavior**:
  - Startup fails clearly on invalid bot credentials.
  - Upstream/API failures return deterministic temporary-unavailable style feedback.
  - Graceful shutdown preserves in-flight handling expectations.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS  
**Primary Dependencies**: Telegraf, Hono API client layer (internal HTTP), Prisma Client, ioredis/Redis, Zod, Pino, Vitest, msw  
**Storage**: PostgreSQL (`User.telegramHandle`, `User.telegramChatId`, mission artifacts), Redis (rate-limit counters and ephemeral bot state)  
**Testing**: Vitest unit/integration tests, offline with mocked Telegram/API calls  
**Target Platform**: Linux Docker production and Windows local development  
**Project Type**: Monorepo multi-app backend feature (new Telegram bot service + API integration points)  
**Performance Goals**: Command acknowledgment and response dispatch remain responsive under normal load; throttling decisions occur before downstream mission dispatch  
**Constraints**: No hardcoded secrets/magic values, config-driven limits and behavior, strict auth boundary on Telegram identity, offline-testable flow, no streaming partial responses  
**Scale/Scope**: One Telegram bot service with command parser/formatter/push module plus API-side wiring for proactive reporter delivery

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Everything-as-Code**: PASS. Rate-limit policy, bot behavior flags, and runtime parameters come from `config/runtime/telegram.yaml` and validated schema.
- **Agent Boundaries**: PASS. Bot is an interaction surface only; reasoning/synthesis remains in existing agent pipeline.
- **MCP Server Independence**: PASS. Bot does not call MCP servers directly; it uses existing API contracts.
- **Cost Observability**: PASS. Bot routes requests through orchestration so existing Mission/AgentRun accounting remains intact.
- **Fail-Safe Defaults**: PASS. Invalid credentials/config fail startup; command/API errors return deterministic user-safe responses.
- **Test-First Where Practical**: PASS. Command parsing/auth/rate-limit/format/push flows are all offline-testable.
- **Simplicity Over Cleverness**: PASS. Polling bot with explicit handlers and deterministic command mapping; no added orchestration layer.

## Project Structure

### Documentation (this feature)

```text
specs/009-telegram-bot/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── decisions.md
├── contracts/
│   └── telegram-bot-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   └── src/
│       ├── agents/
│       │   └── reporter.ts                    # proactive delivery integration point
│       ├── routes/
│       │   ├── screener.ts                    # existing screener summary endpoint used by bot compatibility
│       │   └── telegram-internal.ts           # internal push bridge contract (service-to-service)
│       └── lib/
│           └── ...                            # shared config/auth clients consumed by bot
└── telegram-bot/
    ├── src/
    │   ├── bot.ts                             # Telegraf bootstrap, polling lifecycle, graceful shutdown
    │   ├── handler.ts                         # auth, command dispatch, free-text routing
    │   ├── formatter.ts                       # mission labels + chunking
    │   ├── push.ts                            # pushToUser(userId, message)
    │   ├── api-client.ts                      # internal API wrapper for command flows
    │   └── __tests__/
    │       ├── handler.test.ts
    │       ├── formatter.test.ts
    │       ├── push.test.ts
    │       └── command-routing.test.ts
    ├── package.json
    └── tsconfig.json
config/
├── runtime/
│   └── telegram.yaml
└── types/
    └── telegram.schema.ts
```

**Structure Decision**: Implement Telegram functionality as a dedicated `apps/telegram-bot` service for clear operational boundaries, while reusing existing API/auth/orchestration contracts from prior features.

## Phase 0: Research Outcomes

Research completed in [research.md](./research.md):
- Authentication boundary and identity-link behavior
- Canonical command contract preservation and argument semantics
- Rate-limit persistence and fail-open/fail-safe considerations
- Formatting and Telegram chunking strategy
- Proactive push delivery design and error handling behavior
- Compatibility points with 008 orchestration and 007 reporter outputs

## Phase 1: Design Artifacts

- Data model: [data-model.md](./data-model.md)
- Interface contracts: [contracts/telegram-bot-contracts.md](./contracts/telegram-bot-contracts.md)
- Validation guide: [quickstart.md](./quickstart.md)
- Preserved implementation decisions: [decisions.md](./decisions.md)

## Post-Design Constitution Check

- **Everything-as-Code**: PASS (rate limits, behaviors, and labels remain config-controlled).
- **Agent Boundaries**: PASS (bot handles transport/UX only; analysis remains in existing agents).
- **MCP Server Independence**: PASS (bot interacts through API contracts, not MCP internals).
- **Cost Observability**: PASS (all mission-producing interactions route through manager pipeline with AgentRun accounting).
- **Fail-Safe Defaults**: PASS (invalid startup/config fails fast; runtime failures return deterministic user feedback).
- **Test-First Where Practical**: PASS (offline test matrix defined for auth, command routing, chunking, proactive push).
- **Simplicity Over Cleverness**: PASS (polling + explicit handlers; no streaming complexity).

No constitution violations identified.

## Complexity Tracking

No constitution exceptions required for this feature.
## Manual Detail Preservation (Non-Negotiable)

The following manual details are preserved explicitly and must be reflected in tasks/implementation:

- Exact command contract from manual spec, including `/screener show last` behavior.
- Exact response semantics for denial (`⛔ Access denied.`) and throttling (`⏱ Rate limit exceeded. Please wait.`).
- Explicit proactive push mechanics via persisted `telegramChatId`.
- Original manual snapshot retained at `specs/009-telegram-bot/manual-spec-original.md`.

Any deviation requires documented rationale and explicit compatibility handling.

- Deterministic compatibility path: /screener show last maps to /api/screener/summary in bot command routing (no alternate implementation path).
- Internal push bridge auth path: X-Internal-Token header validated against TELEGRAM_INTERNAL_TOKEN from .env.
