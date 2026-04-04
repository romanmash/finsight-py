# Implementation Plan: Telegram Bot & Voice

**Branch**: `009-telegram-bot-voice` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)

## Summary

Build the async Telegram bot using python-telegram-bot v20: authenticate operators by Telegram
user ID matched against the DB, handle text queries and voice messages (OGG → OpenAI Whisper →
text), dispatch missions to the orchestration layer, deliver proactive alerts via Celery
notification tasks, and support slash commands (/watchlist, /missions, /brief, /alert acknowledge).
All bot interactions tested offline with mocked PTB update objects and mocked Whisper API.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: python-telegram-bot[ext]>=20.7, httpx, structlog
**Storage**: PostgreSQL (Operator.telegram_user_id + telegram_chat_id, via API HTTP client)
**Testing**: pytest + pytest-asyncio + respx + unittest.mock (offline)
**Target Platform**: Linux server (Docker) — telegram-bot container
**Project Type**: Standalone async Python app (apps/telegram-bot)
**Performance Goals**: Text query ack < 3 s; voice transcription + ack < 10 s; proactive delivery < 30 s
**Constraints**: mypy --strict; offline tests; no real Telegram API or Whisper in tests
**Scale/Scope**: Single-operator personal tool; long-polling mode

## Constitution Check

- [x] Everything-as-Code — Whisper model, confidence threshold, ack message in config/runtime/telegram.yaml
- [x] Agent Boundaries — bot dispatches missions; never calls agents directly
- [x] MCP Server Independence — N/A (bot calls API HTTP endpoints, not MCP tools)
- [x] Cost Observability — N/A (bot makes no LLM calls; Whisper cost tracked separately via OpenAI)
- [x] Fail-Safe Defaults — Whisper unavailable → inform operator, request text resend; Telegram API down → Celery retry
- [x] Test-First — all handlers tested offline with mock PTB update objects
- [x] Simplicity Over Cleverness — long-polling (no webhook complexity); PTB Application pattern

## Project Structure

### Source Code

```text
apps/telegram-bot/src/telegram_bot/
├── __init__.py
├── main.py                  # Application setup, handler registration, long-polling start
├── auth.py                  # authenticate_operator(user_id) → Operator | None via API
├── notifier.py              # deliver_notification Celery task (called when mission completes)
├── message_utils.py         # split_long_message(text, limit) → list[str]
└── handlers/
    ├── __init__.py
    ├── commands.py          # /watchlist, /missions, /brief, /help, /alert acknowledge
    ├── voice.py             # voice message → Whisper → mission dispatch
    └── messages.py          # text message → mission dispatch

config/runtime/telegram.yaml
config/schemas/telegram.py

apps/telegram-bot/tests/
├── conftest.py              # mock bot, mock API client, make_update() fixture
├── test_auth.py             # registered user → Operator; unregistered → None
├── test_commands.py         # each slash command produces correct output
├── test_voice.py            # OGG bytes → mock Whisper → mission created
└── test_notifier.py         # notification delivered to correct chat_id
```

## Implementation Phases

### Phase 1: Config

**Files**: `config/runtime/telegram.yaml`, `config/schemas/telegram.py`

**Key decisions**:
- `TelegramConfig` Pydantic v2 BaseModel: `whisper_model: str`, `confidence_threshold: float`,
  `ack_message: str`, `max_message_length: int = 4096`, `poll_timeout_seconds: int = 30`
- Loaded and validated at `main.py` module level; `sys.exit(1)` with Pydantic error path on
  any validation failure — same fail-fast contract as all other apps in this project
- Bot token (`TELEGRAM_BOT_TOKEN`) and service JWT (`TELEGRAM_SERVICE_TOKEN`) come from `.env`
  only — never in YAML

### Phase 2: Auth Module

**Files**: `apps/telegram-bot/src/telegram_bot/auth.py`

**Key decisions**:
- `authenticate_operator(telegram_user_id: int) -> Operator | None`
- HTTP GET to API `/operators?telegram_user_id={id}` (uses service JWT from .env)
- First message from operator → POST to API to store telegram_chat_id

### Phase 3: Command Handlers

**Files**: `apps/telegram-bot/src/telegram_bot/handlers/commands.py`

**Key decisions**:
- All handlers call `authenticate_operator()` first; send "Access denied" if None
- `/watchlist` → GET API `/watchlist` → format as numbered list
- `/missions` → GET API `/missions?limit=10` → format with status emoji
- `/brief` → POST API `/missions` with `query="daily brief"` → send ack
- `/alert acknowledge {id}` → PATCH API `/alerts/{id}` → confirm; admin only

### Phase 4: Voice Handler

**Files**: `apps/telegram-bot/src/telegram_bot/handlers/voice.py`

**Key decisions**:
- Download OGG to bytes via `file.download_to_memory()`
- POST bytes to OpenAI Whisper via httpx (allows respx mocking)
- Low confidence response (if available) → ask to clarify; otherwise proceed
- Whisper unavailable (httpx error) → send "Voice transcription unavailable, please resend as text"

### Phase 5: Text Message Handler

**Files**: `apps/telegram-bot/src/telegram_bot/handlers/messages.py`

**Key decisions**:
- POST to API `/missions` with `query=update.message.text`
- Send ack: "Processing your request... I'll reply when done."

### Phase 6: Proactive Notifier

**Files**: `apps/telegram-bot/src/telegram_bot/notifier.py`

**Key decisions**:
- Celery task `deliver_to_telegram(chat_id: str, text: str) -> None` defined in
  `apps/telegram-bot/src/telegram_bot/notifier.py`
- **Celery app instance in telegram-bot**: `notifier.py` defines its own `Celery` app instance:
  ```python
  celery_app = Celery(
      "telegram_bot",
      broker=os.environ["REDIS_URL"],
      backend=os.environ["REDIS_URL"],
  )
  ```
  This is standard Celery multi-app practice — multiple apps share the same Redis broker
  without any code coupling between packages. The `@celery_app.task(...)` decorator registers
  the task under the fully-qualified name `telegram_bot.notifier.deliver_to_telegram`, which
  is the name `apps/api-service` uses when calling `send_task(...)`.
- **Cross-package dispatch**: `apps/api-service` (mission_worker) and `apps/telegram-bot` are separate
  uv workspace packages — `apps/api-service` cannot import from `apps/telegram-bot`. The dispatch uses
  Celery's name-based routing:
  ```python
  # In apps/api-service/src/api/workers/mission_worker.py (on mission completion):
  celery_app.send_task(
      "telegram_bot.notifier.deliver_to_telegram",
      args=[chat_id, formatted_text],
      queue="telegram",
  )
  ```
  The telegram-bot container runs its own Celery worker consuming only the `telegram` queue:
  `celery -A telegram_bot.notifier worker -Q telegram`
- The `telegram` queue is registered in `config/runtime/scheduler.yaml` alongside the other
  queues; `008/plan.md` queue config is updated accordingly
- Splits long messages via `message_utils.split_long_message()` before sending
- `autoretry_for=(TelegramError,), max_retries=3, default_retry_delay=5`

### Phase 7: App Entry Point

**Files**: `apps/telegram-bot/src/telegram_bot/main.py`

**Key decisions**:
- `ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()`
- Register all handlers; `application.run_polling(timeout=30)`

### Phase 8: Tests

- `make_update(text)` fixture constructs PTB Update from dict
- Mock bot's `send_message` with MagicMock
- respx mocks Whisper API and internal API calls
- Unregistered user: mock API returning 404 → verify "Access denied" sent

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Whisper HTTP client | httpx (not openai SDK) | Allows respx mocking in tests |
| Auth mechanism | Telegram user ID matched against DB | Stable unique identifier; no passwords |
| Proactive delivery | Celery task with retry | Decoupled from mission pipeline; resilient |
| Long-polling vs webhook | Long-polling | No public URL needed for local server |
| API communication | HTTP client (not direct repo calls) | Bot is a separate process; respects service boundary |

## Testing Strategy

- All tests construct Update objects directly (no real Telegram)
- respx mocks: Whisper API, FinSight API (watchlist, missions, alerts)
- Voice test: inject OGG bytes → respx returns transcription JSON → verify mission created
- Auth test: respx returns 404 for unknown user → verify rejection message

## Dependencies

- **Requires**: 008-orchestration (mission creation API), 002 (Operator DB model), 003 (auth tokens)
- **Required by**: 011-seed-infrastructure (seed operator with telegram IDs)
