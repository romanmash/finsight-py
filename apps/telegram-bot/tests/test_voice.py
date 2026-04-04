from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from telegram.error import TelegramError
from telegram_bot.auth import OperatorLookupError
from telegram_bot.handlers import voice


def test_extract_confidence_from_direct_value() -> None:
    confidence = voice._extract_confidence({"confidence": 0.81})
    assert confidence == pytest.approx(0.81)


def test_extract_confidence_from_segments_avg_logprob() -> None:
    confidence = voice._extract_confidence(
        {
            "segments": [
                {"avg_logprob": -0.1},
                {"avg_logprob": -0.2},
            ]
        }
    )
    assert confidence is not None
    assert confidence > 0.8


@pytest.mark.asyncio()
async def test_voice_message_transcribes_and_dispatches(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(voice=True)

    monkeypatch.setattr(
        voice,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    monkeypatch.setattr(voice, "create_mission", AsyncMock(return_value="mission-voice"))
    monkeypatch.setattr(voice, "_transcribe_voice", AsyncMock(return_value=("analyze NVDA", 0.99)))

    file_obj = AsyncMock()
    file_obj.download_as_bytearray = AsyncMock(return_value=bytearray(b"ogg-bytes"))
    dummy_context.bot.get_file = AsyncMock(return_value=file_obj)

    await voice.handle_voice_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Processing" in text


@pytest.mark.asyncio()
async def test_voice_message_lookup_error_temporary_unavailable(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(voice=True)

    monkeypatch.setattr(
        voice,
        "authenticate_operator",
        AsyncMock(side_effect=OperatorLookupError("lookup failed")),
    )

    await voice.handle_voice_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Temporary unavailable" in text


@pytest.mark.asyncio()
async def test_voice_message_unregistered_denied(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(voice=True)

    monkeypatch.setattr(voice, "authenticate_operator", AsyncMock(return_value=None))

    await voice.handle_voice_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Access denied" in text


@pytest.mark.asyncio()
async def test_voice_message_telegram_file_error_requests_text_resend(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(voice=True)

    monkeypatch.setattr(
        voice,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    dummy_context.bot.get_file = AsyncMock(side_effect=TelegramError("telegram down"))

    await voice.handle_voice_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Voice transcription unavailable" in text


@pytest.mark.asyncio()
async def test_voice_message_transcription_failure_requests_text_resend(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(voice=True)

    monkeypatch.setattr(
        voice,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    monkeypatch.setattr(voice, "_transcribe_voice", AsyncMock(return_value=(None, None)))

    file_obj = AsyncMock()
    file_obj.download_as_bytearray = AsyncMock(return_value=bytearray(b"ogg-bytes"))
    dummy_context.bot.get_file = AsyncMock(return_value=file_obj)

    await voice.handle_voice_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Voice transcription unavailable" in text
