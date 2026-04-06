"""Pydantic models for debug MCP server responses."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class ToolResponse[T](BaseModel):
    """Standard response envelope for debug tools."""

    model_config = ConfigDict(frozen=True)

    data: T | None
    error: str | None = None
    latency_ms: int = 0


class ServiceHealth(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    endpoint: str
    status: Literal["pass", "fail", "skip"]
    status_code: int | None
    latency_ms: int
    error: str | None = None


class ServiceHealthResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    all_healthy: bool
    services: list[ServiceHealth]


class ComposeService(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    status: str
    running: bool
    image: str
    ports: list[str]


class ComposeStatusResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    services: list[ComposeService]


class LogResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    service: str
    lines: list[str]
    line_count: int
    capped: bool


class DbQueryResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    columns: list[str]
    rows: list[list[object | None]]
    row_count: int
    capped: bool


class DbColumn(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    type: str
    nullable: bool
    default: str | None = None


class DbTableInfoResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    table: str
    columns: list[DbColumn]
    row_estimate: int | None


class RedisKeyResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str
    type: str
    ttl: int | None
    value: object | None
    size: int | None


class AgentRunSummary(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    agent_type: str
    status: str
    started_at: str
    finished_at: str | None
    error: str | None


class AgentRunResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    runs: list[AgentRunSummary]
    total_count: int


class MissionStatusResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    mission_id: str
    status: str
    created_at: str
    agent_runs: list[AgentRunSummary]


class CeleryQueue(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    depth: int


class CeleryInspectResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    active_tasks: int
    queues: list[CeleryQueue]


class AlertInspectResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    alert_id: str
    condition_type: str
    status: str
    acknowledged_at: str | None
    triggered_at: str | None
