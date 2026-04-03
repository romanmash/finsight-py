# Research: Telegram Bot & Voice (009)

## python-telegram-bot version

**Chosen**: python-telegram-bot v20 (async)
**Rationale**: v20 is the current stable async release; uses asyncio natively; well-documented; supports long-polling and webhook modes; ApplicationBuilder pattern simplifies startup.
**Alternatives considered**: aiogram (also async; less documentation); Telethon (MTProto level, overkill); v13 (sync, deprecated)

## Voice transcription service

**Chosen**: OpenAI Whisper API (`openai.audio.transcriptions.create`)
**Rationale**: Best-in-class transcription quality; OpenAI client already used for LLM calls; returns transcription as plain text; configurable model (whisper-1 default).
**Alternatives considered**: Local Whisper (high compute cost on server, slow on CPU); Google STT (extra dependency); Azure STT (extra dependency)

## Audio format handling

**Chosen**: Download Telegram OGG voice file via `bot.get_file()` → `file.download_to_memory()` → pass bytes directly to Whisper API (supports ogg/opus)
**Rationale**: In-memory download avoids disk I/O; Whisper API accepts ogg natively; no ffmpeg conversion needed.
**Alternatives considered**: Download to disk + convert (added complexity, disk I/O), pydub conversion (extra dependency)

## Operator authentication strategy

**Chosen**: Match `update.effective_user.id` (Telegram numeric user ID) against `operators.telegram_user_id` DB column. Rejected if no matching row or operator is inactive.
**Rationale**: Telegram user IDs are stable and unique; matching against DB ensures only explicitly registered operators can use the bot; no password/token exchange needed.
**Alternatives considered**: Telegram username matching (usernames can change), shared secret (less convenient)

## Proactive delivery mechanism

**Chosen**: Celery task `deliver_notification(operator_id, message)` dispatched by mission_worker when mission completes. Task calls `bot.send_message(chat_id=operator.telegram_chat_id, text=message)`.
**Rationale**: Decoupled from mission execution; Celery retry handles transient Telegram API failures; `telegram_chat_id` stored in DB after first operator message.
**Alternatives considered**: Direct async call from mission_worker (tight coupling), webhook from API to bot (extra HTTP hop)

## Long message handling

**Chosen**: Split messages at 4096 character Telegram limit by splitting at last newline before limit; send as multiple messages sequentially.
**Rationale**: Telegram's hard limit is 4096 chars; splitting at newlines preserves readability.
**Alternatives considered**: Truncate (loses content), send as document/file (less readable)

## Offline test strategy

**Chosen**: Construct `telegram.Update` objects from fixture dicts; use `ApplicationHandlerStop` + `MagicMock` for bot methods; mock OpenAI Whisper API with respx.
**Rationale**: PTB v20 Update objects can be constructed from dicts; bot.send_message is mockable; Whisper API is HTTP (respx-mockable).
**Alternatives considered**: Real Telegram API in tests (requires network), PTB test framework (less standard)
