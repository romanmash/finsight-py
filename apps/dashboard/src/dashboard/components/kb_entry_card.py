"""Knowledge entry card component."""

from __future__ import annotations

from collections.abc import Mapping

from dash import html


def kb_entry_card(entry: Mapping[str, object]) -> html.Div:
    """Render knowledge entry summary card."""
    summary = str(entry.get("content_summary", ""))
    ticker = str(entry.get("ticker", ""))
    confidence = str(entry.get("confidence", ""))
    source_agent = str(entry.get("author_agent", "unknown"))
    freshness = str(entry.get("freshness_at") or entry.get("freshness_date") or "unknown")

    tags_raw = entry.get("tags")
    tags = [str(tag) for tag in tags_raw] if isinstance(tags_raw, list) else []

    conflict_markers_raw = entry.get("conflict_markers")
    conflict_markers = (
        [str(value) for value in conflict_markers_raw]
        if isinstance(conflict_markers_raw, list)
        else []
    )
    css_class = "kb-entry-card has-conflict" if len(conflict_markers) > 0 else "kb-entry-card"

    return html.Div(
        className=css_class,
        children=[
            html.Div(ticker, className="kb-ticker"),
            html.Div(f"Confidence: {confidence}", className="kb-confidence"),
            html.Div(f"Source: {source_agent}", className="kb-source"),
            html.Div(f"Freshness: {freshness}", className="kb-freshness"),
            html.Div(summary[:300], className="kb-summary"),
            html.Details(
                className="kb-summary-expand",
                children=[
                    html.Summary("Expand"),
                    html.Div(summary, className="kb-summary-full"),
                ],
            ),
            html.Div(
                [html.Span(tag, className="kb-tag") for tag in tags],
                className="kb-tags",
            ),
            html.Div(
                [html.Span(marker, className="kb-conflict-marker") for marker in conflict_markers],
                className="kb-conflicts",
            ),
        ],
    )
