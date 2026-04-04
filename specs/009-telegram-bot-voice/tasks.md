# Tasks: Telegram Bot & Voice (009)

**Feature**: 009-telegram-bot-voice
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Total Tasks**: 29
**Updated**: 2026-04-04

## Notes for Implementors

- Preserve 008 notifier contract exactly:
  `telegram_bot.notifier.deliver_to_telegram(mission_id, formatted_payload)`.
- Do not add 009 config into `apps/api-service/src/api/lib/config.py`; telegram config is owned by
  `apps/telegram-bot`.
- Use only API routes that currently exist (`/operators`, `/missions`) for this feature.
- Keep all tests offline (mock PTB + respx for HTTP calls).

---

## Phase 1: Setup

- [X] T001 Update `apps/telegram-bot/pyproject.toml` dependencies for runtime + tests:
  `python-telegram-bot[ext]>=20.7`, `httpx`, `structlog`, `celery[redis]>=5.3`, `pydantic>=2`.
- [X] T002 Create package structure:
  `apps/telegram-bot/src/telegram_bot/__init__.py`,
  `apps/telegram-bot/src/telegram_bot/handlers/__init__.py`,
  `apps/telegram-bot/tests/__init__.py`.
- [X] T003 Add telegram-bot test fixtures scaffold in
  `apps/telegram-bot/tests/conftest.py`.
- [X] T004 [P] Update root pytest discovery so `apps/telegram-bot/tests` is included.

## Phase 2: Runtime Config + Utilities

- [X] T005 Create `apps/telegram-bot/src/telegram_bot/config.py` with typed Telegram config model
  and `load_telegram_config()` reading `config/runtime/telegram.yaml` fail-fast.
- [X] T006 Update `config/runtime/telegram.yaml` so required fields for handlers/notifier are present:
  rate limit, command toggles, response messages, `delivery.messageMaxLength`,
  polling timeout, and optional proactive fallback chat id.
- [X] T007 Create `apps/telegram-bot/src/telegram_bot/message_utils.py` with
  `split_long_message(text: str, limit: int) -> list[str]`.
- [X] T008 Add unit tests for `split_long_message` edge cases:
  empty string, exact limit, limit+1, multiline boundaries.

## Phase 3: User Story 1 — Text Query -> Mission (P1)

- [X] T009 [US1] Create `apps/telegram-bot/src/telegram_bot/auth.py` with
  `authenticate_operator(telegram_user_id, chat_id, api_base_url, service_token)`.
- [X] T010 [US1] In `auth.py`, implement first-contact chat binding via
  `PATCH /operators/{operator_id}` when stored chat id differs.
- [X] T011 [US1] Create `apps/telegram-bot/src/telegram_bot/handlers/messages.py`:
  authenticate -> create mission via `POST /missions` -> send ack.
- [X] T012 [US1] Create `apps/telegram-bot/tests/test_auth.py` for registered, unregistered, and
  API-unavailable auth paths.
- [X] T013 [US1] Create `apps/telegram-bot/tests/test_messages.py` for text happy path,
  access denied, and mission-create failure messaging.

## Phase 4: User Story 2 — Voice Message -> Mission (P1)

- [X] T014 [US2] Create `apps/telegram-bot/src/telegram_bot/handlers/voice.py`:
  authenticate -> download voice bytes -> transcribe -> create mission -> ack.
- [X] T015 [US2] Add graceful error handling for transcription failures with explicit user feedback.
- [X] T016 [US2] Create `apps/telegram-bot/tests/test_voice.py` covering valid transcription,
  unregistered user, and transcription service failure.

## Phase 5: User Story 3 — Commands (P2)

- [X] T017 [US3] Create `apps/telegram-bot/src/telegram_bot/handlers/commands.py`
  implementing `/missions`, `/brief`, and `/help`.
- [X] T018 [US3] Ensure all command handlers authenticate operator except `/help`.
- [X] T019 [US3] Create `apps/telegram-bot/tests/test_commands.py` for `/missions`,
  `/brief`, `/help`, and command rejection for unauthorized users.

## Phase 6: User Story 4 — Proactive Delivery (P1)

- [X] T020 [US4] Create `apps/telegram-bot/src/telegram_bot/notifier.py` with a Celery app and task:
  `deliver_to_telegram(mission_id: str, formatted_payload: dict[str, object])`.
- [X] T021 [US4] In notifier, convert payload to human-readable text and send via Telegram API with
  chunking (`split_long_message`) and retry policy.
- [X] T022 [US4] Implement proactive destination selection for single-operator mode:
  runtime-configured primary chat id (with env fallback).
- [X] T023 [US4] Create `apps/telegram-bot/tests/test_notifier.py` verifying
  short/long sends, retry path, and task name resolution.

## Phase 7: Entry Point + Integration

- [X] T024 Create `apps/telegram-bot/src/telegram_bot/main.py`:
  load config, build PTB app, register message/voice/command handlers, run polling.
- [X] T025 Update `docker-compose.yml` with `telegram-bot` and `telegram-worker` services.
- [X] T026 Update `.env.example` with required Telegram/OpenAI/service token variables.

## Phase 8: Quality Gates

- [X] T027 Run `uv run ruff check apps/telegram-bot/src apps/telegram-bot/tests`.
- [X] T028 Run `uv run mypy --strict apps/telegram-bot/src`.
- [X] T029 Run `uv run pytest apps/telegram-bot/tests -v` offline and ensure all pass.

---

## Dependency Graph

```text
Phase 1 -> Phase 2 -> (Phase 3 + Phase 4 + Phase 5 + Phase 6) -> Phase 7 -> Phase 8
```

## External Dependencies

- Feature 002: operator model and repository include Telegram IDs/chat IDs
- Feature 003: service token role for telegram-bot integration
- Feature 008: mission routes + queue dispatch to `telegram_bot.notifier.deliver_to_telegram`

