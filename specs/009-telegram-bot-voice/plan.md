# Implementation Plan: Telegram Bot & Voice

**Branch**: `009-telegram-bot-voice` | **Date**: 2026-04-04 | **Spec**: [spec.md](spec.md)

## Summary

Implement the async Telegram bot runtime (python-telegram-bot v20) with operator authentication
through existing API routes, text and voice query handling, mission dispatch via `/missions`, and
proactive Telegram delivery via the existing 008 Celery task contract
`telegram_bot.notifier.deliver_to_telegram(mission_id, formatted_payload)`.

## Technical Context

**Language/Version**: Python 3.13
**Primary Dependencies**: python-telegram-bot[ext]>=20.7, httpx, structlog, celery[redis]>=5.3
**Storage**: PostgreSQL via API-service routes (operators + missions), Redis for Telegram queue worker
**Testing**: pytest + pytest-asyncio + respx + unittest.mock (offline)
**Target Platform**: Linux server (Docker) — telegram-bot + telegram-worker containers
**Project Type**: Standalone async Python app (`apps/telegram-bot`)
**Performance Goals**: Text ack < 3 s; voice transcription + ack < 10 s; proactive delivery < 30 s
**Constraints**: mypy --strict; offline tests; no real Telegram/OpenAI calls in tests
**Scale/Scope**: Single-operator deployment (primary operator chat for proactive pushes)

## Constitution Check

- [x] Everything-as-Code — bot behavior in `config/runtime/telegram.yaml`; no hardcoded thresholds
- [x] Agent Boundaries — bot dispatches missions; does not call agents directly
- [x] MCP Server Independence — bot talks to API routes only
- [x] Cost Observability — no LLM calls in bot; voice transcription is external HTTP
- [x] Fail-Safe Defaults — auth failures rejected, transcription failures message operator
- [x] Test-First — handlers and notifier tested offline with mocked PTB/httpx
- [x] Simplicity Over Cleverness — long-polling runtime + dedicated Telegram queue worker

## Project Structure

### Source Code

```text
apps/telegram-bot/
├── pyproject.toml
├── src/telegram_bot/
│   ├── __init__.py
│   ├── main.py                  # app bootstrap + handler registration + polling
│   ├── config.py                # telegram runtime config loader (fail-fast)
│   ├── auth.py                  # authenticate_operator() against API service
│   ├── notifier.py              # Celery task: mission payload -> Telegram delivery
│   ├── message_utils.py         # split_long_message()
│   └── handlers/
│       ├── __init__.py
│       ├── commands.py          # /missions, /brief, /help
│       ├── messages.py          # free-text -> mission dispatch
│       └── voice.py             # voice -> transcription -> mission dispatch
└── tests/
    ├── conftest.py
    ├── test_auth.py
    ├── test_messages.py
    ├── test_voice.py
    ├── test_commands.py
    └── test_notifier.py
```

## Implementation Phases

### Phase 1: Package + Runtime Config

**Files**: `apps/telegram-bot/pyproject.toml`, `apps/telegram-bot/src/telegram_bot/config.py`,
`config/runtime/telegram.yaml`

**Key decisions**:
- Keep telegram config ownership in telegram-bot package, not API `AllConfigs`
- Validate config on bot startup and exit fast with explicit error path
- Keep environment secrets in `.env` only (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_SERVICE_TOKEN`,
  `OPENAI_API_KEY`, optional proactive fallback chat id)

### Phase 2: Authentication + Text Handling

**Files**: `auth.py`, `handlers/messages.py`

**Key decisions**:
- `authenticate_operator(telegram_user_id)` calls existing API route
  `GET /operators?telegram_user_id={id}`
- First contact updates `telegram_chat_id` through existing `PATCH /operators/{operator_id}`
- Text handler posts to existing `POST /missions` and sends ack message

### Phase 3: Voice Handling

**Files**: `handlers/voice.py`

**Key decisions**:
- Download Telegram voice bytes in-memory
- Transcribe with `httpx.AsyncClient` to OpenAI transcription endpoint for respx-friendly tests
- If transcription fails, operator gets explicit fallback prompt to resend as text

### Phase 4: Command Handlers

**Files**: `handlers/commands.py`

**Key decisions**:
- Scope commands to API routes that already exist after 008:
  - `/missions` -> `GET /missions?limit=10`
  - `/brief` -> `POST /missions` with brief query
  - `/help` -> static command list
- Defer watchlist/alert-ack commands to a future feature once routes exist

### Phase 5: Proactive Delivery Worker

**Files**: `notifier.py`, `message_utils.py`

**Key decisions**:
- Keep 008 dispatch contract: task signature
  `deliver_to_telegram(mission_id: str, formatted_payload: dict[str, object])`
- Build outgoing text from payload fields (`title`, `full_text`, `ticker`, `mission_id`)
- Resolve destination chat with single-operator strategy:
  primary chat id from runtime config/env fallback for proactive push flows
- Retry Telegram send failures via Celery autoretry

### Phase 6: Entry Point + Compose Wiring

**Files**: `main.py`, `docker-compose.yml`

**Key decisions**:
- Register handlers for text, voice, and supported commands
- Run polling with timeout from telegram runtime config
- Add `telegram-bot` service and `telegram-worker` service consuming `telegram` queue

### Phase 7: Tests + Quality Gates

**Files**: `apps/telegram-bot/tests/*`

**Key decisions**:
- Offline tests only; mock Telegram and HTTP dependencies
- Validate notifier contract name equals
  `"telegram_bot.notifier.deliver_to_telegram"`
- Run `ruff`, `mypy --strict`, and `pytest` for telegram-bot package before completion

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API coupling | HTTP route calls only | Preserves service boundary |
| Notifier contract | Keep `mission_id + payload` from 008 | Avoids breaking completed 008 behavior |
| Command scope | `/missions`, `/brief`, `/help` | Matches currently implemented routes |
| Message length | chunk before sending | Avoid Telegram API failures |
| Proactive target | single primary operator chat | Aligns with single-user deployment assumption |

## Dependencies

- **Requires**: 001-008 completed (notably 008 mission worker dispatch to telegram queue)
- **Required by**: 010-operator-dashboard, 011-seed-infrastructure
