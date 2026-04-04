"""Shared Reporter output models."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

TELEGRAM_CHAR_LIMIT = 4096


class ReportSection(BaseModel):
    model_config = ConfigDict(frozen=True)

    title: str = Field(min_length=1)
    content: str = Field(min_length=1)


class FormattedReport(BaseModel):
    model_config = ConfigDict(frozen=True)

    title: str = Field(min_length=1)
    sections: list[ReportSection] = Field(default_factory=list)
    full_text: str = Field(min_length=1)
    ticker: str | None = None
    mission_id: UUID
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @model_validator(mode="after")
    def enforce_telegram_limit(self) -> FormattedReport:
        if len(self.full_text) <= TELEGRAM_CHAR_LIMIT:
            return self
        suffix = "\n[Truncated]"
        allowed = TELEGRAM_CHAR_LIMIT - len(suffix)
        trimmed = f"{self.full_text[:allowed]}{suffix}" if allowed > 0 else suffix
        return self.model_copy(update={"full_text": trimmed})
