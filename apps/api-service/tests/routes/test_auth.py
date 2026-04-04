"""Authentication and RBAC route tests."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

from httpx import AsyncClient


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_login_success(app_client: AsyncClient, mock_refresh_repo: AsyncMock) -> None:
    response = await app_client.post(
        "/auth/login",
        data={"username": "admin@example.com", "password": "admin-pass"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=strict" in cookie
    assert "Max-Age=" in cookie
    assert mock_refresh_repo.create.await_count == 1


async def test_login_wrong_password(app_client: AsyncClient) -> None:
    response = await app_client.post(
        "/auth/login",
        data={"username": "admin@example.com", "password": "wrong-pass"},
    )
    assert response.status_code == 401


async def test_login_unknown_user(app_client: AsyncClient) -> None:
    response = await app_client.post(
        "/auth/login",
        data={"username": "unknown@example.com", "password": "admin-pass"},
    )
    assert response.status_code == 401


async def test_login_inactive_account(
    app_client: AsyncClient,
    mock_operator_repo: AsyncMock,
) -> None:
    inactive = await mock_operator_repo.get_by_email("admin@example.com")
    assert inactive is not None
    inactive.is_active = False

    response = await app_client.post(
        "/auth/login",
        data={"username": "admin@example.com", "password": "admin-pass"},
    )

    assert response.status_code == 401
    inactive.is_active = True


async def test_me_with_valid_token(app_client: AsyncClient, admin_token: str) -> None:
    response = await app_client.get("/auth/me", headers=_auth_header(admin_token))
    assert response.status_code == 200
    body = response.json()
    assert body["operator_id"]
    assert body["role"] == "admin"


async def test_me_with_no_token(app_client: AsyncClient) -> None:
    response = await app_client.get("/auth/me")
    assert response.status_code == 401


async def test_refresh_valid_cookie(
    app_client: AsyncClient,
    mock_refresh_repo: AsyncMock,
    admin_operator,
) -> None:
    raw_token = "refresh-valid"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    await mock_refresh_repo.create(
        {
            "operator_id": admin_operator.id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) + timedelta(days=1),
            "revoked_at": None,
        }
    )

    app_client.cookies.set("refresh_token", raw_token, path="/auth")
    response = await app_client.post("/auth/refresh")
    assert response.status_code == 200
    assert response.json()["access_token"]
    cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=strict" in cookie
    assert "Max-Age=" in cookie


async def test_refresh_no_cookie(app_client: AsyncClient) -> None:
    response = await app_client.post("/auth/refresh")
    assert response.status_code == 401


async def test_refresh_revoked_token(
    app_client: AsyncClient,
    mock_refresh_repo: AsyncMock,
    admin_operator,
) -> None:
    raw_token = "refresh-revoked"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    created = await mock_refresh_repo.create(
        {
            "operator_id": admin_operator.id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) + timedelta(days=1),
            "revoked_at": None,
        }
    )
    await mock_refresh_repo.revoke(created.id)

    app_client.cookies.set("refresh_token", raw_token, path="/auth")
    response = await app_client.post("/auth/refresh")
    assert response.status_code == 401


async def test_refresh_expired_token(
    app_client: AsyncClient,
    mock_refresh_repo: AsyncMock,
    admin_operator,
) -> None:
    raw_token = "refresh-expired"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    await mock_refresh_repo.create(
        {
            "operator_id": admin_operator.id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) - timedelta(days=1),
            "revoked_at": None,
        }
    )

    app_client.cookies.set("refresh_token", raw_token, path="/auth")
    response = await app_client.post("/auth/refresh")
    assert response.status_code == 401


async def test_expired_access_token_on_protected_endpoint(
    app_client: AsyncClient,
    expired_token: str,
) -> None:
    response = await app_client.get("/auth/me", headers=_auth_header(expired_token))
    assert response.status_code == 401


async def test_admin_route_with_admin_token(app_client: AsyncClient, admin_token: str) -> None:
    response = await app_client.get("/auth/admin-only", headers=_auth_header(admin_token))
    assert response.status_code == 200


async def test_admin_route_with_viewer_token(app_client: AsyncClient, viewer_token: str) -> None:
    response = await app_client.get("/auth/admin-only", headers=_auth_header(viewer_token))
    assert response.status_code == 403


async def test_admin_route_with_no_token(app_client: AsyncClient) -> None:
    response = await app_client.get("/auth/admin-only")
    assert response.status_code == 401


async def test_service_token_accepted_on_service_route(
    app_client: AsyncClient,
    service_token: str,
) -> None:
    response = await app_client.get("/auth/service-only", headers=_auth_header(service_token))
    assert response.status_code == 200


async def test_service_token_rejected_on_admin_route(
    app_client: AsyncClient,
    service_token: str,
) -> None:
    response = await app_client.get("/auth/admin-only", headers=_auth_header(service_token))
    assert response.status_code == 403


async def test_logout_revokes_and_clears_cookie(
    app_client: AsyncClient,
    mock_refresh_repo: AsyncMock,
    admin_operator,
) -> None:
    raw_token = "refresh-logout"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    await mock_refresh_repo.create(
        {
            "operator_id": admin_operator.id,
            "token_hash": token_hash,
            "expires_at": datetime.now(UTC) + timedelta(days=1),
            "revoked_at": None,
        }
    )
    app_client.cookies.set("refresh_token", raw_token, path="/auth")

    response = await app_client.post("/auth/logout")
    assert response.status_code == 204
    assert "refresh_token=" in response.headers.get("set-cookie", "")


async def test_login_rate_limit(app_client: AsyncClient) -> None:
    responses = []
    for _ in range(11):
        responses.append(
            await app_client.post(
                "/auth/login",
                data={"username": "unknown@example.com", "password": "wrong"},
            )
        )
    assert responses[-1].status_code == 429
    assert responses[-1].headers.get("Retry-After") is not None


async def test_refresh_rate_limit(app_client: AsyncClient) -> None:
    responses = []
    for _ in range(31):
        responses.append(await app_client.post("/auth/refresh"))
    assert responses[-1].status_code == 429
