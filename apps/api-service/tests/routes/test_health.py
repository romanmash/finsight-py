"""Health route tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.fixture()
def ok_probe(monkeypatch: pytest.MonkeyPatch) -> None:
    async def ok_status() -> str:
        return "ok"

    monkeypatch.setattr("api.routes.health._database_status", ok_status)
    monkeypatch.setattr("api.routes.health._cache_status", ok_status)


async def test_health_all_ok(ok_probe: None, app_client: AsyncClient) -> None:
    response = await app_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "database" in body["subsystems"]
    assert "cache" in body["subsystems"]
    assert body["subsystems"]["config"] == "ok"


async def test_health_db_down(monkeypatch: pytest.MonkeyPatch, app_client: AsyncClient) -> None:
    async def db_error() -> str:
        return "error"

    async def cache_ok() -> str:
        return "ok"

    monkeypatch.setattr("api.routes.health._database_status", db_error)
    monkeypatch.setattr("api.routes.health._cache_status", cache_ok)
    response = await app_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["subsystems"]["database"] == "error"


async def test_health_no_auth_required(app_client: AsyncClient) -> None:
    response = await app_client.get("/health")
    assert response.status_code == 200
