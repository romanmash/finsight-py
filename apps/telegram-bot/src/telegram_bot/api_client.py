"""HTTP client helpers for api-service integration."""

from __future__ import annotations

from typing import Any

import httpx


def _auth_headers(service_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {service_token}"}


async def create_mission(
    *,
    api_base_url: str,
    service_token: str,
    query: str,
    ticker: str | None = None,
    timeout_seconds: float = 10.0,
) -> str | None:
    """Create a mission and return mission id on success."""
    payload: dict[str, Any] = {"query": query}
    if ticker is not None:
        payload["ticker"] = ticker

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(
            f"{api_base_url}/missions",
            headers=_auth_headers(service_token),
            json=payload,
        )

    if response.status_code != 202:
        return None

    mission_id = response.json().get("mission_id")
    return mission_id if isinstance(mission_id, str) else None


async def list_missions(
    *,
    api_base_url: str,
    service_token: str,
    limit: int = 10,
    timeout_seconds: float = 10.0,
) -> list[dict[str, Any]] | None:
    """Fetch recent missions list from api-service."""
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(
            f"{api_base_url}/missions/service/recent",
            headers=_auth_headers(service_token),
            params={"limit": limit},
        )

    if response.status_code != 200:
        return None

    data = response.json().get("items")
    if not isinstance(data, list):
        return None

    rows: list[dict[str, Any]] = []
    for entry in data:
        if isinstance(entry, dict):
            rows.append(entry)
    return rows
