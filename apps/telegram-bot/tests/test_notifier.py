from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from telegram_bot import notifier
from telegram_bot.config import TelegramRuntimeConfig


def test_deliver_to_telegram_task_name() -> None:
    assert notifier.deliver_to_telegram.name == "telegram_bot.notifier.deliver_to_telegram"


def test_resolve_chat_id_prefers_payload_aliases(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(notifier, "load_telegram_config", lambda: _config())
    monkeypatch.delenv("TELEGRAM_PRIMARY_CHAT_ID", raising=False)

    assert notifier._resolve_chat_id({"chat_id": 101}) == 101
    assert notifier._resolve_chat_id({"telegram_chat_id": 102}) == 102
    assert notifier._resolve_chat_id({"operator_chat_id": 103}) == 103


def test_deliver_to_telegram_sends_single_chunk(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:TESTTOKEN")

    monkeypatch.setattr(notifier, "load_telegram_config", lambda: _config())
    monkeypatch.setattr(notifier, "_resolve_chat_id", lambda payload: 999)

    sender = AsyncMock()
    monkeypatch.setattr(notifier, "_send_telegram_chunks", sender)

    notifier.deliver_to_telegram.run("mission-1", {"title": "Done", "full_text": "hello"})

    sender.assert_awaited_once()
    kwargs = sender.await_args.kwargs
    assert kwargs["chat_id"] == 999
    assert kwargs["chunks"] == ["[Done]\nMission: mission-1\n\nhello"]


def test_deliver_to_telegram_splits_long_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:TESTTOKEN")

    monkeypatch.setattr(notifier, "load_telegram_config", lambda: _config())
    monkeypatch.setattr(notifier, "_resolve_chat_id", lambda payload: 999)

    sender = AsyncMock()
    monkeypatch.setattr(notifier, "_send_telegram_chunks", sender)

    notifier.deliver_to_telegram.run("mission-1", {"full_text": "x" * 5000})

    sender.assert_awaited_once()
    chunks = sender.await_args.kwargs["chunks"]
    assert len(chunks) >= 2


def test_deliver_to_telegram_raises_when_chat_destination_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:TESTTOKEN")
    monkeypatch.setattr(notifier, "_resolve_chat_id", lambda payload: None)

    with pytest.raises(notifier.NoChatDestinationError):
        notifier.deliver_to_telegram.run("mission-1", {"full_text": "hello"})


def _config() -> TelegramRuntimeConfig:
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
