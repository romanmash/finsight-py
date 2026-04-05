"""Watchlist form component."""

from __future__ import annotations

from collections.abc import Mapping

from dash import dcc, html


def _string_value(value: object) -> str:
    return value if isinstance(value, str) else ""


def _number_value(value: object) -> float | int | None:
    if isinstance(value, (int, float)):
        return value
    return None


def watchlist_form(item: Mapping[str, object] | None = None) -> html.Div:
    """Render add/edit watchlist form."""
    data = dict(item) if item is not None else {}
    return html.Div(
        className="watchlist-form card",
        children=[
            dcc.Input(
                id="watchlist-ticker",
                value=_string_value(data.get("ticker")),
                placeholder="Ticker",
            ),
            dcc.Input(
                id="watchlist-name",
                value=_string_value(data.get("name")),
                placeholder="Name",
            ),
            dcc.Input(
                id="watchlist-sector",
                value=_string_value(data.get("sector")),
                placeholder="Sector",
            ),
            dcc.Dropdown(
                id="watchlist-list-type",
                options=[
                    {"label": "Core", "value": "core"},
                    {"label": "Satellite", "value": "satellite"},
                    {"label": "Experimental", "value": "experimental"},
                ],
                value=_string_value(data.get("list_type")) or "core",
                clearable=False,
            ),
            dcc.Input(
                id="watchlist-price-change",
                type="number",
                value=_number_value(data.get("price_change_pct_threshold")),
                placeholder="Price change %",
            ),
            dcc.Input(
                id="watchlist-volume-spike",
                type="number",
                value=_number_value(data.get("volume_spike_multiplier")),
                placeholder="Volume spike x",
            ),
            dcc.Checklist(
                id="watchlist-active",
                options=[{"label": "Active", "value": "active"}],
                value=["active"] if bool(data.get("is_active", True)) else [],
            ),
            html.Button("Save", id="watchlist-save-button"),
        ],
    )
