# Tasks: Telegram Bot

**Input**: Design documents from `/specs/009-telegram-bot/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included as required by project constitution quality gates and offline validation policy.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create Telegram bot workspace and baseline runtime wiring.

- [X] T001 Create Telegram bot workspace package and scripts in `apps/telegram-bot/package.json`
- [X] T002 Create Telegram bot TypeScript config in `apps/telegram-bot/tsconfig.json`
- [X] T003 [P] Create Telegram bot entrypoint and bootstrap skeleton in `apps/telegram-bot/src/bot.ts`
- [X] T004 [P] Create Telegram bot API client skeleton in `apps/telegram-bot/src/api-client.ts`
- [X] T005 [P] Create Telegram bot test harness setup in `apps/telegram-bot/src/__tests__/setup.ts`
- [X] T006 Register telegram-bot workspace and scripts in `pnpm-workspace.yaml` and root `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared foundations required before any user story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Implement runtime config access + validation usage for telegram policy in `apps/telegram-bot/src/config.ts`
- [X] T008 Implement identity lookup and principal resolution adapter in `apps/telegram-bot/src/auth.ts`
- [X] T009 Implement per-user Redis-backed rate limiter core in `apps/telegram-bot/src/rate-limit.ts`
- [X] T010 Implement command parser and normalized command envelope types in `apps/telegram-bot/src/commands.ts`
- [X] T011 Implement response message chunking + label formatter utilities in `apps/telegram-bot/src/formatter.ts`
- [X] T012 Implement chat-id persistence helper for first successful contact in `apps/telegram-bot/src/user-chat-link.ts`
- [X] T013 Implement proactive push transport helper in `apps/telegram-bot/src/push.ts`
- [X] T014 Wire graceful startup/shutdown lifecycle and dependency initialization in `apps/telegram-bot/src/bot.ts`
- [X] T015 Add foundational unit tests for parser/rate-limit/formatter primitives in `apps/telegram-bot/src/__tests__/foundation.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Secure Access via Telegram Identity (Priority: P1) 🎯 MVP

**Goal**: Allow only mapped active users to interact and persist chat destination on first successful contact.

**Independent Test**: Unknown/inactive identities are rejected immediately; active identity proceeds; first successful contact stores chat destination.

### Tests for User Story 1

- [X] T016 [P] [US1] Add auth denial/allowance behavior tests in `apps/telegram-bot/src/__tests__/handler.auth.test.ts`
- [X] T017 [P] [US1] Add first-contact chat destination persistence tests in `apps/telegram-bot/src/__tests__/handler.chat-link.test.ts`

### Implementation for User Story 1

- [X] T018 [US1] Implement Telegram handler auth gate + principal resolution in `apps/telegram-bot/src/handler.ts`
- [X] T019 [US1] Implement denied-access deterministic response branch in `apps/telegram-bot/src/handler.ts`
- [X] T020 [US1] Persist `telegramChatId` after first successful interaction in `apps/telegram-bot/src/handler.ts` and `apps/telegram-bot/src/user-chat-link.ts`
- [X] T021 [US1] Integrate US1 auth + chat-link flow into bot update pipeline in `apps/telegram-bot/src/bot.ts`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Command-Driven Mission Operations (Priority: P1)

**Goal**: Support all preserved commands plus free-text operator-query routing with deterministic backend mapping.

**Independent Test**: Each command maps to expected backend action and returns deterministic confirmation/error feedback.

### Tests for User Story 2

- [X] T022 [P] [US2] Add command parsing and argument-shape tests for full command set in `apps/telegram-bot/src/__tests__/commands.test.ts`
- [X] T023 [P] [US2] Add command-to-API routing contract tests in `apps/telegram-bot/src/__tests__/command-routing.test.ts`
- [X] T024 [P] [US2] Add free-text operator-query routing tests in `apps/telegram-bot/src/__tests__/handler.freetext.test.ts`

### Implementation for User Story 2

- [X] T025 [US2] Implement command registry for preserved 16-command contract in `apps/telegram-bot/src/commands.ts`
- [X] T026 [US2] Implement command handler routing table in `apps/telegram-bot/src/handler.ts`
- [X] T027 [US2] Implement backend API client methods for chat/kb/watchlist/portfolio/alerts/tickets/briefs/screener in `apps/telegram-bot/src/api-client.ts`
- [X] T028 [US2] Implement deterministic user feedback templates for success and input errors in `apps/telegram-bot/src/handler.ts`
- [X] T029 [US2] Implement non-command free-text route to operator-query in `apps/telegram-bot/src/handler.ts`
- [X] T030 [US2] Register command handlers with Telegraf bootstrap in `apps/telegram-bot/src/bot.ts`

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Fair Usage Through Rate Limits (Priority: P1)

**Goal**: Enforce per-user throttling before downstream mission/API invocation with restart-resilient behavior.

**Independent Test**: Requests above policy are throttled with deterministic message; user regains access after window reset.

### Tests for User Story 3

- [X] T031 [P] [US3] Add rate-limit threshold and reset behavior tests in `apps/telegram-bot/src/__tests__/rate-limit.test.ts`
- [X] T032 [P] [US3] Add handler throttling-before-dispatch tests in `apps/telegram-bot/src/__tests__/handler.rate-limit.test.ts`

### Implementation for User Story 3

- [X] T033 [US3] Integrate per-user rate-limit gate into command/free-text path in `apps/telegram-bot/src/handler.ts`
- [X] T034 [US3] Implement deterministic throttle response messaging in `apps/telegram-bot/src/handler.ts`
- [X] T035 [US3] Wire Redis policy values from telegram runtime config in `apps/telegram-bot/src/config.ts` and `apps/telegram-bot/src/rate-limit.ts`

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: User Story 4 - Readable and Consistent Message Formatting (Priority: P1)

**Goal**: Provide mission-labeled and Telegram-safe chunked responses for all delivery paths.

**Independent Test**: Oversized responses are chunked in order without semantic truncation; labels are applied consistently.

### Tests for User Story 4

- [X] T036 [P] [US4] Add label application tests across mission categories in `apps/telegram-bot/src/__tests__/formatter.labels.test.ts`
- [X] T037 [P] [US4] Add max-length chunking and ordering tests in `apps/telegram-bot/src/__tests__/formatter.chunking.test.ts`

### Implementation for User Story 4

- [X] T038 [US4] Implement mission label mapping and formatting envelope in `apps/telegram-bot/src/formatter.ts`
- [X] T039 [US4] Implement word-boundary chunk splitting for Telegram limits in `apps/telegram-bot/src/formatter.ts`
- [X] T040 [US4] Apply formatter/chunker in command and free-text response pipeline in `apps/telegram-bot/src/handler.ts`

**Checkpoint**: User Story 4 is independently functional and testable.

---

## Phase 7: User Story 5 - Proactive Notification Delivery (Priority: P1)

**Goal**: Deliver alert and daily-brief pushes to user chat destinations with safe skip/logging when destination missing.

**Independent Test**: Push sends for user with chat-id; push is skipped and logged for user without chat-id.

### Tests for User Story 5

- [X] T041 [P] [US5] Add push delivery and missing-chat skip tests in `apps/telegram-bot/src/__tests__/push.test.ts`
- [X] T042 [P] [US5] Add reporter integration tests for proactive telegram delivery hook in `apps/api/src/lib/__tests__/reporter-telegram-push.test.ts`

### Implementation for User Story 5

- [X] T043 [US5] Implement `pushToUser(userId, message)` lookup/send behavior in `apps/telegram-bot/src/push.ts`
- [X] T044 [US5] Implement safe-skip + warning logging for missing chat destinations in `apps/telegram-bot/src/push.ts`
- [X] T045 [US5] Integrate reporter proactive delivery adapter to telegram bot push channel in `apps/api/src/agents/reporter.ts`
- [X] T046 [US5] Define and implement `telegram-internal` push bridge contract with `X-Internal-Token` + `TELEGRAM_INTERNAL_TOKEN` auth, payload schema, and response envelope in `specs/009-telegram-bot/contracts/telegram-bot-contracts.md`, `apps/api/src/routes/telegram-internal.ts`, and `apps/telegram-bot/src/api-client.ts`
- [X] T047 [US5] Wire internal telegram route registration and service-auth guard for push bridge in `apps/api/src/app.ts`

**Checkpoint**: User Story 5 is independently functional and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story hardening, docs, and full validation.

- [X] T048 [P] Add operational logs/metrics consistency checks for denial/throttle/push failures in `apps/telegram-bot/src/handler.ts` and `apps/telegram-bot/src/push.ts`
- [X] T049 [P] Add telegram bot quickstart run/verify steps to project docs in `docs/SETUP.md` and `specs/009-telegram-bot/quickstart.md`
- [X] T050 Run full validation gates (`typecheck`, `lint`, `test`, `check:secrets`) and record evidence in `specs/009-telegram-bot/quickstart.md`
- [X] T051 Verify no hardcoded values/secrets and no UTF-8 BOM in changed files for 009 scope
- [X] T052 Validate manual detail parity against `specs/009-telegram-bot/manual-spec-original.md` (commands, messages, push flow) and document deltas in `specs/009-telegram-bot/quickstart.md`
- [X] T053 Implement deterministic `/screener show last` compatibility by mapping bot command handling to `/api/screener/summary` in `apps/telegram-bot/src/handler.ts`
- [X] T054 Implement command-behavior toggles in `config/runtime/telegram.yaml`, `config/types/telegram.schema.ts`, and `apps/telegram-bot/src/handler.ts`
- [X] T055 Add tests and evidence collection for proactive-delivery success-rate measurement (SC-005) in `apps/telegram-bot/src/__tests__/push.test.ts` and `specs/009-telegram-bot/quickstart.md`
- [X] T056 Add sender-attribute validation and deterministic `validation_error` handling for missing `from.id`/`chat.id`/identity in `apps/telegram-bot/src/handler.ts` and `apps/telegram-bot/src/__tests__/handler.validation.test.ts`
- [X] T057 Implement command argument-contract validation (including `/reject` optional reason and `/screener show last` exact phrase) in `apps/telegram-bot/src/commands.ts` and `apps/telegram-bot/src/__tests__/commands.test.ts`
- [X] T058 Implement startup dependency/credential/config fail-fast checks in `apps/telegram-bot/src/bot.ts` and `apps/telegram-bot/src/config.ts` with tests in `apps/telegram-bot/src/__tests__/startup.test.ts`
- [X] T059 Implement proactive delivery idempotency/correlation handling for duplicate event attempts in `apps/telegram-bot/src/push.ts` and `apps/telegram-bot/src/__tests__/push.test.ts`
- [X] T060 Add observability field-completeness tests for required log context in `apps/telegram-bot/src/__tests__/handler.logging.test.ts` and `apps/telegram-bot/src/__tests__/push.logging.test.ts`
- [X] T061 Add latency measurement harness + evidence for SC-008 in `apps/telegram-bot/src/__tests__/performance.ack-latency.test.ts` and `specs/009-telegram-bot/quickstart.md`
- [X] T062 Validate privacy guardrails (no sensitive token/secret logging; minimal identity data retention) in `apps/telegram-bot/src/__tests__/privacy.test.ts` and `specs/009-telegram-bot/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies, starts immediately.
- **Phase 2 (Foundational)**: Depends on Setup completion and blocks all user stories.
- **Phases 3-7 (User Stories)**: Depend on Foundational completion; can proceed in parallel if staffed.
- **Phase 8 (Polish)**: Depends on completion of all targeted user stories.

### User Story Dependencies

- **US1**: Starts after Phase 2, no dependency on other stories.
- **US2**: Starts after Phase 2, independent from US1 except shared foundations.
- **US3**: Starts after Phase 2, depends on foundational rate-limit primitives.
- **US4**: Starts after Phase 2, depends on foundational formatter primitives.
- **US5**: Starts after Phase 2; depends on established auth/chat-link data path and reporter integration contract.

### Within Each User Story

- Tests first (write and fail) before implementation tasks.
- Parsing/types before handlers.
- Handlers before integration wiring.
- Story checkpoint validation before moving to broader polish.

### Parallel Opportunities

- Setup tasks T003-T005 can run in parallel.
- Foundational tasks T008-T011 can run in parallel after T007.
- Story test tasks marked [P] can run in parallel.
- US2-US4 can be parallelized once Phase 2 completes.

---

## Parallel Example: User Story 2

```bash
# Parallel tests:
Task: "T022 [US2] command parsing tests in apps/telegram-bot/src/__tests__/commands.test.ts"
Task: "T023 [US2] command routing contract tests in apps/telegram-bot/src/__tests__/command-routing.test.ts"
Task: "T024 [US2] free-text routing tests in apps/telegram-bot/src/__tests__/handler.freetext.test.ts"

# Parallel implementation slices:
Task: "T025 [US2] command registry in apps/telegram-bot/src/commands.ts"
Task: "T027 [US2] backend API client methods in apps/telegram-bot/src/api-client.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate access control + first-contact persistence independently.
4. Demo/deploy MVP security boundary.

### Incremental Delivery

1. Setup + Foundational complete.
2. Deliver US1 (security gate).
3. Deliver US2 (command contract).
4. Deliver US3 (throttling control).
5. Deliver US4 (format/UX quality).
6. Deliver US5 (proactive intelligence push).
7. Finish Polish.

### Parallel Team Strategy

1. Team aligns on Setup + Foundational.
2. After Phase 2:
   - Dev A: US1 + US3
   - Dev B: US2
   - Dev C: US4 + US5 integration slices
3. Merge by story checkpoints, then perform cross-cutting polish.

---

## Notes

- [P] tasks indicate file-disjoint, dependency-safe parallelization.
- Story labels enforce traceability to spec user stories.
- Commit per task or per coherent story slice.
- Keep preserved implementation decisions synchronized with `specs/009-telegram-bot/decisions.md`.