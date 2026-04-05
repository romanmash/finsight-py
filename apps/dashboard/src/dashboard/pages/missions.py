"""Missions page."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any

import dash
from dash import ctx, dcc, html

from dashboard.api_client import ApiClient, ApiError
from dashboard.auth import get_token
from dashboard.components.agent_run_panel import agent_run_panel
from dashboard.components.mission_card import mission_card
from dashboard.config import load_dashboard_config


def _register_page() -> None:
    with suppress(Exception):
        dash.register_page(__name__, path="/missions")  # type: ignore[no-untyped-call]


_register_page()
CONFIG = load_dashboard_config()
API_CLIENT = ApiClient(
    api_base_url=CONFIG.api_base_url, auth_bypass_localhost=CONFIG.auth_bypass_localhost
)

STATUS_OPTIONS: tuple[dict[str, str], ...] = (
    {"label": "All", "value": ""},
    {"label": "Running", "value": "running"},
    {"label": "Pending", "value": "pending"},
    {"label": "Completed", "value": "completed"},
    {"label": "Failed", "value": "failed"},
)

layout = html.Div(
    className="dashboard-shell",
    children=[
        html.H2("Missions"),
        dcc.Interval(
            id="missions-interval",
            interval=CONFIG.mission_poll_interval_ms,
            n_intervals=0,
        ),
        dcc.Store(id="missions-page", data=0),
        html.Div(
            className="panel",
            children=[
                dcc.Dropdown(
                    id="missions-status-filter",
                    options=list(STATUS_OPTIONS),
                    value="",
                    clearable=False,
                ),
                html.Button("Prev", id="missions-prev-button"),
                html.Button("Next", id="missions-next-button"),
                html.Span(id="missions-page-label", children="Page 1"),
            ],
        ),
        html.Div(id="missions-list", className="panel"),
        html.Div(id="mission-detail", className="panel"),
    ],
)


def filter_missions(
    items: list[dict[str, object]], status_filter: str | None
) -> list[dict[str, object]]:
    if status_filter is None or status_filter == "":
        return items
    return [entry for entry in items if str(entry.get("status")) == status_filter]


def render_mission_detail(payload: dict[str, Any]) -> list[html.Div]:
    mission_obj = payload.get("mission")
    runs_obj = payload.get("agent_runs")
    if not isinstance(mission_obj, dict):
        return [html.Div("Mission not found")]

    children: list[html.Div] = [mission_card(mission_obj)]
    if isinstance(runs_obj, list):
        children.extend(agent_run_panel(run) for run in runs_obj if isinstance(run, dict))
    return children


def mission_interval_disabled(mission_payload: dict[str, Any]) -> bool:
    mission_obj = mission_payload.get("mission")
    if not isinstance(mission_obj, dict):
        return True
    return str(mission_obj.get("status")) != "running"


async def load_mission_detail(
    api_client: ApiClient,
    *,
    mission_id: str,
    access_token: str | None,
) -> tuple[dict[str, Any] | None, ApiError | None]:
    payload = await api_client.get_mission(mission_id, access_token=access_token)
    if isinstance(payload, ApiError):
        return None, payload
    return payload, None


async def load_missions_list(
    api_client: ApiClient,
    *,
    status_filter: str | None,
    limit: int,
    page: int,
    access_token: str | None,
) -> tuple[list[dict[str, object]], ApiError | None]:
    payload = await api_client.get_missions(
        status_filter=status_filter,
        limit=limit,
        offset=max(0, page * limit),
        access_token=access_token,
    )
    if isinstance(payload, ApiError):
        return [], payload
    items_obj = payload.get("items")
    if not isinstance(items_obj, list):
        return [], None
    items = [entry for entry in items_obj if isinstance(entry, dict)]
    return items, None


def _extract_mission_id(pathname: str | None) -> str | None:
    if not isinstance(pathname, str):
        return None
    if not pathname.startswith("/missions/"):
        return None
    _, _, mission_id = pathname.partition("/missions/")
    return mission_id or None


def _normalize_page(value: object) -> int:
    if isinstance(value, int) and value >= 0:
        return value
    return 0


@dash.callback(
    dash.Output("missions-list", "children"),
    dash.Output("mission-detail", "children"),
    dash.Output("missions-interval", "disabled"),
    dash.Output("missions-page", "data"),
    dash.Output("missions-page-label", "children"),
    dash.Input("missions-interval", "n_intervals"),
    dash.Input("url", "pathname"),
    dash.Input("missions-status-filter", "value"),
    dash.Input("missions-prev-button", "n_clicks"),
    dash.Input("missions-next-button", "n_clicks"),
    dash.State("missions-page", "data"),
    dash.State("auth-store", "data"),
)
def refresh_missions(
    _n_intervals: int,
    pathname: str | None,
    status_filter_value: str | None,
    _prev_clicks: int | None,
    _next_clicks: int | None,
    page_data: object,
    auth_store: dict[str, object] | None,
) -> tuple[list[html.Div], list[html.Div], bool, int, str]:
    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    status_filter = status_filter_value if isinstance(status_filter_value, str) else ""
    page = _normalize_page(page_data)

    triggered = ctx.triggered_id
    if triggered == "missions-status-filter":
        page = 0
    elif triggered == "missions-prev-button":
        page = max(0, page - 1)
    elif triggered == "missions-next-button":
        page = page + 1

    mission_items, list_error = asyncio.run(
        load_missions_list(
            API_CLIENT,
            status_filter=status_filter if status_filter != "" else None,
            limit=CONFIG.page_size_missions,
            page=page,
            access_token=token,
        )
    )
    if triggered == "missions-next-button" and len(mission_items) == 0 and page > 0:
        page = page - 1
        mission_items, list_error = asyncio.run(
            load_missions_list(
                API_CLIENT,
                status_filter=status_filter if status_filter != "" else None,
                limit=CONFIG.page_size_missions,
                page=page,
                access_token=token,
            )
        )

    if list_error is not None:
        error = html.Div(f"Error loading missions: {list_error.message}", className="error-message")
        return [error], [error], True, page, f"Page {page + 1}"

    list_children = [mission_card(item) for item in mission_items]
    if len(list_children) == 0:
        list_children = [html.Div("No missions")]

    mission_id = _extract_mission_id(pathname)
    if mission_id is None:
        return list_children, [html.Div("Select a mission")], True, page, f"Page {page + 1}"

    detail_payload, detail_error = asyncio.run(
        load_mission_detail(API_CLIENT, mission_id=mission_id, access_token=token)
    )
    if detail_error is not None or detail_payload is None:
        error_message = detail_error.message if detail_error is not None else "Mission not found"
        return (
            list_children,
            [html.Div(error_message, className="error-message")],
            True,
            page,
            f"Page {page + 1}",
        )

    return (
        list_children,
        render_mission_detail(detail_payload),
        mission_interval_disabled(detail_payload),
        page,
        f"Page {page + 1}",
    )
