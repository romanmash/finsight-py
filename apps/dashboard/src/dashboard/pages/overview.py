"""Overview page."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any

import dash
from dash import ALL, dcc, html

from dashboard.api_client import ApiClient, ApiError
from dashboard.auth import get_token
from dashboard.components.alert_badge import alert_badge
from dashboard.components.mission_card import mission_card
from dashboard.config import load_dashboard_config


def _register_page() -> None:
    with suppress(Exception):
        dash.register_page(__name__, path="/")  # type: ignore[no-untyped-call]


_register_page()
CONFIG = load_dashboard_config()
API_CLIENT = ApiClient(
    api_base_url=CONFIG.api_base_url,
    auth_bypass_localhost=CONFIG.auth_bypass_localhost,
)

layout = html.Div(
    className="dashboard-shell",
    children=[
        html.H2("Overview"),
        dcc.Interval(id="overview-interval", interval=CONFIG.poll_interval_ms, n_intervals=0),
        html.Div(id="overview-alert-badge", children=[alert_badge(0)]),
        html.Div(
            id="overview-missions",
            className="panel",
            children=[html.Div("No active missions")],
        ),
        html.Div(id="overview-activity", className="panel"),
        html.Div(id="overview-alerts", className="panel"),
        html.Div(id="overview-alert-ack-status", className="panel"),
    ],
)


def summarize_overview(
    missions_payload: dict[str, Any], alerts_payload: dict[str, Any]
) -> dict[str, int]:
    missions_obj = missions_payload.get("items")
    alerts_obj = alerts_payload.get("items")
    mission_count = len(missions_obj) if isinstance(missions_obj, list) else 0
    alert_count = len(alerts_obj) if isinstance(alerts_obj, list) else 0
    return {"mission_count": mission_count, "alert_count": alert_count}


def render_overview_cards(items: list[dict[str, object]]) -> list[html.Div]:
    if len(items) == 0:
        return [html.Div("No active missions")]
    return [mission_card(item) for item in items]


def render_overview_error(error: ApiError) -> html.Div:
    return html.Div(
        className="panel error-panel",
        children=[
            html.Div(f"Error {error.status_code}", className="error-title"),
            html.Div(error.message, className="error-message"),
        ],
    )


def _as_item_list(raw_payload: dict[str, Any], key: str) -> list[dict[str, object]]:
    payload_items = raw_payload.get(key)
    if not isinstance(payload_items, list):
        return []
    return [entry for entry in payload_items if isinstance(entry, dict)]


def _render_alert_rows(alert_items: list[dict[str, object]]) -> list[html.Div]:
    if len(alert_items) == 0:
        return [html.Div("No unacknowledged alerts")]

    rows: list[html.Div] = []
    for alert_item in alert_items[:5]:
        alert_id_obj = alert_item.get("id")
        alert_id = alert_id_obj if isinstance(alert_id_obj, str) else ""
        severity = str(alert_item.get("severity", "unknown"))
        trigger = str(alert_item.get("trigger_condition", ""))
        rows.append(
            html.Div(
                className="alert-row card",
                children=[
                    html.Div(f"{severity.upper()}: {trigger}", className="alert-text"),
                    html.Button(
                        "Acknowledge",
                        id={"type": "overview-ack-alert", "alert_id": alert_id},
                        disabled=alert_id == "",
                    ),
                ],
            )
        )
    return rows


def _render_activity(
    watchlist_summary: str,
    recent_agent_runs: list[dict[str, object]],
) -> list[html.Div]:
    recent_rows = [
        html.Div(
            (
                f"{str(item.get('agent_name', 'unknown')).upper()} "
                f"[{str(item.get('status', 'unknown')).upper()}]"
            ),
            className="activity-row",
        )
        for item in recent_agent_runs[:5]
    ]
    if len(recent_rows) == 0:
        recent_rows = [html.Div("No recent agent activity")]

    return [
        html.Div(watchlist_summary, className="overview-watchlist-summary"),
        html.Div("Recent agent activity", className="overview-activity-title"),
        *recent_rows,
    ]


async def load_overview_state(
    api_client: ApiClient,
    *,
    access_token: str | None,
) -> tuple[
    list[dict[str, object]],
    list[dict[str, object]],
    list[dict[str, object]],
    str,
    int,
    ApiError | None,
]:
    dashboard_overview = await api_client.get_dashboard_overview(access_token=access_token)
    if isinstance(dashboard_overview, ApiError):
        return [], [], [], "", 0, dashboard_overview

    mission_items = _as_item_list(dashboard_overview, "active_missions")
    alert_items = _as_item_list(dashboard_overview, "unacknowledged_alerts")
    recent_agent_runs = _as_item_list(dashboard_overview, "recent_agent_runs")

    counts_obj = dashboard_overview.get("counts")
    counts = counts_obj if isinstance(counts_obj, dict) else {}
    watchlist_active = counts.get("watchlist_active")
    watchlist_total = counts.get("watchlist_total")
    alert_count_obj = counts.get("unacknowledged_alerts")

    active_count = int(watchlist_active) if isinstance(watchlist_active, int) else 0
    total_count = int(watchlist_total) if isinstance(watchlist_total, int) else 0
    watchlist_summary = f"Watchlist: {active_count} active / {total_count} total"
    alert_count = int(alert_count_obj) if isinstance(alert_count_obj, int) else len(alert_items)

    return mission_items, alert_items, recent_agent_runs, watchlist_summary, alert_count, None


@dash.callback(
    dash.Output("overview-alert-badge", "children"),
    dash.Output("overview-missions", "children"),
    dash.Output("overview-activity", "children"),
    dash.Output("overview-alerts", "children"),
    dash.Input("overview-interval", "n_intervals"),
    dash.State("auth-store", "data"),
)
def refresh_overview(
    _n_intervals: int,
    auth_store: dict[str, object] | None,
) -> tuple[list[html.Span], list[html.Div], list[html.Div], list[html.Div]]:
    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    mission_items, alert_items, agent_runs, watchlist_summary, alert_count, error = asyncio.run(
        load_overview_state(
            API_CLIENT,
            access_token=token,
        )
    )
    if error is not None:
        error_panel = render_overview_error(error)
        return [alert_badge(0)], [error_panel], [error_panel], [error_panel]

    return (
        [alert_badge(alert_count)],
        render_overview_cards(mission_items),
        _render_activity(watchlist_summary, agent_runs),
        _render_alert_rows(alert_items),
    )


@dash.callback(
    dash.Output("overview-alert-ack-status", "children"),
    dash.Input({"type": "overview-ack-alert", "alert_id": ALL}, "n_clicks"),
    dash.State("auth-store", "data"),
    prevent_initial_call=True,
)
def acknowledge_from_overview(
    _clicks: list[int | None],
    auth_store: dict[str, object] | None,
) -> str:
    triggered = dash.ctx.triggered_id
    if not isinstance(triggered, dict):
        return ""
    alert_id_obj = triggered.get("alert_id")
    if not isinstance(alert_id_obj, str) or not alert_id_obj:
        return ""

    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    result = asyncio.run(API_CLIENT.acknowledge_alert(alert_id_obj, access_token=token))
    if isinstance(result, ApiError):
        return f"Acknowledge failed: {result.message}"
    return "Alert acknowledged"
