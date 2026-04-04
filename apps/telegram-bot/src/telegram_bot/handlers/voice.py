"""Voice message handler."""

from __future__ import annotations

import math

import httpx
from telegram import Update
from telegram.error import TelegramError
from telegram.ext import ContextTypes

from telegram_bot.api_client import create_mission
from telegram_bot.auth import OperatorLookupError, authenticate_operator
from telegram_bot.runtime import get_runtime, is_rate_limited, should_process_update


def _extract_confidence(payload: dict[str, object]) -> float | None:
    """Extract confidence from provider payload when available."""
    confidence_raw = payload.get("confidence")
    if isinstance(confidence_raw, (int, float)):
        confidence = float(confidence_raw)
        return max(0.0, min(1.0, confidence))

    segments_raw = payload.get("segments")
    if not isinstance(segments_raw, list):
        return None

    confidence_samples: list[float] = []
    for segment in segments_raw:
        if not isinstance(segment, dict):
            continue
        avg_logprob_raw = segment.get("avg_logprob")
        if not isinstance(avg_logprob_raw, (int, float)):
            continue

        avg_logprob = float(avg_logprob_raw)
        # Convert log-probability to [0,1] confidence proxy.
        confidence_samples.append(math.exp(min(0.0, avg_logprob)))

    if not confidence_samples:
        return None

    return sum(confidence_samples) / len(confidence_samples)


async def _transcribe_voice(
    *, api_key: str, audio_bytes: bytes, model: str
) -> tuple[str | None, float | None]:
    headers = {"Authorization": f"Bearer {api_key}"}
    files = {"file": ("voice.ogg", audio_bytes, "audio/ogg")}
    data = {"model": model, "response_format": "verbose_json"}

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers=headers,
            data=data,
            files=files,
        )

    if response.status_code != 200:
        return None, None

    payload_raw = response.json()
    if not isinstance(payload_raw, dict):
        return None, None

    payload = payload_raw
    text = payload.get("text")
    confidence = _extract_confidence(payload)
    return text if isinstance(text, str) else None, confidence


async def handle_voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Transcribe voice and dispatch as mission query."""
    if not should_process_update(context, update.update_id):
        return

    message = update.effective_message
    user = update.effective_user
    if message is None or user is None or message.voice is None:
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

    try:
        tg_file = await context.bot.get_file(message.voice.file_id)
        payload = await tg_file.download_as_bytearray()
        text, confidence = await _transcribe_voice(
            api_key=runtime.openai_api_key,
            audio_bytes=bytes(payload),
            model=cfg.voice.transcription_model,
        )
    except (httpx.HTTPError, TelegramError):
        text = None
        confidence = None

    if text is None or not text.strip():
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.transcription_unavailable,
        )
        return

    if confidence is not None and confidence < cfg.voice.confidence_threshold:
        await context.bot.send_message(
            chat_id=message.chat_id,
            text=cfg.response_messages.low_confidence,
        )
        return

    try:
        mission_id = await create_mission(
            api_base_url=runtime.api_base_url,
            service_token=runtime.service_token,
            query=text.strip(),
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
