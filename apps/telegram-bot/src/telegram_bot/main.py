"""Telegram bot application entrypoint."""

from __future__ import annotations

import os
import sys

from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
)

from telegram_bot.config import load_telegram_config
from telegram_bot.handlers import (
    handle_brief,
    handle_help,
    handle_missions,
    handle_text_message,
    handle_voice_message,
)
from telegram_bot.runtime import RuntimeContext, initialize_update_dedupe


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise SystemExit(f"Missing required environment variable: {name}")
    return value.strip()


def main() -> None:
    """Bootstrap Telegram bot and start long-polling."""
    config = load_telegram_config()
    bot_token = _required_env("TELEGRAM_BOT_TOKEN")
    service_token = _required_env("TELEGRAM_SERVICE_TOKEN")
    openai_api_key = _required_env("OPENAI_API_KEY")
    api_base_url = os.getenv("FINSIGHT_API_BASE_URL", "http://api:8000").rstrip("/")

    app = ApplicationBuilder().token(bot_token).build()
    app.bot_data["runtime"] = RuntimeContext(
        config=config,
        api_base_url=api_base_url,
        service_token=service_token,
        openai_api_key=openai_api_key,
    )
    initialize_update_dedupe(app, os.getenv("TELEGRAM_UPDATE_STATE_PATH"))

    app.add_handler(CommandHandler("help", handle_help))
    app.add_handler(CommandHandler("missions", handle_missions))
    app.add_handler(CommandHandler("brief", handle_brief))
    app.add_handler(MessageHandler(filters.VOICE, handle_voice_message))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    app.run_polling(timeout=config.delivery.poll_timeout_seconds)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"telegram bot failed to start: {exc}", file=sys.stderr)
        raise
