"""Slash-command handlers for telegram-bot."""

from __future__ import annotations

import httpx
from telegram import Update
from telegram.ext import ContextTypes

from telegram_bot.api_client import create_mission, list_missions
from telegram_bot.auth import OperatorLookupError, authenticate_operator
from telegram_bot.runtime import get_runtime, is_rate_limited, should_process_update


def _format_missions(rows: list[dict[str, object]]) -> str:
    if not rows:
        return "No missions found."

    lines = ["Recent missions:"]
    for row in rows:
        mission_id = str(row.get("mission_id", "-"))
        status = str(row.get("status", "unknown"))
        query = str(row.get("query", ""))
        short_id = mission_id[:8] if mission_id != "-" else "-"
        lines.append(f"- {status}: {query} ({short_id})")
    return "\n".join(lines)


async def _authenticate(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    message = update.effective_message
    user = update.effective_user
    if message is None or user is None:
        return False

    runtime = get_runtime(context)
    cfg = runtime.config

    if is_rate_limited(context, user.id, cfg.rate_limit_per_user_per_minute):
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.throttled,
        )
        return False

    try:
        operator = await authenticate_operator(
            telegram_user_id=user.id,
            chat_id=message.chat_id,
            api_base_url=runtime.api_base_url,
            service_token=runtime.service_token,
        )
    except OperatorLookupError:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.temporary_unavailable,
        )
        return False

    if operator is None:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.unauthorized,
        )
        return False
    return True


async def handle_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Return supported command list."""
    if not should_process_update(context, update.update_id):
        return

    message = update.effective_message
    if message is None:
        return

    help_text = (
        "Available commands:\n"
        "/missions - list recent missions\n"
        "/brief - request daily brief\n"
        "/help - show this help"
    )
    await context.bot.send_message(chat_id=message.chat_id, text=help_text)


async def handle_missions(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Return recent missions for authenticated operator."""
    if not should_process_update(context, update.update_id):
        return

    message = update.effective_message
    if message is None:
        return

    runtime = get_runtime(context)
    cfg = runtime.config
    if not cfg.command_behavior.enabled_commands.missions:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.validation_error,
        )
        return

    if not await _authenticate(update, context):
        return

    try:
        rows = await list_missions(
            api_base_url=runtime.api_base_url,
            service_token=runtime.service_token,
            limit=10,
        )
    except httpx.HTTPError:
        rows = None

    if rows is None:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.temporary_unavailable,
        )
        return

    await context.bot.send_message(chat_id=message.chat_id, text=_format_missions(rows))


async def handle_brief(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Dispatch a brief mission request."""
    if not should_process_update(context, update.update_id):
        return

    message = update.effective_message
    if message is None:
        return

    runtime = get_runtime(context)
    cfg = runtime.config
    if not cfg.command_behavior.enabled_commands.brief:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.validation_error,
        )
        return

    if not await _authenticate(update, context):
        return

    try:
        mission_id = await create_mission(
            api_base_url=runtime.api_base_url,
            service_token=runtime.service_token,
            query="daily brief",
        )
    except httpx.HTTPError:
        mission_id = None

    if mission_id is None:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.temporary_unavailable,
        )
        return

    await context.bot.send_message(
        chat_id=message.chat_id,
        text=cfg.response_messages.processing_ack,
    )
