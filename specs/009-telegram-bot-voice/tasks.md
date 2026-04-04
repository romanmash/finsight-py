# Tasks: Telegram Bot & Voice (009)

**Feature**: 009-telegram-bot-voice
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Total Tasks**: 30
**Generated**: 2026-04-03

## Notes for Implementors

- **Separate uv workspace package**: The telegram-bot is `apps/telegram-bot/` — its own
  `pyproject.toml`, own `Celery` app instance in `notifier.py`. No imports from `apps/api-service`.
- **Celery multi-app**: `notifier.py` defines `celery_app = Celery("telegram_bot", ...)`.
  This registers tasks under `telegram_bot.notifier.deliver_to_telegram` — exactly the name
  that `apps/api-service/workers/mission_worker.py` uses in `send_task(...)`.
- **Telegram worker command**: `celery -A telegram_bot.notifier worker -Q telegram`
- **Auth is HTTP, not direct DB**: `authenticate_operator()` calls `GET /operators?telegram_user_id={id}`
  with service JWT. The bot never imports SQLAlchemy or repository classes.
- **Whisper via httpx**: Use `httpx.AsyncClient` (not openai SDK) to call Whisper — enables
  respx mocking in offline tests.
- **No real Telegram in tests**: Construct `Update` objects from dicts; mock `bot.send_message`
  with `AsyncMock`. Use respx to mock all HTTP calls (Whisper + FinSight API).
- **Message splitting**: All sends go through `split_long_message(text, limit=4096) -> list[str]`
  before dispatching to Telegram.
- **docker-compose**: Add `telegram-bot` service using same base image; command: long-polling
  entry point + separate `telegram-worker` service running the Celery consumer on `telegram` queue.

---

## Phase 1: Setup

- [ ] T001 Create `apps/telegram-bot/pyproject.toml` with package name `telegram-bot`, `[project.dependencies]` including `python-telegram-bot[ext]>=20.7`, `httpx`, `structlog`, `celery[redis]>=5.3`, `pydantic>=2.0`; add to `[tool.uv.workspace]` in root `pyproject.toml`
- [ ] T002 Create `apps/telegram-bot/src/telegram_bot/__init__.py` and `apps/telegram-bot/src/telegram_bot/handlers/__init__.py` as empty module stubs
- [ ] T003 Create `apps/telegram-bot/tests/__init__.py` and `apps/telegram-bot/tests/conftest.py` stub (empty fixtures only)
- [ ] T004 [P] Add `python-telegram-bot[ext]>=20.7` and `httpx` dev notes to `docs/STACK.md` if a telegram-bot section is absent (add package reference only — do not modify locked tech stack table)

---

## Phase 2: Foundational

- [ ] T005 Create `config/runtime/telegram.yaml` with `whisper_model: "whisper-1"`, `confidence_threshold: 0.6`, `ack_message: "Processing your request... I'll reply when done."`, `max_message_length: 4096`, `poll_timeout_seconds: 30`
- [ ] T006 Create `config/schemas/telegram.py` with `TelegramConfig(BaseModel)` (whisper_model: str, confidence_threshold: float, ack_message: str, max_message_length: int = 4096, poll_timeout_seconds: int = 30); add `telegram: TelegramConfig` to `AllConfigs` in `apps/api-service/src/api/lib/config.py` and load `config/runtime/telegram.yaml` in `load_all_configs()`; add an inline comment in `config.py` noting API startup now requires `telegram.yaml` to be present (fail-fast by design)
- [ ] T007 Create `apps/telegram-bot/src/telegram_bot/message_utils.py` with `split_long_message(text: str, limit: int = 4096) -> list[str]` — splits on newline boundaries where possible; never splits in the middle of a word
- [ ] T008 Populate `apps/telegram-bot/tests/conftest.py` with: `make_update(text: str, user_id: int, chat_id: int) -> Update` fixture that builds a PTB `Update` from a dict, `mock_bot` fixture (AsyncMock with `send_message` stubbed), `mock_api_client` respx fixture returning mock operator JSON for registered user IDs and 404 for unknown user IDs

---

## Phase 3: User Story 1 — Text Query → Mission

**Goal**: Registered operator sends text → bot authenticates → creates mission → sends ack.

**Independent test**: `make_update(text="analyze AAPL", user_id=12345)` → respx returns operator JSON → respx returns `{"mission_id": "..."}` from POST /missions → `mock_bot.send_message` called with ack text.

- [ ] T009 [US1] Create `apps/telegram-bot/src/telegram_bot/auth.py` with `async def authenticate_operator(telegram_user_id: int, api_base_url: str, service_token: str) -> Operator | None`: `GET {api_base_url}/operators?telegram_user_id={id}` with Bearer service JWT; returns deserialized `Operator` on 200, `None` on 404; on first-contact also sends `PATCH /operators/{id}` with `telegram_chat_id`
- [ ] T010 [US1] Create `apps/telegram-bot/src/telegram_bot/handlers/messages.py` with `async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None`: call `authenticate_operator()`, send "Access denied" if None, otherwise `POST {api_base_url}/missions` with `{"query": update.message.text}`, send ack message from config
- [ ] T011 [US1] Create `apps/telegram-bot/tests/test_auth.py` with 3 tests: (1) registered user ID → respx 200 → returns `Operator`, (2) unregistered user ID → respx 404 → returns `None`, (3) API unreachable → `httpx.ConnectError` raised → returns `None` (fail-safe)
- [ ] T012 [US1] Create `apps/telegram-bot/tests/test_messages.py` with 3 tests: (1) registered operator text → mission POST called → ack sent, (2) unregistered user → "Access denied" sent → no mission POST, (3) API returns error → error message sent to operator

---

## Phase 4: User Story 2 — Voice Message → Whisper → Mission

**Goal**: Registered operator sends OGG voice message → bot downloads → transcribes via Whisper → processes as text query.

**Independent test**: inject mock `Voice` update with fake OGG bytes → respx returns `{"text": "analyze NVDA"}` from Whisper → mission POST called with query "analyze NVDA" → ack sent.

- [ ] T013 [US2] Create `apps/telegram-bot/src/telegram_bot/handlers/voice.py` with `async def handle_voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None`: authenticate operator (deny if None), download OGG bytes via `await file.download_to_memory()`, POST bytes to `https://api.openai.com/v1/audio/transcriptions` via `httpx.AsyncClient`, extract `text` from response; if confidence field present and below `confidence_threshold` → ask operator to clarify; if httpx error → send "Voice transcription unavailable, please resend as text"; otherwise dispatch as text mission
- [ ] T014 [US2] Create `apps/telegram-bot/tests/test_voice.py` with 4 tests: (1) valid OGG → respx Whisper returns transcription → mission created, (2) unregistered user voice → "Access denied", (3) Whisper returns 503 → operator notified to resend as text, (4) short voice with high confidence → processed without clarification request

---

## Phase 5: User Story 3 — Slash Commands

**Goal**: Operator uses `/watchlist`, `/missions`, `/brief`, `/alert acknowledge [id]` commands.

**Independent test**: each command handler called with mock update → correct API endpoint called → formatted response sent to operator chat.

- [ ] T015 [US3] Create `apps/telegram-bot/src/telegram_bot/handlers/commands.py` with handlers for:
  - `handle_watchlist`: authenticate → `GET /watchlist` → format as numbered list → send
  - `handle_missions`: authenticate → `GET /missions?limit=10` → format with status emoji → send
  - `handle_brief`: authenticate → `POST /missions {"query": "daily brief"}` → send ack
  - `handle_alert_acknowledge`: authenticate + require admin role → `PATCH /alerts/{id} {"acknowledged": true}` → send confirmation
  - `handle_help`: always accessible → send list of available commands
- [ ] T016 [US3] Create `apps/telegram-bot/tests/test_commands.py` with 5 tests: (1) `/watchlist` → formats items list, (2) `/missions` → formats with status indicators, (3) `/brief` → dispatches mission, (4) `/alert acknowledge abc123` → PATCH called + confirmation sent, (5) non-admin calling `/alert acknowledge` → "Permission denied" sent

---

## Phase 6: User Story 4 — Proactive Alert Delivery

**Goal**: `deliver_to_telegram` Celery task sends mission results to operator without operator prompting.

**Independent test**: `deliver_to_telegram.apply(args=[chat_id, long_text])` with always_eager → `bot.send_message` called for each chunk split from `long_text`.

- [ ] T017 [US4] Create `apps/telegram-bot/src/telegram_bot/notifier.py` with:
  - `celery_app = Celery("telegram_bot", broker=os.environ["REDIS_URL"], backend=os.environ["REDIS_URL"])`
  - `@celery_app.task(bind=True, autoretry_for=(Exception,), max_retries=3, default_retry_delay=5)` `deliver_to_telegram(self, chat_id: str, text: str) -> None`: split text via `split_long_message()`, call `bot.send_message(chat_id=chat_id, text=chunk)` for each chunk; bot instance initialized from `TELEGRAM_BOT_TOKEN` env var
- [ ] T018 [US4] Create `apps/telegram-bot/tests/test_notifier.py` with 3 tests: (1) short text → single `send_message` call, (2) text > 4096 chars → multiple `send_message` calls (one per chunk), (3) `send_message` raises error → task retries (verify retry called)

---

## Phase 7: Application Entry Point

- [ ] T019 Create `apps/telegram-bot/src/telegram_bot/main.py` with: load `TelegramConfig` via `load_all_configs()` at module level with `sys.exit(1)` on validation failure; `ApplicationBuilder().token(os.environ["TELEGRAM_BOT_TOKEN"]).build()`; register `MessageHandler(filters.TEXT, handle_text_message)`, `MessageHandler(filters.VOICE, handle_voice_message)`, `CommandHandler` for each slash command; `application.run_polling(timeout=config.telegram.poll_timeout_seconds)`
- [ ] T020 Extend `docker-compose.yml` (root level) to add two new services: `telegram-bot` (command: `python -m telegram_bot.main`) and `telegram-worker` (command: `celery -A telegram_bot.notifier worker -Q telegram`); both use same base image as `api`; add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_SERVICE_TOKEN` to service env

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T021 Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_SERVICE_TOKEN` to `.env.example` with placeholder values and comments
- [ ] T022 Add `OPENAI_WHISPER_API_KEY` (or reuse `OPENAI_API_KEY`) to `.env.example` with comment `# Used by telegram-bot for voice transcription via Whisper API`
- [ ] T023 Export `deliver_to_telegram`, `celery_app` from `apps/telegram-bot/src/telegram_bot/notifier.py` module `__all__`
- [ ] T024 Export `authenticate_operator` from `apps/telegram-bot/src/telegram_bot/auth.py` module `__all__`
- [ ] T025 Export all handler functions from `apps/telegram-bot/src/telegram_bot/handlers/__init__.py`
- [ ] T026 Run `uv run mypy --strict apps/telegram-bot/src/` — zero errors required
- [ ] T027 Run `uv run ruff check apps/telegram-bot/src/` — zero warnings required
- [ ] T028 Run `uv run pytest apps/telegram-bot/tests/ -v` — all tests must pass offline without network access
- [ ] T029 Verify `split_long_message` edge cases: empty string → `[""]`, text exactly 4096 chars → single chunk, text 4097 chars → two chunks
- [ ] T030 Verify Celery task name resolves correctly: `deliver_to_telegram.name == "telegram_bot.notifier.deliver_to_telegram"` (add as assert in test_notifier.py)

---

## Dependency Graph

```
Phase 1 (T001–T004) → Phase 2 (T005–T008) → Phase 3 US1 (T009–T012)
                                           → Phase 4 US2 (T013–T014)  [after Phase 2]
                                           → Phase 5 US3 (T015–T016)  [after Phase 3]
                                           → Phase 6 US4 (T017–T018)  [after Phase 2]
Phase 3 + Phase 4 + Phase 5 + Phase 6 → Phase 7 (T019–T020) → Phase 8 (T021–T030)
```

**External dependencies (must be complete before starting this feature)**:
- Feature 002: `Operator` domain model with `telegram_user_id` + `telegram_chat_id` fields
- Feature 003: service JWT (`TELEGRAM_SERVICE_TOKEN`), `/operators` API endpoints
- Feature 008: `/missions` POST endpoint, `deliver_to_telegram` dispatch from mission_worker

---

## Parallel Execution Opportunities

- T001–T004 can all run in parallel (independent setup tasks)
- T011 (test_auth.py) can run in parallel with T013 (voice.py) after T009 is done
- T015 (commands.py) and T017 (notifier.py) can run in parallel after Phase 2

---

## Implementation Strategy

**MVP scope** (US1 + US4): Implement T001–T012, T017–T020. This delivers text query handling + proactive delivery — covering the two most critical P1 stories. US2 (voice) and US3 (commands) follow.

**Incremental delivery**:
1. T001–T008: Package scaffolded, config loaded, test fixtures ready
2. T009–T012: Auth + text handler working end-to-end with mocked API
3. T017–T018: Proactive notifier Celery task ready (enables Feature 008 integration)
4. T013–T014: Voice transcription added
5. T015–T016: Slash commands added
6. T019–T030: Entry point wired up, docker-compose extended, quality gate
