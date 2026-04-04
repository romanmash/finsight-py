# Quickstart: Telegram Bot & Voice (009)

## Prerequisites

- Features 001-008 implemented
- `.env` includes `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SERVICE_TOKEN`, `OPENAI_API_KEY`
- At least one active operator with `telegram_user_id` in the database

## Run Locally

```bash
# API + infra
docker compose up -d postgres redis api

# Telegram bot runtime
uv run python -m telegram_bot.main

# Telegram queue worker (proactive delivery)
uv run celery -A telegram_bot.notifier worker -Q telegram
```

## Validate Main Flows

1. Send plain text to bot -> receive ack -> mission created.
2. Send voice message -> transcription path runs -> mission created.
3. Send `/missions` -> recent mission statuses returned.
4. Send `/brief` -> brief mission request acknowledged.
5. Trigger mission completion in API worker -> Telegram notifier sends proactive message.

## Test Offline

```bash
uv run pytest apps/telegram-bot/tests -v
uv run mypy --strict apps/telegram-bot/src
uv run ruff check apps/telegram-bot/src apps/telegram-bot/tests
```
