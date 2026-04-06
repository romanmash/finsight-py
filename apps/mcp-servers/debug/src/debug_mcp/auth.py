"""Authentication helpers for debug MCP endpoint."""

from __future__ import annotations

import os

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)
_auth_credentials = Security(_bearer)


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = _auth_credentials,
) -> None:
    """Require bearer auth when DEBUG_MCP_TOKEN is configured."""
    token = os.getenv("DEBUG_MCP_TOKEN", "").strip()
    if not token:
        return

    if credentials is None or credentials.credentials != token:
        raise HTTPException(status_code=401, detail="Unauthorized")
