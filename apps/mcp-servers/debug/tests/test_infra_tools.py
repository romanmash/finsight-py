"""Tests for infrastructure debug tools."""

from __future__ import annotations

from dataclasses import dataclass

import httpx
import pytest
import respx
from debug_mcp.tools import infra


@dataclass
class _Container:
    name: str
    status: str
    labels: dict[str, str]
    attrs: dict[str, object]
    log_text: str

    @property
    def image(self) -> object:
        class _Image:
            tags = ["repo/image:latest"]

        return _Image()

    def logs(self, tail: int) -> bytes:
        lines = self.log_text.splitlines()
        return "\n".join(lines[-tail:]).encode("utf-8")


class _DockerContainers:
    def __init__(self, containers: list[_Container]) -> None:
        self._containers = containers

    def list(self, all: bool = True) -> list[_Container]:  # noqa: FBT001, FBT002
        return self._containers


class _DockerClient:
    def __init__(self, containers: list[_Container]) -> None:
        self.containers = _DockerContainers(containers)


@pytest.mark.asyncio
async def test_service_health_mixed_results() -> None:
    infra.set_dependencies(
        health_endpoints={
            "api": "https://api.test/health",
            "dashboard": "https://dash.test/health",
        },
        docker_client=_DockerClient([]),
    )

    with respx.mock(assert_all_mocked=True) as router:
        router.get("https://api.test/health").respond(200, json={"status": "ok"})
        router.get("https://dash.test/health").mock(side_effect=httpx.ConnectError("down"))
        result = await infra.service_health()

    assert result.data is not None
    assert result.data.all_healthy is False
    assert len(result.data.services) == 2


@pytest.mark.asyncio
async def test_compose_status_returns_services() -> None:
    container = _Container(
        name="api",
        status="running",
        labels={"com.docker.compose.service": "api"},
        attrs={
            "NetworkSettings": {"Ports": {"8000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8000"}]}}
        },
        log_text="",
    )
    infra.set_dependencies(health_endpoints={}, docker_client=_DockerClient([container]))

    result = await infra.compose_status()
    assert result.data is not None
    assert result.data.services[0].name == "api"
    assert result.data.services[0].running is True


@pytest.mark.asyncio
async def test_tail_logs_unknown_service_returns_error() -> None:
    infra.set_dependencies(health_endpoints={}, docker_client=_DockerClient([]))
    result = await infra.tail_logs(service="unknown", lines=10)
    assert result.data is None
    assert result.error is not None
    assert "Unknown service" in result.error


@pytest.mark.asyncio
async def test_tail_logs_applies_scrub_and_cap() -> None:
    secret_lines = [f"API_KEY=secret-{idx}" for idx in range(1105)]
    container = _Container(
        name="api",
        status="running",
        labels={"com.docker.compose.service": "api"},
        attrs={},
        log_text="\n".join(secret_lines),
    )
    infra.set_dependencies(health_endpoints={}, docker_client=_DockerClient([container]))

    result = await infra.tail_logs(service="api", lines=1500)

    assert result.data is not None
    assert result.data.capped is True
    assert result.data.line_count == 1000
    assert all("[REDACTED]" in line for line in result.data.lines)
