"""Celery task for proactive Telegram delivery."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import structlog
from celery import Celery  # type: ignore[import-untyped]
from telegram import Bot

from telegram_bot.config import load_telegram_config
from telegram_bot.message_utils import split_long_message

logger = structlog.get_logger(__name__)


class NoChatDestinationError(RuntimeError):
    """Raised when proactive delivery has no chat destination."""


celery_app = Celery(
    "telegram_bot",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
)


def _resolve_chat_id(payload: dict[str, object]) -> int | None:
    for key in ("chat_id", "telegram_chat_id", "operator_chat_id"):
        chat_value = payload.get(key)
        if isinstance(chat_value, int):
            return chat_value

    cfg = load_telegram_config()
    if cfg.delivery.proactive_primary_chat_id is not None:
        return cfg.delivery.proactive_primary_chat_id

    env_value = os.getenv("TELEGRAM_PRIMARY_CHAT_ID")
    if env_value is None:
        return None

    try:
        return int(env_value)
    except ValueError:
        return None


def _build_delivery_text(mission_id: str, payload: dict[str, object]) -> str:
    title = str(payload.get("title") or "Mission Result")
    full_text = str(payload.get("full_text") or "Mission completed.")
    ticker = payload.get("ticker")

    prefix = f"[{title}]"
    if isinstance(ticker, str) and ticker.strip():
        prefix = f"{prefix} {ticker.strip()}"

    return f"{prefix}\nMission: {mission_id}\n\n{full_text}"


async def _send_telegram_chunks(*, token: str, chat_id: int, chunks: list[str]) -> None:
    bot = Bot(token=token)
    await bot.initialize()
    try:
        for chunk in chunks:
            await bot.send_message(chat_id=chat_id, text=chunk)
    finally:
        await bot.shutdown()


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    dont_autoretry_for=(NoChatDestinationError,),
    max_retries=3,
    default_retry_delay=5,
    name="telegram_bot.notifier.deliver_to_telegram",
    queue="telegram",
)  # type: ignore[untyped-decorator]
def deliver_to_telegram(self: Any, mission_id: str, formatted_payload: dict[str, object]) -> None:
    """Deliver formatted mission payload to configured Telegram chat."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if token is None or not token.strip():
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required")

    chat_id = _resolve_chat_id(formatted_payload)
    if chat_id is None:
        logger.error("telegram_delivery_missing_chat_id", mission_id=mission_id)
        raise NoChatDestinationError("No chat destination resolved for Telegram delivery")

    cfg = load_telegram_config()
    text = _build_delivery_text(mission_id, formatted_payload)
    chunks = split_long_message(text, cfg.delivery.message_max_length)
    asyncio.run(_send_telegram_chunks(token=token.strip(), chat_id=chat_id, chunks=chunks))


__all__ = ["NoChatDestinationError", "celery_app", "deliver_to_telegram"]
