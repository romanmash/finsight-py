"""Handler for free-text Telegram messages."""

from __future__ import annotations

import httpx
from telegram import Update
from telegram.ext import ContextTypes

from telegram_bot.api_client import create_mission
from telegram_bot.auth import OperatorLookupError, authenticate_operator
from telegram_bot.runtime import get_runtime, is_rate_limited, should_process_update


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Authenticate sender and dispatch text query as a mission."""
    if not should_process_update(context, update.update_id):
        return

    message = update.effective_message
    user = update.effective_user
    if message is None or user is None:
        return

    runtime = get_runtime(context)
    cfg = runtime.config

    if is_rate_limited(context, user.id, cfg.rate_limit_per_user_per_minute):
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.throttled,
        )
        return

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
        return

    if operator is None:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.unauthorized,
        )
        return

    if not cfg.command_behavior.allow_free_text_operator_query:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.validation_error,
        )
        return

    if not isinstance(message.text, str) or not message.text.strip():
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.validation_error,
        )
        return

    try:
        mission_id = await create_mission(
            api_base_url=runtime.api_base_url,
            service_token=runtime.service_token,
            query=message.text.strip(),
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
