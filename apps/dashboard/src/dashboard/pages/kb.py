"""Knowledge browser page."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any

import dash
from dash import ctx, dcc, html

from dashboard.api_client import ApiClient, ApiError
from dashboard.auth import get_token
from dashboard.components.kb_entry_card import kb_entry_card
from dashboard.config import load_dashboard_config


def _register_page() -> None:
    with suppress(Exception):
        dash.register_page(__name__, path="/kb")  # type: ignore[no-untyped-call]


_register_page()
CONFIG = load_dashboard_config()
API_CLIENT = ApiClient(
    api_base_url=CONFIG.api_base_url, auth_bypass_localhost=CONFIG.auth_bypass_localhost
)

layout = html.Div(
    className="dashboard-shell",
    children=[
        html.H2("Knowledge Base"),
        dcc.Store(id="kb-page", data=0),
        dcc.Input(id="kb-query", placeholder="Search by ticker or theme"),
        html.Button("Search", id="kb-search-button"),
        html.Button("Prev", id="kb-prev-button"),
        html.Button("Next", id="kb-next-button"),
        html.Span(id="kb-page-label", children="Page 1"),
        html.Div(id="kb-results", className="panel"),
    ],
)


def normalize_query(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()


def render_kb_results(items: list[dict[str, Any]]) -> list[html.Div]:
    if len(items) == 0:
        return [html.Div("No entries found")]
    return [kb_entry_card(entry) for entry in items]


async def search_kb_entries(
    api_client: ApiClient,
    *,
    query: str,
    page: int,
    page_size: int,
    access_token: str | None,
) -> tuple[list[dict[str, object]], ApiError | None]:
    payload = await api_client.get_kb_entries(
        query=query,
        page=page,
        page_size=page_size,
        access_token=access_token,
    )
    if isinstance(payload, ApiError):
        return [], payload

    items_obj = payload.get("items")
    if not isinstance(items_obj, list):
        return [], None
    items = [entry for entry in items_obj if isinstance(entry, dict)]
    return items, None


def _normalize_page(value: object) -> int:
    if isinstance(value, int) and value >= 0:
        return value
    return 0


@dash.callback(
    dash.Output("kb-results", "children"),
    dash.Output("kb-page", "data"),
    dash.Output("kb-page-label", "children"),
    dash.Input("kb-search-button", "n_clicks"),
    dash.Input("kb-prev-button", "n_clicks"),
    dash.Input("kb-next-button", "n_clicks"),
    dash.State("kb-query", "value"),
    dash.State("kb-page", "data"),
    dash.State("auth-store", "data"),
)
def refresh_kb(
    _search_clicks: int | None,
    _prev_clicks: int | None,
    _next_clicks: int | None,
    query_value: str | None,
    page_data: object,
    auth_store: dict[str, object] | None,
) -> tuple[list[html.Div], int, str]:
    token = get_token(auth_store, CONFIG.auth_bypass_localhost)
    normalized_query = normalize_query(query_value)
    page = _normalize_page(page_data)
    triggered = ctx.triggered_id

    if normalized_query == "":
        return [html.Div("No entries found")], 0, "Page 1"

    if triggered == "kb-search-button":
        page = 0
    elif triggered == "kb-prev-button":
        page = max(0, page - 1)
    elif triggered == "kb-next-button":
        page = page + 1

    items, error = asyncio.run(
        search_kb_entries(
            API_CLIENT,
            query=normalized_query,
            page=page,
            page_size=CONFIG.page_size_kb,
            access_token=token,
        )
    )
    if triggered == "kb-next-button" and len(items) == 0 and page > 0:
        page = page - 1
        items, error = asyncio.run(
            search_kb_entries(
                API_CLIENT,
                query=normalized_query,
                page=page,
                page_size=CONFIG.page_size_kb,
                access_token=token,
            )
        )

    if error is not None:
        message = f"Error loading knowledge entries: {error.message}"
        return [html.Div(message)], page, f"Page {page + 1}"
    return render_kb_results(items), page, f"Page {page + 1}"

