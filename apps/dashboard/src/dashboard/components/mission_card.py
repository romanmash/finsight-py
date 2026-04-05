"""Mission card component."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime

from dash import dcc, html


def mission_card(data: Mapping[str, object]) -> html.Div:
    """Render one mission summary card."""
    mission_id = str(data.get("id") or data.get("mission_id") or "-")
    mission_type = str(data.get("mission_type", "unknown"))
    status = str(data.get("status", "unknown"))
    query = str(data.get("query", ""))
    updated_at = data.get("updated_at")
    updated_text = str(updated_at)
    if isinstance(updated_at, str):
        try:
            updated_text = datetime.fromisoformat(updated_at.replace("Z", "+00:00")).strftime(
                "%Y-%m-%d %H:%M"
            )
        except ValueError:
            updated_text = updated_at

    return html.Div(
        className=f"mission-card status-{status}",
        children=[
            dcc.Link(
                html.Div(
                    [
                        html.Div(mission_type, className="mission-type"),
                        html.Div(status, className="mission-status"),
                        html.Div(query, className="mission-query"),
                        html.Div(updated_text, className="mission-updated"),
                    ]
                ),
                href=f"/missions/{mission_id}",
                className="mission-link",
            )
        ],
    )
