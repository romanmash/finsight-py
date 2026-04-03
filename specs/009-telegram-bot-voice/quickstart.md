# Quickstart: Telegram Bot & Voice (009)

## Prerequisites

- Features 001-008 complete
- `.env` with `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`
- Operator record in DB with your `telegram_user_id`

## Running

```bash
# Start backing services
docker compose up -d postgres redis api

# Run the bot (long-polling mode)
uv run python -m telegram_bot.main

# Or via docker compose
docker compose up -d telegram-bot
```

## Register your Telegram ID

```bash
# First message to the bot auto-registers telegram_user_id
# Or seed it manually via the seed script (Feature 011)
uv run python -m api.seeds.seed
```

## Testing (offline)

```bash
# All bot tests (no network, mocked PTB + Whisper)
uv run pytest apps/telegram-bot/tests/ -v

# Type check
uv run mypy apps/telegram-bot/src/ --strict
```

## Verifying

1. Send `/watchlist` to the bot → should return list of watchlist items
2. Send `/brief` → triggers daily brief mission
3. Send a voice message → should receive ack within 10 seconds
4. Message from an unregistered Telegram user → should receive "Access denied"
