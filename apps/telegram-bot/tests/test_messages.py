from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from telegram_bot.auth import OperatorLookupError
from telegram_bot.handlers import messages


@pytest.mark.asyncio()
async def test_text_message_registered_dispatches_and_acks(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="analyze AAPL")

    monkeypatch.setattr(
        messages,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    monkeypatch.setattr(messages, "create_mission", AsyncMock(return_value="mission-1"))

    await messages.handle_text_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    sent_text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Processing" in sent_text


@pytest.mark.asyncio()
async def test_text_message_unregistered_denied(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="analyze AAPL")

    monkeypatch.setattr(messages, "authenticate_operator", AsyncMock(return_value=None))
    create = AsyncMock(return_value="mission-1")
    monkeypatch.setattr(messages, "create_mission", create)

    await messages.handle_text_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    sent_text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Access denied" in sent_text
    create.assert_not_awaited()


@pytest.mark.asyncio()
async def test_text_message_operator_lookup_error_temporary_unavailable(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="analyze AAPL")

    monkeypatch.setattr(
        messages,
        "authenticate_operator",
        AsyncMock(side_effect=OperatorLookupError("lookup failed")),
    )

    await messages.handle_text_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    sent_text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Temporary unavailable" in sent_text


@pytest.mark.asyncio()
async def test_text_message_api_failure_returns_temporarily_unavailable(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="analyze AAPL")

    monkeypatch.setattr(
        messages,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    monkeypatch.setattr(messages, "create_mission", AsyncMock(return_value=None))

    await messages.handle_text_message(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    sent_text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Temporary unavailable" in sent_text


@pytest.mark.asyncio()
async def test_text_message_duplicate_update_is_ignored(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="analyze AAPL")

    monkeypatch.setattr(
        messages,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    create = AsyncMock(return_value="mission-1")
    monkeypatch.setattr(messages, "create_mission", create)

    await messages.handle_text_message(update, dummy_context)
    await messages.handle_text_message(update, dummy_context)

    assert create.await_count == 1
    assert dummy_context.bot.send_message.await_count == 1
