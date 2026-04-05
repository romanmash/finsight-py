"""Watchlist page."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any

import dash
from dash import ctx, dcc, html

from dashboard.api_client import BYPASS_TOKEN_SENTINEL, ApiClient, ApiError
from dashboard.auth import get_token
from dashboard.components.watchlist_form import watchlist_form
from dashboard.config import load_dashboard_config


def _register_page() -> None:
    with suppress(Exception):
        dash.register_page(__name__, path="/watchlist")  # type: ignore[no-untyped-call]


_register_page()
CONFIG = load_dashboard_config()
API_CLIENT = ApiClient(
    api_base_url=CONFIG.api_base_url, auth_bypass_localhost=CONFIG.auth_bypass_localhost
)

layout = html.Div(
    className="dashboard-shell",
    children=[
        html.H2("Watchlist"),
        dcc.Interval(id="watchlist-interval", interval=CONFIG.poll_interval_ms, n_intervals=0),
        html.Div(id="watchlist-table", className="panel"),
        html.Div(
            id="watchlist-admin-controls",
            children=[
                dcc.Input(id="watchlist-item-id", placeholder="Item ID (for edit/delete/toggle)"),
                watchlist_form(),
                html.Button("Delete", id="watchlist-delete-button"),
                html.Button("Toggle Active", id="watchlist-toggle-button"),
            ],
        ),
        html.Div(id="watchlist-status", className="panel"),
    ],
)


def watchlist_admin_controls_style(auth_store: dict[str, object] | None) -> dict[str, str]:
    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    role = ""
    if isinstance(auth_store, dict):
        role_obj = auth_store.get("role")
        if isinstance(role_obj, str):
            role = role_obj
    if has_watchlist_write_access(role=role, token=token):
        return {"display": "block"}
    return {"display": "none"}


def has_watchlist_write_access(*, role: str, token: str) -> bool:
    return role == "admin" or token == BYPASS_TOKEN_SENTINEL


def build_watchlist_payload(
    *,
    ticker: str,
    name: str,
    sector: str,
    list_type: str,
    active_values: list[str],
    price_change_pct_threshold: float | None,
    volume_spike_multiplier: float | None,
    item_id: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "ticker": ticker,
        "name": name,
        "sector": sector,
        "list_type": list_type,
        "is_active": "active" in active_values,
        "price_change_pct_threshold": price_change_pct_threshold,
        "volume_spike_multiplier": volume_spike_multiplier,
    }
    if isinstance(item_id, str) and item_id:
        payload["id"] = item_id
    return payload


def render_watchlist_rows(items: list[dict[str, Any]]) -> list[html.Div]:
    if len(items) == 0:
        return [html.Div("No watchlist items")]

    header = html.Div(
        className="watchlist-header",
        children=[
            html.Span("Ticker"),
            html.Span("Name"),
            html.Span("Sector"),
            html.Span("List Type"),
            html.Span("Active"),
            html.Span("Price %"),
            html.Span("Volume x"),
        ],
    )
    rows: list[html.Div] = [header]
    for entry in items:
        rows.append(
            html.Div(
                className="watchlist-row",
                children=[
                    html.Span(str(entry.get("ticker", "-"))),
                    html.Span(str(entry.get("name", "-"))),
                    html.Span(str(entry.get("sector", "-"))),
                    html.Span(str(entry.get("list_type", "-"))),
                    html.Span(str(entry.get("is_active", "-"))),
                    html.Span(str(entry.get("price_change_pct_threshold", "-"))),
                    html.Span(str(entry.get("volume_spike_multiplier", "-"))),
                ],
            )
        )
    return rows


async def load_watchlist(
    api_client: ApiClient,
    *,
    access_token: str | None,
) -> tuple[list[dict[str, object]], ApiError | None]:
    payload = await api_client.get_watchlist(access_token=access_token)
    if isinstance(payload, ApiError):
        return [], payload
    items_obj = payload.get("items")
    if not isinstance(items_obj, list):
        return [], None
    return [entry for entry in items_obj if isinstance(entry, dict)], None


async def save_watchlist_item(
    api_client: ApiClient,
    *,
    payload: dict[str, object],
    access_token: str | None,
) -> ApiError | None:
    result = await api_client.upsert_watchlist_item(payload, access_token=access_token)
    if isinstance(result, ApiError):
        return result
    return None


async def delete_watchlist_item(
    api_client: ApiClient,
    *,
    item_id: str,
    access_token: str | None,
) -> ApiError | None:
    return await api_client.delete_watchlist_item(item_id, access_token=access_token)


async def set_watchlist_active(
    api_client: ApiClient,
    *,
    item_id: str,
    active: bool,
    access_token: str | None,
) -> ApiError | None:
    payload = {"id": item_id, "is_active": active}
    result = await api_client.upsert_watchlist_item(payload, access_token=access_token)
    if isinstance(result, ApiError):
        return result
    return None


@dash.callback(
    dash.Output("watchlist-admin-controls", "style"),
    dash.Input("auth-store", "data"),
)
def sync_watchlist_controls_visibility(auth_store: dict[str, object] | None) -> dict[str, str]:
    return watchlist_admin_controls_style(auth_store)


@dash.callback(
    dash.Output("watchlist-table", "children"),
    dash.Output("watchlist-status", "children"),
    dash.Input("watchlist-interval", "n_intervals"),
    dash.Input("watchlist-save-button", "n_clicks"),
    dash.Input("watchlist-delete-button", "n_clicks"),
    dash.Input("watchlist-toggle-button", "n_clicks"),
    dash.State("watchlist-item-id", "value"),
    dash.State("watchlist-ticker", "value"),
    dash.State("watchlist-name", "value"),
    dash.State("watchlist-sector", "value"),
    dash.State("watchlist-list-type", "value"),
    dash.State("watchlist-active", "value"),
    dash.State("watchlist-price-change", "value"),
    dash.State("watchlist-volume-spike", "value"),
    dash.State("auth-store", "data"),
)
def refresh_watchlist(
    _n_intervals: int,
    _save_clicks: int | None,
    _delete_clicks: int | None,
    _toggle_clicks: int | None,
    item_id: str | None,
    ticker: str | None,
    name: str | None,
    sector: str | None,
    list_type: str | None,
    active_values: list[str] | None,
    price_change_pct_threshold: float | None,
    volume_spike_multiplier: float | None,
    auth_store: dict[str, object] | None,
) -> tuple[list[html.Div], str]:
    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    role = ""
    if isinstance(auth_store, dict):
        role_obj = auth_store.get("role")
        if isinstance(role_obj, str):
            role = role_obj
    status_message = ""

    triggered = ctx.triggered_id
    mutation_ids = {"watchlist-save-button", "watchlist-delete-button", "watchlist-toggle-button"}
    if triggered in mutation_ids and not has_watchlist_write_access(role=role, token=token):
        status_message = "Forbidden: admin role required for watchlist edits"
    elif triggered == "watchlist-save-button" and isinstance(ticker, str) and ticker.strip():
        payload = build_watchlist_payload(
            ticker=ticker.strip(),
            name=name.strip() if isinstance(name, str) else "",
            sector=sector.strip() if isinstance(sector, str) else "",
            list_type=list_type if isinstance(list_type, str) and list_type else "core",
            active_values=active_values if isinstance(active_values, list) else [],
            price_change_pct_threshold=price_change_pct_threshold,
            volume_spike_multiplier=volume_spike_multiplier,
            item_id=item_id if isinstance(item_id, str) else None,
        )
        error = asyncio.run(save_watchlist_item(API_CLIENT, payload=payload, access_token=token))
        status_message = "Saved" if error is None else f"Save failed: {error.message}"
    elif triggered == "watchlist-delete-button" and isinstance(item_id, str) and item_id:
        error = asyncio.run(delete_watchlist_item(API_CLIENT, item_id=item_id, access_token=token))
        status_message = "Deleted" if error is None else f"Delete failed: {error.message}"
    elif triggered == "watchlist-toggle-button" and isinstance(item_id, str) and item_id:
        active = not (isinstance(active_values, list) and "active" in active_values)
        error = asyncio.run(
            set_watchlist_active(
                API_CLIENT,
                item_id=item_id,
                active=active,
                access_token=token,
            )
        )
        status_message = "Toggled" if error is None else f"Toggle failed: {error.message}"

    rows, load_error = asyncio.run(load_watchlist(API_CLIENT, access_token=token))
    if load_error is not None:
        return [html.Div(f"Error loading watchlist: {load_error.message}")], status_message
    return render_watchlist_rows(rows), status_message
