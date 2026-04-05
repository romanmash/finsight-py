"""Dashboard-auth dependencies with optional local bypass."""

from __future__ import annotations

import hmac
import ipaddress
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated

import yaml
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError

from api.lib.auth import TokenPayload, decode_access_token
from config.schemas.dashboard import DashboardConfig

_optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _load_dashboard_config(path: Path = Path("config/runtime/dashboard.yaml")) -> DashboardConfig:
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        return DashboardConfig.model_validate(raw)
    except (OSError, yaml.YAMLError, ValidationError):
        # Fail closed for bypass if dashboard config is unavailable/invalid.
        return DashboardConfig(auth_bypass_localhost=False)


def _request_host(request: Request) -> str | None:
    # Do not trust forwarded headers for bypass decisions.
    if request.client is None:
        return None
    return request.client.host


def _is_local_host(host: str | None) -> bool:
    if host is None:
        return False
    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    try:
        parsed = ipaddress.ip_address(host)
    except ValueError:
        return False
    return bool(parsed.is_loopback)


def _configured_bypass_token() -> str:
    value = os.getenv("DASHBOARD_BYPASS_TOKEN", "").strip()
    return value


def _has_valid_bypass_token(request: Request) -> bool:
    expected = _configured_bypass_token()
    if expected == "":
        return False
    supplied = request.headers.get("X-Dashboard-Bypass-Token", "")
    return hmac.compare_digest(supplied, expected)


def _bypass_allowed(request: Request) -> bool:
    config = _load_dashboard_config()
    if not config.auth_bypass_localhost:
        return False
    if request.headers.get("X-Dashboard-Bypass") != "1":
        return False
    if not _has_valid_bypass_token(request):
        return False
    return _is_local_host(_request_host(request))


def _local_payload() -> TokenPayload:
    now = datetime.now(UTC)
    return TokenPayload(
        sub="dashboard-local",
        role="admin",
        iat=int(now.timestamp()),
        exp=int((now + timedelta(minutes=10)).timestamp()),
    )


async def dashboard_viewer_or_admin(
    request: Request,
    token: Annotated[str | None, Depends(_optional_oauth2_scheme)],
) -> TokenPayload:
    if isinstance(token, str) and token:
        payload = decode_access_token(token)
        if payload.role not in {"admin", "viewer"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return payload

    if _bypass_allowed(request):
        return _local_payload()

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


async def dashboard_admin(
    request: Request,
    token: Annotated[str | None, Depends(_optional_oauth2_scheme)],
) -> TokenPayload:
    if isinstance(token, str) and token:
        payload = decode_access_token(token)
        if payload.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return payload

    if _bypass_allowed(request):
        return _local_payload()

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


DashboardViewerOrAdminOperator = Annotated[TokenPayload, Depends(dashboard_viewer_or_admin)]
DashboardAdminOperator = Annotated[TokenPayload, Depends(dashboard_admin)]

