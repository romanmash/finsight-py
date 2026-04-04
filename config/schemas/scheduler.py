"""Scheduler runtime schema."""

from __future__ import annotations

from croniter import croniter
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PipelineConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    agent_sequence: list[str] = Field(min_length=1)
    cron: str | None = None
    max_retries: int = 1
    retry_backoff_seconds: int = 5

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("pipeline name must not be empty")
        return normalized

    @field_validator("agent_sequence")
    @classmethod
    def validate_agent_sequence(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("agent_sequence cannot contain empty values")
        return value

    @field_validator("cron")
    @classmethod
    def validate_cron(cls, value: str | None) -> str | None:
        if value is None:
            return value
        fields = value.split()
        if len(fields) != 5:
            raise ValueError("cron must have exactly 5 fields (minute hour day month weekday)")
        if not croniter.is_valid(value):
            raise ValueError(f"invalid cron expression: {value}")
        return value


class SchedulerConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    pipelines: list[PipelineConfig] = Field(default_factory=list)
    alert_poll_interval_seconds: int = 30
    timezone: str = "Europe/Copenhagen"

    # Backward-compatibility with pre-008 shape.
    screener_cron: str | None = None
    brief_cron: str | None = None
    earnings_lookback_days: int = 3

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_shape(cls, values: object) -> object:
        if not isinstance(values, dict):
            return values
        if values.get("pipelines"):
            return values

        pipelines: list[dict[str, object]] = [
            {
                "name": "investigation",
                "agent_sequence": [
                    "researcher",
                    "analyst",
                    "technician",
                    "bookkeeper",
                    "reporter",
                ],
            }
        ]
        brief_cron = values.get("brief_cron")
        if isinstance(brief_cron, str):
            pipelines.append(
                {
                    "name": "daily_brief",
                    "agent_sequence": ["researcher", "analyst", "reporter"],
                    "cron": brief_cron,
                }
            )
        screener_cron = values.get("screener_cron")
        if isinstance(screener_cron, str):
            pipelines.append(
                {
                    "name": "screener_scan",
                    "agent_sequence": ["researcher", "watchdog"],
                    "cron": screener_cron,
                }
            )

        migrated = dict(values)
        migrated["pipelines"] = pipelines
        if "alert_poll_interval_seconds" not in migrated:
            migrated["alert_poll_interval_seconds"] = 30
        return migrated

    @field_validator("alert_poll_interval_seconds")
    @classmethod
    def validate_alert_poll_interval_seconds(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("alert_poll_interval_seconds must be > 0")
        return value

    @model_validator(mode="after")
    def validate_unique_pipeline_names(self) -> SchedulerConfig:
        names = [pipeline.name for pipeline in self.pipelines]
        if len(names) != len(set(names)):
            raise ValueError("pipeline names must be unique")
        return self
