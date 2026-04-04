"""Operators route tests."""

from __future__ import annotations

from uuid import uuid4

from httpx import AsyncClient


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_get_operator_by_telegram_user_id_service_token_success(
    app_client: AsyncClient,
    service_token: str,
) -> None:
    response = await app_client.get(
        "/operators",
        params={"telegram_user_id": 111},
        headers=_auth_header(service_token),
    )
    assert response.status_code == 200
    assert response.json()["telegram_user_id"] == 111


async def test_get_operator_by_telegram_user_id_not_found(
    app_client: AsyncClient,
    service_token: str,
) -> None:
    response = await app_client.get(
        "/operators",
        params={"telegram_user_id": 999999},
        headers=_auth_header(service_token),
    )
    assert response.status_code == 404


async def test_patch_operator_telegram_chat_id_service_token_success(
    app_client: AsyncClient,
    service_token: str,
    admin_operator,
) -> None:
    response = await app_client.patch(
        f"/operators/{admin_operator.id}",
        json={"telegram_chat_id": 777888},
        headers=_auth_header(service_token),
    )
    assert response.status_code == 200
    assert response.json()["telegram_chat_id"] == 777888


async def test_patch_operator_telegram_chat_id_unauthenticated(
    app_client: AsyncClient,
) -> None:
    response = await app_client.patch(
        f"/operators/{uuid4()}",
        json={"telegram_chat_id": 777888},
    )
    assert response.status_code == 401


async def test_patch_operator_telegram_chat_id_viewer_forbidden(
    app_client: AsyncClient,
    viewer_token: str,
    admin_operator,
) -> None:
    response = await app_client.patch(
        f"/operators/{admin_operator.id}",
        json={"telegram_chat_id": 777888},
        headers=_auth_header(viewer_token),
    )
    assert response.status_code == 403
