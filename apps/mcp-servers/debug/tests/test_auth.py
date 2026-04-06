"""Tests for debug MCP auth dependency."""

from __future__ import annotations

import pytest
from debug_mcp.auth import require_auth
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_auth_valid_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEBUG_MCP_TOKEN", "abc123")
    app = FastAPI()

    @app.post("/mcp/")
    async def endpoint(_: None = Depends(require_auth)) -> dict[str, str]:
        return {"ok": "yes"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/mcp/", headers={"Authorization": "Bearer abc123"})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_auth_invalid_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEBUG_MCP_TOKEN", "abc123")
    app = FastAPI()

    @app.post("/mcp/")
    async def endpoint(_: None = Depends(require_auth)) -> dict[str, str]:
        return {"ok": "yes"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/mcp/", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_auth_missing_token_when_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEBUG_MCP_TOKEN", "abc123")
    app = FastAPI()

    @app.post("/mcp/")
    async def endpoint(_: None = Depends(require_auth)) -> dict[str, str]:
        return {"ok": "yes"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/mcp/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_auth_skipped_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DEBUG_MCP_TOKEN", raising=False)
    app = FastAPI()

    @app.post("/mcp/")
    async def endpoint(_: None = Depends(require_auth)) -> dict[str, str]:
        return {"ok": "yes"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/mcp/")
    assert response.status_code == 200
