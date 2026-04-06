"""Infrastructure debugging tools."""

from __future__ import annotations

import time
from collections.abc import Mapping
from typing import Any, Literal

import httpx

from debug_mcp.models import (
    ComposeService,
    ComposeStatusResult,
    LogResult,
    ServiceHealth,
    ServiceHealthResult,
    ToolResponse,
)
from debug_mcp.scrub import scrub

LOG_LINE_CAP = 1000
_ALLOWED_SERVICES: tuple[str, ...] = (
    "api",
    "db",
    "redis",
    "market-data-mcp",
    "news-macro-mcp",
    "rag-retrieval-mcp",
    "dashboard",
    "worker-watchdog",
    "worker-brief",
    "worker-mission",
    "worker-alert",
    "worker-screener",
    "celery-beat",
    "telegram-bot",
    "telegram-worker",
    "debug-mcp",
)

_health_endpoints: dict[str, str] = {}
_docker_client: Any = None


def set_dependencies(*, health_endpoints: dict[str, str], docker_client: Any) -> None:
    """Configure runtime dependencies for infrastructure tools."""
    global _health_endpoints, _docker_client
    _health_endpoints = dict(health_endpoints)
    _docker_client = docker_client


def _now_ms() -> float:
    return time.perf_counter() * 1000


def _elapsed_ms(start_ms: float) -> int:
    return int(_now_ms() - start_ms)


def _extract_ports(container: Any) -> list[str]:
    attrs = getattr(container, "attrs", {})
    if not isinstance(attrs, Mapping):
        return []
    network_settings = attrs.get("NetworkSettings", {})
    if not isinstance(network_settings, Mapping):
        return []
    ports = network_settings.get("Ports", {})
    if not isinstance(ports, Mapping):
        return []

    entries: list[str] = []
    for container_port, bindings in ports.items():
        if bindings is None:
            entries.append(str(container_port))
            continue
        if isinstance(bindings, list):
            for binding in bindings:
                if isinstance(binding, Mapping):
                    host_ip = binding.get("HostIp", "")
                    host_port = binding.get("HostPort", "")
                    entries.append(f"{host_ip}:{host_port}->{container_port}")
    return entries


def _container_matches_service(container: Any, service: str) -> bool:
    labels = getattr(container, "labels", {})
    if isinstance(labels, Mapping) and labels.get("com.docker.compose.service") == service:
        return True

    name = str(getattr(container, "name", ""))
    if name == service or name.endswith(f"-{service}-1"):
        return True

    container_id = str(getattr(container, "id", ""))
    return container_id == service


def _find_service_container(service: str) -> Any | None:
    if _docker_client is None:
        return None

    for container in _docker_client.containers.list(all=True):
        if _container_matches_service(container, service):
            return container
    return None


async def service_health() -> ToolResponse[ServiceHealthResult]:
    """Return per-service health checks for configured debug endpoints."""
    started = _now_ms()
    services: list[ServiceHealth] = []

    if not _health_endpoints:
        return ToolResponse(
            data=ServiceHealthResult(all_healthy=False, services=[]),
            error="No debug health endpoints configured",
            latency_ms=_elapsed_ms(started),
        )

    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, endpoint in _health_endpoints.items():
            check_started = _now_ms()
            try:
                response = await client.get(endpoint)
                status: Literal["pass", "fail", "skip"] = (
                    "pass" if response.status_code < 400 else "fail"
                )
                services.append(
                    ServiceHealth(
                        name=name,
                        endpoint=endpoint,
                        status=status,
                        status_code=response.status_code,
                        latency_ms=_elapsed_ms(check_started),
                        error=None,
                    )
                )
            except httpx.HTTPError as exc:
                services.append(
                    ServiceHealth(
                        name=name,
                        endpoint=endpoint,
                        status="fail",
                        status_code=None,
                        latency_ms=_elapsed_ms(check_started),
                        error=str(exc),
                    )
                )

    all_healthy = all(service.status == "pass" for service in services)
    return ToolResponse(
        data=ServiceHealthResult(all_healthy=all_healthy, services=services),
        latency_ms=_elapsed_ms(started),
    )


async def compose_status() -> ToolResponse[ComposeStatusResult]:
    """Return compose container runtime status."""
    started = _now_ms()

    if _docker_client is None:
        return ToolResponse(
            data=None,
            error="Docker client is not configured",
            latency_ms=0,
        )

    try:
        containers = _docker_client.containers.list(all=True)
    except Exception as exc:
        return ToolResponse(
            data=None,
            error=f"Docker unavailable: {exc}",
            latency_ms=_elapsed_ms(started),
        )

    services = [
        ComposeService(
            name=str(getattr(container, "name", "unknown")),
            status=str(getattr(container, "status", "unknown")),
            running=str(getattr(container, "status", "")).lower() == "running",
            image=str(getattr(getattr(container, "image", None), "tags", ["unknown"])[0]),
            ports=_extract_ports(container),
        )
        for container in containers
    ]

    return ToolResponse(
        data=ComposeStatusResult(services=services),
        latency_ms=_elapsed_ms(started),
    )


async def tail_logs(service: str, lines: int = 100) -> ToolResponse[LogResult]:
    """Return scrubbed log lines for an allowed compose service."""
    started = _now_ms()

    if service not in _ALLOWED_SERVICES:
        return ToolResponse(
            data=None,
            error=f"Unknown service '{service}'. Valid services: {', '.join(_ALLOWED_SERVICES)}",
            latency_ms=_elapsed_ms(started),
        )

    if _docker_client is None:
        return ToolResponse(
            data=None,
            error="Docker client is not configured",
            latency_ms=_elapsed_ms(started),
        )

    container = _find_service_container(service)
    if container is None:
        return ToolResponse(
            data=None,
            error=f"Service '{service}' is not running or not found",
            latency_ms=_elapsed_ms(started),
        )

    requested = max(1, min(lines, LOG_LINE_CAP))
    try:
        raw = container.logs(tail=requested)
    except Exception as exc:
        return ToolResponse(
            data=None,
            error=f"Failed to read logs: {exc}",
            latency_ms=_elapsed_ms(started),
        )

    decoded = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)

    raw_lines = decoded.splitlines()
    capped = lines > LOG_LINE_CAP or len(raw_lines) > LOG_LINE_CAP
    limited = raw_lines[:LOG_LINE_CAP]
    scrubbed = [scrub(line) for line in limited]

    return ToolResponse(
        data=LogResult(service=service, lines=scrubbed, line_count=len(scrubbed), capped=capped),
        latency_ms=_elapsed_ms(started),
    )
