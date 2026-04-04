# Data Model: Telegram Bot & Voice (009)

## Operator (additions for Telegram)

**Type**: SQLAlchemy ORM + Pydantic domain model additions
**Location**: `apps/api-service/src/api/db/models/operator.py` (extend Feature 002)

New fields added to Operator:
| Field | Python Type | Description |
|-------|-------------|-------------|
| telegram_user_id | int \| None | Telegram numeric user ID (set on first message) |
| telegram_chat_id | int \| None | Telegram chat ID for proactive delivery |
| telegram_username | str \| None | For display only; not used for auth |

---

## TelegramConfig (YAML-backed)

**Type**: Pydantic v2 BaseSettings
**Location**: `config/schemas/telegram.py`

| Field | Python Type | Default | Description |
|-------|-------------|---------|-------------|
| whisper_model | str | "whisper-1" | OpenAI Whisper model name |
| transcription_confidence_threshold | float | 0.7 | Below this → ask to clarify |
| max_message_length | int | 4096 | Telegram message limit |
| long_poll_timeout | int | 30 | Long-polling timeout in seconds |
| mission_ack_message | str | "Processing your request..." | Default ack message |

---

## BotCommand registry

**Type**: List of CommandHandler registrations in main.py

| Command | Handler | Required Role |
|---------|---------|---------------|
| /watchlist | `handle_watchlist` | viewer |
| /missions | `handle_missions` | viewer |
| /brief | `handle_brief` | viewer |
| /alert acknowledge {id} | `handle_alert_ack` | admin |
| /help | `handle_help` | viewer |

---

## VoiceMessage processing flow

```
PTB receives Update with voice
  → handler downloads OGG bytes
  → POST to OpenAI Whisper API (httpx)
  → receive transcription text
  → dispatch as text query to mission system
  → send ack to operator
```

No persistent model — voice is a transient processing step only.
