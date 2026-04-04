"""telegram-bot test fixtures."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock

import pytest
from telegram import Bot, Update
from telegram_bot.config import TelegramRuntimeConfig
from telegram_bot.runtime import RuntimeContext


@dataclass
class DummyApplication:
    bot_data: dict[str, object]


@dataclass
class DummyContext:
    bot: AsyncMock
    application: DummyApplication


@pytest.fixture()
def runtime_config() -> TelegramRuntimeConfig:
    return TelegramRuntimeConfig.model_validate(
        {
            "rateLimitPerUserPerMinute": 10,
            "commandBehavior": {
                "allowFreeTextOperatorQuery": True,
                "enabledCommands": {"missions": True, "brief": True, "help": True},
            },
            "responseMessages": {
                "unauthorized": "Access denied",
                "throttled": "Rate limit",
                "validationError": "Validation error",
                "temporaryUnavailable": "Temporary unavailable",
                "internalFailure": "Internal failure",
                "processingAck": "Processing your request...",
                "transcriptionUnavailable": (
                    "Voice transcription unavailable, " + "please resend as text"
                ),
                "lowConfidence": "Please clarify your voice message.",
            },
            "delivery": {
                "messageMaxLength": 4096,
                "gracefulShutdownMs": 10000,
                "proactivePrimaryChatId": 999,
                "pollTimeoutSeconds": 30,
            },
            "voice": {"transcriptionModel": "whisper-1", "confidenceThreshold": 0.6},
            "performance": {"acknowledgmentP95Ms": 3000},
        }
    )


@pytest.fixture()
def runtime(runtime_config: TelegramRuntimeConfig) -> RuntimeContext:
    return RuntimeContext(
        config=runtime_config,
        api_base_url="http://api.test",
        service_token="service-token",
        openai_api_key="openai-key",
    )


@pytest.fixture()
def mock_bot() -> AsyncMock:
    bot = AsyncMock()
    bot.send_message = AsyncMock()
    bot.get_file = AsyncMock()
    return bot


@pytest.fixture()
def dummy_context(mock_bot: AsyncMock, runtime: RuntimeContext) -> DummyContext:
    return DummyContext(
        bot=mock_bot,
        application=DummyApplication(bot_data={"runtime": runtime}),
    )


def make_update(
    *,
    text: str | None = None,
    user_id: int = 12345,
    chat_id: int = 555,
    is_command: bool = False,
    voice: bool = False,
) -> Update:
    payload: dict[str, Any] = {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "date": 1710000000,
            "chat": {"id": chat_id, "type": "private"},
            "from": {"id": user_id, "is_bot": False, "first_name": "Tester"},
        },
    }

    if voice:
        payload["message"]["voice"] = {
            "file_id": "voice-file-id",
            "file_unique_id": "voice-unique",
            "duration": 1,
            "mime_type": "audio/ogg",
            "file_size": 10,
        }
    elif text is not None:
        payload["message"]["text"] = f"/{text}" if is_command else text

    return Update.de_json(payload, Bot("123456:TESTTOKEN"))


@pytest.fixture()
def make_update_fixture() -> Any:
    return make_update
