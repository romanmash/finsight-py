# Research: Telegram Bot & Voice (009)

## python-telegram-bot version

**Chosen**: python-telegram-bot v20 (async)
**Rationale**: stable asyncio-first runtime; supports long-polling and clear handler model.

## Voice transcription transport

**Chosen**: `httpx.AsyncClient` to OpenAI transcription endpoint
**Rationale**: easy offline mocking with `respx`; no SDK lock-in for tests.

## Operator authentication strategy

**Chosen**: `update.effective_user.id` matched via existing API route:
`GET /operators?telegram_user_id={id}`.
**Rationale**: stable Telegram identity, no new auth surface.

## Chat binding strategy

**Chosen**: on successful auth, synchronize `telegram_chat_id` via
`PATCH /operators/{operator_id}` when needed.
**Rationale**: keeps proactive destination in existing operator record.

## Proactive delivery contract

**Chosen**: keep the already-implemented 008 task dispatch contract:
`deliver_to_telegram(mission_id, formatted_payload)`.
**Rationale**: avoids breaking 008 worker behavior and tests.

## Command scope for 009

**Chosen**: `/missions`, `/brief`, `/help`.
**Rationale**: these map to routes that already exist after 008; `/watchlist` and alert-ack
require API routes not yet implemented.

## Long message handling

**Chosen**: notifier chunks long output before Telegram send.
**Rationale**: avoids Telegram API rejections; complements upstream report formatting constraints.

## Offline testing strategy

**Chosen**: build PTB `Update` objects in fixtures, mock `send_message`, mock all HTTP calls with
`respx`.
**Rationale**: constitution-compliant offline tests with deterministic behavior.
