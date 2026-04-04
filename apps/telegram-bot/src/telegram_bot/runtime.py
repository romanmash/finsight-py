"""Shared runtime context helpers."""

from __future__ import annotations

import json
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, cast

from telegram.ext import ContextTypes

from telegram_bot.config import TelegramRuntimeConfig


@dataclass(frozen=True)
class RuntimeContext:
    """Resolved runtime settings and service credentials."""

    config: TelegramRuntimeConfig
    api_base_url: str
    service_token: str
    openai_api_key: str


class _ApplicationLike(Protocol):
    bot_data: dict[str, object]


def get_runtime(context: ContextTypes.DEFAULT_TYPE) -> RuntimeContext:
    """Fetch typed runtime object from bot_data."""
    runtime = context.application.bot_data.get("runtime")
    if not isinstance(runtime, RuntimeContext):
        raise RuntimeError("telegram runtime context is not initialized")
    return runtime


def is_rate_limited(
    context: ContextTypes.DEFAULT_TYPE,
    telegram_user_id: int,
    limit_per_minute: int,
) -> bool:
    """Return True when user exceeded per-minute request limit."""
    if limit_per_minute <= 0:
        return False

    state_obj = context.application.bot_data.setdefault("_rate_limit_state", {})
    state = cast(dict[int, deque[float]], state_obj)
    now = time.monotonic()
    window_start = now - 60.0

    bucket = state.setdefault(telegram_user_id, deque())
    while bucket and bucket[0] < window_start:
        bucket.popleft()

    if len(bucket) >= limit_per_minute:
        return True

    bucket.append(now)
    return False


def initialize_update_dedupe(
    application: _ApplicationLike,
    state_path: str | None,
) -> None:
    """Initialize update dedupe watermark from optional persistent storage."""
    if not state_path:
        return

    path = Path(state_path)
    application.bot_data["_update_state_path"] = str(path)

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    watermark = payload.get("last_update_id")
    if isinstance(watermark, int):
        application.bot_data["_update_watermark"] = watermark


def _persist_update_watermark(context: ContextTypes.DEFAULT_TYPE, watermark: int) -> None:
    state_path = context.application.bot_data.get("_update_state_path")
    if not isinstance(state_path, str) or not state_path:
        return

    path = Path(state_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"last_update_id": watermark}), encoding="utf-8")
    except OSError:
        return


def should_process_update(
    context: ContextTypes.DEFAULT_TYPE,
    update_id: int,
    max_recent: int = 2048,
) -> bool:
    """Return False when update id was already processed recently."""
    watermark_obj = context.application.bot_data.get("_update_watermark")
    watermark = watermark_obj if isinstance(watermark_obj, int) else -1
    if update_id <= watermark:
        return False

    cache_obj = context.application.bot_data.setdefault("_processed_update_ids", deque())
    cache = cast(deque[int], cache_obj)
    if update_id in cache:
        return False

    cache.append(update_id)
    while len(cache) > max_recent:
        cache.popleft()

    context.application.bot_data["_update_watermark"] = update_id
    _persist_update_watermark(context, update_id)
    return True
