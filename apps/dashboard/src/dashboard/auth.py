"""Dashboard auth token helpers."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime

from flask import has_request_context, request

from dashboard.api_client import (
    BYPASS_TOKEN_SENTINEL,
    MISSING_TOKEN_SENTINEL,
    ApiClient,
    ApiError,
)


def get_request_ip() -> str:
    """Resolve current request IP from Flask context when available."""
    if not has_request_context():
        return ""
    remote_addr = request.remote_addr
    if isinstance(remote_addr, str):
        return remote_addr
    return ""


def decode_exp_from_jwt(access_token: str) -> int | None:
    """Decode token expiry from JWT payload without signature verification."""
    parts = access_token.split(".")
    if len(parts) != 3:
        return None
    payload_segment = parts[1]
    padding = "=" * (-len(payload_segment) % 4)
    try:
        decoded = base64.urlsafe_b64decode(payload_segment + padding).decode("utf-8")
        payload = json.loads(decoded)
    except (ValueError, json.JSONDecodeError):
        return None
    exp = payload.get("exp")
    if isinstance(exp, int):
        return exp
    return None


def get_token(
    store_data: dict[str, object] | None,
    bypass_localhost: bool,
) -> str:
    """Resolve effective token or sentinel for API calls."""
    request_ip = get_request_ip()
    if bypass_localhost and request_ip in {"127.0.0.1", "::1"}:
        return BYPASS_TOKEN_SENTINEL
    if store_data is None:
        return MISSING_TOKEN_SENTINEL
    token = store_data.get("access_token")
    if isinstance(token, str) and token.strip():
        return token.strip()
    return MISSING_TOKEN_SENTINEL


async def refresh_if_needed(
    store_data: dict[str, object] | None,
    api_client: ApiClient,
) -> dict[str, object] | ApiError:
    """Refresh access token when current one is near expiry."""
    if store_data is None:
        return {}

    expires_at_obj = store_data.get("expires_at")
    access_token_obj = store_data.get("access_token")
    if not isinstance(expires_at_obj, (int, float)) or not isinstance(access_token_obj, str):
        return store_data

    now = datetime.now(UTC).timestamp()
    if float(expires_at_obj) - now > 30.0:
        return store_data

    refreshed = await api_client.refresh_access_token(access_token=access_token_obj)
    if isinstance(refreshed, ApiError):
        return refreshed

    next_token = refreshed.get("access_token")
    if not isinstance(next_token, str):
        return ApiError(status_code=502, message="Refresh payload missing access_token")

    expires_in_obj = refreshed.get("expires_in")
    expires_in = int(expires_in_obj) if isinstance(expires_in_obj, int) else 900
    next_store: dict[str, object] = dict(store_data)
    next_store["access_token"] = next_token
    next_store["expires_at"] = datetime.now(UTC).timestamp() + float(expires_in)
    return next_store
