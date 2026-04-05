"""Alert badge component."""

from __future__ import annotations

from dash import html


def alert_badge(count: int) -> html.Span:
    """Render badge with alert count."""
    css_class = "alert-badge is-ok" if count == 0 else "alert-badge is-alert"
    return html.Span(str(count), className=css_class)
