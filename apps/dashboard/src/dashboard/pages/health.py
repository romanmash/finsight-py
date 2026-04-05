"""Health page."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import UTC, datetime
from typing import Any

import dash
from dash import dcc, html

from dashboard.api_client import ApiClient, ApiError
from dashboard.auth import get_token
from dashboard.components.health_indicator import health_indicator
from dashboard.config import load_dashboard_config

EXPECTED_SERVICES: tuple[str, ...] = (
    "api",
    "celery-beat",
    "worker-mission",
    "worker-alert",
    "worker-screener",
    "worker-watchdog",
    "worker-brief",
    "telegram-bot",
    "telegram-worker",
    "dashboard",
)


def _register_page() -> None:
    with suppress(Exception):
        dash.register_page(__name__, path="/health")  # type: ignore[no-untyped-call]


_register_page()
CONFIG = load_dashboard_config()
API_CLIENT = ApiClient(
    api_base_url=CONFIG.api_base_url, auth_bypass_localhost=CONFIG.auth_bypass_localhost
)

layout = html.Div(
    className="dashboard-shell",
    children=[
        html.H2("System Health"),
        dcc.Interval(id="health-interval", interval=CONFIG.poll_interval_ms, n_intervals=0),
        html.Div(id="health-stale", className="panel"),
        html.Div(id="health-services", className="panel"),
    ],
)


def is_stale(last_updated_iso: str | None, stale_threshold_seconds: int) -> bool:
    if not isinstance(last_updated_iso, str) or not last_updated_iso:
        return True
    try:
        last_updated = datetime.fromisoformat(last_updated_iso.replace("Z", "+00:00"))
    except ValueError:
        return True
    delta = datetime.now(UTC) - last_updated
    return delta.total_seconds() > float(stale_threshold_seconds)


def normalize_services(services: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for service in EXPECTED_SERVICES:
        normalized[service] = str(services.get(service, "unknown"))
    return normalized


def render_health_services(services: dict[str, Any], *, stale: bool) -> list[html.Div]:
    normalized = normalize_services(services)
    return [health_indicator(name, status, stale=stale) for name, status in normalized.items()]


def render_stale_badge(stale: bool) -> html.Div | None:
    if not stale:
        return None
    return html.Div("Stale", className="health-stale-badge")


async def load_health_state(
    api_client: ApiClient,
    *,
    access_token: str | None,
    stale_threshold_seconds: int,
) -> tuple[dict[str, str], bool, ApiError | None]:
    payload = await api_client.get_health(access_token=access_token)
    if isinstance(payload, ApiError):
        return normalize_services({}), True, payload

    services_obj = payload.get("services")
    services = services_obj if isinstance(services_obj, dict) else {}
    last_updated_iso = payload.get("last_updated")
    stale = is_stale(
        last_updated_iso if isinstance(last_updated_iso, str) else None,
        stale_threshold_seconds=stale_threshold_seconds,
    )
    return normalize_services(services), stale, None


@dash.callback(
    dash.Output("health-services", "children"),
    dash.Output("health-stale", "children"),
    dash.Input("health-interval", "n_intervals"),
    dash.State("auth-store", "data"),
)
def refresh_health(
    _n_intervals: int,
    auth_store: dict[str, object] | None,
) -> tuple[list[html.Div], html.Div | str]:
    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    services, stale, error = asyncio.run(
        load_health_state(
            API_CLIENT,
            access_token=token,
            stale_threshold_seconds=CONFIG.stale_threshold_seconds,
        )
    )
    if error is not None:
        return [html.Div(f"Error loading health: {error.message}")], ""

    stale_badge = render_stale_badge(stale)
    return (
        render_health_services(services, stale=stale),
        stale_badge if stale_badge is not None else "",
    )
