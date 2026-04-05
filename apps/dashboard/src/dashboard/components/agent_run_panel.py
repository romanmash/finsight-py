"""Agent run panel component."""

from __future__ import annotations

import json
from collections.abc import Mapping

from dash import html


def agent_run_panel(run: Mapping[str, object]) -> html.Div:
    """Render one agent run panel row."""
    agent_name = str(run.get("agent_name", "unknown"))
    status = str(run.get("status", "unknown"))
    duration = str(run.get("duration_ms", "-"))
    cost = str(run.get("cost_usd", "0"))
    output = run.get("output_data")
    output_text = "No output"
    if isinstance(output, dict):
        output_text = json.dumps(output, indent=2, sort_keys=True)

    return html.Div(
        className=f"agent-run-panel status-{status}",
        children=[
            html.Div(agent_name, className="agent-run-name"),
            html.Div(status, className="agent-run-status"),
            html.Div(f"{duration} ms", className="agent-run-duration"),
            html.Div(f"${cost}", className="agent-run-cost"),
            html.Pre(output_text, className="agent-run-output"),
        ],
    )
