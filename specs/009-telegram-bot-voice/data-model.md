# Data Model: Telegram Bot & Voice (009)

## Operator (existing from 002/008, reused by 009)

**Type**: SQLAlchemy ORM + API route serialization
**Location**: `apps/api-service/src/api/db/models/operator.py`

Relevant fields:
| Field | Python Type | Description |
|-------|-------------|-------------|
| id | UUID | Operator identifier |
| telegram_user_id | int \| None | Stable Telegram user identity used for auth |
| telegram_chat_id | int \| None | Chat destination bound on first successful contact |
| role | str | RBAC role used by API auth |
| is_active | bool | Inactive operators are denied |

## Telegram Runtime Config (009-owned)

**Type**: Pydantic config model in telegram-bot package
**Location**: `apps/telegram-bot/src/telegram_bot/config.py`
**Source file**: `config/runtime/telegram.yaml`

| Field Group | Purpose |
|-------------|---------|
| `rateLimitPerUserPerMinute` | Input throttling |
| `commandBehavior.enabledCommands` | Enable/disable command handlers |
| `responseMessages.*` | User-facing bot responses |
| `delivery.messageMaxLength` | Telegram chunking limit |
| `delivery.proactivePrimaryChatId` (optional) | Proactive push destination |
| `performance.acknowledgmentP95Ms` | Operational target |

## Mission Payload Contract (from 008)

**Producer**: `apps/api-service/src/api/workers/mission_worker.py`
**Consumer**: `apps/telegram-bot/src/telegram_bot/notifier.py`

Task name: `telegram_bot.notifier.deliver_to_telegram`

Task args:
1. `mission_id: str`
2. `formatted_payload: dict[str, object]` (serialized `FormattedReport` when available)

## BotCommand Registry (009 scope)

| Command | Handler | Auth Requirement |
|---------|---------|------------------|
| /missions | `handle_missions` | Registered operator |
| /brief | `handle_brief` | Registered operator |
| /help | `handle_help` | None |

## VoiceMessage Processing Flow

```text
PTB receives voice update
  -> authenticate operator
  -> download voice bytes
  -> transcribe via HTTP API
  -> POST /missions with transcription text
  -> send acknowledgement message
```
