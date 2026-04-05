"""Health indicator component."""

from __future__ import annotations

from dash import html


def health_indicator(service: str, status: str, *, stale: bool = False) -> html.Div:
    """Render one service health row."""
    display_status = "stale" if stale else status
    css = f"health-indicator status-{display_status}"
    return html.Div(
        className=css,
        children=[
            html.Span("●", className="health-dot"),
            html.Span(service, className="health-service"),
            html.Span(display_status, className="health-status"),
        ],
    )
