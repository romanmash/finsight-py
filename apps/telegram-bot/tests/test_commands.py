from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from telegram_bot.auth import OperatorLookupError
from telegram_bot.handlers import commands


@pytest.mark.asyncio()
async def test_missions_command_formats_items(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="missions", is_command=True)

    monkeypatch.setattr(
        commands,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    monkeypatch.setattr(
        commands,
        "list_missions",
        AsyncMock(
            return_value=[
                {"mission_id": "abc12345-aaaa", "status": "completed", "query": "analyze TSLA"}
            ]
        ),
    )

    await commands.handle_missions(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Recent missions" in text
    assert "completed" in text


@pytest.mark.asyncio()
async def test_brief_command_dispatches_mission(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="brief", is_command=True)

    monkeypatch.setattr(
        commands,
        "authenticate_operator",
        AsyncMock(return_value=SimpleNamespace(operator_id="abc")),
    )
    create = AsyncMock(return_value="mission-brief")
    monkeypatch.setattr(commands, "create_mission", create)

    await commands.handle_brief(update, dummy_context)

    create.assert_awaited_once()
    dummy_context.bot.send_message.assert_called_once()


@pytest.mark.asyncio()
async def test_help_command_is_public(
    dummy_context: object,
    make_update_fixture: object,
) -> None:
    update = make_update_fixture(text="help", is_command=True)

    await commands.handle_help(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "/missions" in text


@pytest.mark.asyncio()
async def test_missions_command_lookup_error_temporary_unavailable(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="missions", is_command=True)

    monkeypatch.setattr(
        commands,
        "authenticate_operator",
        AsyncMock(side_effect=OperatorLookupError("lookup failed")),
    )

    await commands.handle_missions(update, dummy_context)

    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Temporary unavailable" in text


@pytest.mark.asyncio()
async def test_missions_command_unauthorized(
    dummy_context: object,
    make_update_fixture: object,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    update = make_update_fixture(text="missions", is_command=True)

    monkeypatch.setattr(commands, "authenticate_operator", AsyncMock(return_value=None))
    list_calls = AsyncMock(return_value=[])
    monkeypatch.setattr(commands, "list_missions", list_calls)

    await commands.handle_missions(update, dummy_context)

    list_calls.assert_not_awaited()
    dummy_context.bot.send_message.assert_called_once()
    text = dummy_context.bot.send_message.call_args.kwargs["text"]
    assert "Access denied" in text
