"""Telegram runtime configuration loader."""

from __future__ import annotations

from pathlib import Path
from typing import NoReturn

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError


class CommandToggles(BaseModel):
    """Enabled/disabled command map."""

    model_config = ConfigDict(extra="allow", frozen=True)

    missions: bool = True
    brief: bool = True
    help: bool = True


class CommandBehaviorConfig(BaseModel):
    """Command behavior switches."""

    model_config = ConfigDict(frozen=True)

    allow_free_text_operator_query: bool = Field(alias="allowFreeTextOperatorQuery")
    enabled_commands: CommandToggles = Field(alias="enabledCommands")


class ResponseMessagesConfig(BaseModel):
    """Operator-facing response texts."""

    model_config = ConfigDict(frozen=True)

    unauthorized: str
    throttled: str
    validation_error: str = Field(alias="validationError")
    temporary_unavailable: str = Field(alias="temporaryUnavailable")
    internal_failure: str = Field(alias="internalFailure")
    processing_ack: str = Field(alias="processingAck")
    transcription_unavailable: str = Field(alias="transcriptionUnavailable")
    low_confidence: str = Field(alias="lowConfidence")


class DeliveryConfig(BaseModel):
    """Delivery behavior for Telegram sends."""

    model_config = ConfigDict(frozen=True)

    message_max_length: int = Field(alias="messageMaxLength")
    graceful_shutdown_ms: int = Field(alias="gracefulShutdownMs")
    proactive_primary_chat_id: int | None = Field(default=None, alias="proactivePrimaryChatId")
    poll_timeout_seconds: int = Field(default=30, alias="pollTimeoutSeconds")


class VoiceConfig(BaseModel):
    """Voice transcription settings."""

    model_config = ConfigDict(frozen=True)

    transcription_model: str = Field(alias="transcriptionModel")
    confidence_threshold: float = Field(alias="confidenceThreshold")


class PerformanceConfig(BaseModel):
    """Operational SLO targets."""

    model_config = ConfigDict(frozen=True)

    acknowledgment_p95_ms: int = Field(alias="acknowledgmentP95Ms")


class TelegramRuntimeConfig(BaseModel):
    """Root telegram runtime configuration."""

    model_config = ConfigDict(frozen=True)

    rate_limit_per_user_per_minute: int = Field(alias="rateLimitPerUserPerMinute")
    command_behavior: CommandBehaviorConfig = Field(alias="commandBehavior")
    response_messages: ResponseMessagesConfig = Field(alias="responseMessages")
    delivery: DeliveryConfig
    voice: VoiceConfig
    performance: PerformanceConfig


def _exit_config_error(path: Path, detail: str) -> NoReturn:
    raise SystemExit(f"{path.name}: {detail}")


def load_telegram_config(
    path: Path = Path("config/runtime/telegram.yaml"),
) -> TelegramRuntimeConfig:
    """Load and validate telegram runtime config."""
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        _exit_config_error(path, f"yaml parse error: {exc}")
    except OSError as exc:
        _exit_config_error(path, f"read error: {exc}")

    try:
        return TelegramRuntimeConfig.model_validate(raw)
    except ValidationError as exc:
        first = exc.errors()[0]
        location = ".".join(str(part) for part in first.get("loc", ()))
        message = first.get("msg", "validation error")
        _exit_config_error(path, f"{location}: {message}")
