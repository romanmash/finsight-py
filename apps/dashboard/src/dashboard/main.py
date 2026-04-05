"""Dashboard app bootstrap."""

from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime

import dash
from dash import dcc, html

from dashboard.api_client import ApiClient, ApiError
from dashboard.auth import decode_exp_from_jwt, refresh_if_needed
from dashboard.config import load_dashboard_config
from dashboard.pages import health as _health_page  # noqa: F401
from dashboard.pages import kb as _kb_page  # noqa: F401
from dashboard.pages import missions as _missions_page  # noqa: F401
from dashboard.pages import overview as _overview_page  # noqa: F401
from dashboard.pages import watchlist as _watchlist_page  # noqa: F401

try:
    CONFIG = load_dashboard_config()
except SystemExit:
    raise
except Exception as exc:  # pragma: no cover - defensive startup guard
    print(f"dashboard startup failed: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc

API_CLIENT = ApiClient(
    api_base_url=CONFIG.api_base_url, auth_bypass_localhost=CONFIG.auth_bypass_localhost
)
app = dash.Dash(__name__, use_pages=True)
server = app.server

app.layout = html.Div(
    className="dashboard-shell",
    children=[
        dcc.Location(id="url"),
        dcc.Store(id="auth-store", storage_type="session"),
        dcc.Interval(id="global-interval", interval=CONFIG.poll_interval_ms, n_intervals=0),
        html.Div(
            className="panel",
            children=[
                dcc.Input(id="auth-username", placeholder="Email"),
                dcc.Input(id="auth-password", placeholder="Password", type="password"),
                html.Button("Login", id="auth-login-button"),
                html.Button("Logout", id="auth-logout-button"),
                html.Span(id="auth-status", children="Not authenticated"),
            ],
        ),
        html.Nav(
            className="panel",
            children=[
                dcc.Link("Overview", href="/", className="nav-link"),
                dcc.Link("Missions", href="/missions", className="nav-link"),
                dcc.Link("Watchlist", href="/watchlist", className="nav-link"),
                dcc.Link("KB", href="/kb", className="nav-link"),
                dcc.Link("Health", href="/health", className="nav-link"),
            ],
        ),
        dash.page_container,
    ],
)


@dash.callback(
    dash.Output("auth-store", "data"),
    dash.Output("auth-status", "children"),
    dash.Input("auth-login-button", "n_clicks"),
    dash.Input("auth-logout-button", "n_clicks"),
    dash.State("auth-username", "value"),
    dash.State("auth-password", "value"),
    dash.State("auth-store", "data"),
)
def handle_auth(
    _login_clicks: int | None,
    _logout_clicks: int | None,
    username: str | None,
    password: str | None,
    current_store: dict[str, object] | None,
) -> tuple[dict[str, object], str]:
    triggered = dash.ctx.triggered_id
    if triggered == "auth-logout-button":
        access_token = None
        if isinstance(current_store, dict):
            token_obj = current_store.get("access_token")
            if isinstance(token_obj, str):
                access_token = token_obj
        error = asyncio.run(API_CLIENT.logout(access_token=access_token))
        if isinstance(error, ApiError):
            return {}, f"Logout failed: {error.message}"
        return {}, "Logged out"

    if triggered == "auth-login-button":
        if not isinstance(username, str) or not username.strip():
            return current_store if isinstance(current_store, dict) else {}, "Missing username"
        if not isinstance(password, str) or not password:
            return current_store if isinstance(current_store, dict) else {}, "Missing password"

        payload = asyncio.run(API_CLIENT.login(username=username.strip(), password=password))
        if isinstance(payload, ApiError):
            return current_store if isinstance(
                current_store, dict
            ) else {}, f"Login failed: {payload.message}"

        access_token_obj = payload.get("access_token")
        role_obj = payload.get("role")
        if not isinstance(access_token_obj, str):
            return current_store if isinstance(
                current_store, dict
            ) else {}, "Login failed: missing token"

        exp = decode_exp_from_jwt(access_token_obj)
        expires_at = float(exp) if isinstance(exp, int) else datetime.now(UTC).timestamp() + 900.0
        store: dict[str, object] = {
            "access_token": access_token_obj,
            "expires_at": expires_at,
            "role": role_obj if isinstance(role_obj, str) else "viewer",
        }
        return store, f"Authenticated as {store['role']}"

    return current_store if isinstance(current_store, dict) else {}, "Not authenticated"


@dash.callback(
    dash.Output("auth-store", "data", allow_duplicate=True),
    dash.Input("global-interval", "n_intervals"),
    dash.State("auth-store", "data"),
    prevent_initial_call=True,
)
def keep_auth_fresh(
    _n_intervals: int,
    auth_store: dict[str, object] | None,
) -> dict[str, object]:
    if auth_store is None:
        return {}
    refreshed = asyncio.run(refresh_if_needed(auth_store, API_CLIENT))
    if isinstance(refreshed, ApiError):
        return auth_store
    return refreshed


def main() -> None:
    app.run(host="0.0.0.0", port=8050, debug=False)


if __name__ == "__main__":
    main()
