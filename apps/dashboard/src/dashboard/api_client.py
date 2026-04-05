"""HTTP API client helpers for dashboard callbacks."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

QueryParams = dict[str, str | int | float | bool | None]
BYPASS_TOKEN_SENTINEL = "__dashboard_bypass__"
MISSING_TOKEN_SENTINEL = "__dashboard_missing__"


@dataclass(frozen=True)
class ApiError:
    status_code: int
    message: str


class ApiClient:
    """Typed async HTTP client for dashboard -> api-service communication."""

    def __init__(
        self,
        *,
        api_base_url: str,
        timeout_seconds: float = 10.0,
        auth_bypass_localhost: bool = False,
        bypass_token: str | None = None,
    ) -> None:
        self._api_base_url = api_base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._auth_bypass_localhost = auth_bypass_localhost
        token = (
            bypass_token
            if isinstance(bypass_token, str)
            else os.getenv("DASHBOARD_BYPASS_TOKEN", "")
        )
        self._bypass_token = token.strip()
        self._cookies: httpx.Cookies = httpx.Cookies()

    def _headers(self, access_token: str | None) -> dict[str, str]:
        if access_token == BYPASS_TOKEN_SENTINEL:
            if self._auth_bypass_localhost and self._bypass_token:
                return {
                    "X-Dashboard-Bypass": "1",
                    "X-Dashboard-Bypass-Token": self._bypass_token,
                }
            return {}

        if access_token is None or access_token == MISSING_TOKEN_SENTINEL:
            return {}

        return {"Authorization": f"Bearer {access_token}"}

    async def _request_json(
        self,
        *,
        method: str,
        path: str,
        access_token: str | None,
        params: QueryParams | None = None,
        json_body: dict[str, object] | None = None,
        form_body: dict[str, str] | None = None,
    ) -> dict[str, Any] | list[Any] | ApiError:
        url = f"{self._api_base_url}{path}"
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds, cookies=self._cookies
            ) as client:
                response = await client.request(
                    method,
                    url,
                    headers=self._headers(access_token),
                    params=params,
                    json=json_body,
                    data=form_body,
                )
        except httpx.HTTPError as exc:
            return ApiError(status_code=503, message=f"API unavailable: {exc}")

        self._cookies.update(response.cookies)

        if response.status_code >= 400:
            return ApiError(status_code=response.status_code, message=response.text)

        if response.status_code == 204:
            return {}

        try:
            payload = response.json()
        except ValueError:
            return ApiError(status_code=502, message="Invalid JSON response")
        if isinstance(payload, (dict, list)):
            return payload
        return ApiError(status_code=502, message="Unexpected response payload")

    async def login(self, *, username: str, password: str) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="POST",
            path="/auth/login",
            access_token=None,
            form_body={
                "username": username,
                "password": password,
                "grant_type": "password",
            },
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected login payload")

    async def logout(self, *, access_token: str | None) -> ApiError | None:
        payload = await self._request_json(
            method="POST",
            path="/auth/logout",
            access_token=access_token,
        )
        self._cookies.clear()
        if isinstance(payload, ApiError):
            return payload
        return None

    async def get_me(self, *, access_token: str | None) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path="/auth/me",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected me payload")

    async def get_missions(
        self,
        *,
        status_filter: str | None,
        limit: int,
        offset: int,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        params: QueryParams = {"limit": limit, "offset": max(0, offset)}
        if status_filter is not None:
            params["status"] = status_filter
        payload = await self._request_json(
            method="GET",
            path="/missions",
            access_token=access_token,
            params=params,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected mission list payload")

    async def get_mission(
        self,
        mission_id: str,
        *,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path=f"/missions/{mission_id}",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected mission payload")

    async def get_watchlist(self, *, access_token: str | None) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path="/watchlist",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected watchlist payload")

    async def upsert_watchlist_item(
        self,
        data: dict[str, object],
        *,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        item_id = data.get("id")
        if isinstance(item_id, str) and item_id:
            path = f"/watchlist/{item_id}"
            method = "PATCH"
            payload_body = {key: value for key, value in data.items() if key != "id"}
        else:
            path = "/watchlist"
            method = "POST"
            payload_body = data

        payload = await self._request_json(
            method=method,
            path=path,
            access_token=access_token,
            json_body=payload_body,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected watchlist upsert payload")

    async def delete_watchlist_item(
        self,
        item_id: str,
        *,
        access_token: str | None,
    ) -> ApiError | None:
        result = await self._request_json(
            method="DELETE",
            path=f"/watchlist/{item_id}",
            access_token=access_token,
        )
        if isinstance(result, ApiError):
            return result
        return None

    async def get_kb_entries(
        self,
        *,
        query: str,
        page: int,
        page_size: int,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path="/knowledge",
            access_token=access_token,
            params={"query": query, "limit": page_size, "offset": max(0, page * page_size)},
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected knowledge payload")

    async def get_alerts(
        self,
        *,
        unacknowledged_only: bool,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path="/alerts",
            access_token=access_token,
            params={"unacknowledged_only": str(unacknowledged_only).lower(), "limit": 100},
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected alerts payload")

    async def acknowledge_alert(
        self,
        alert_id: str,
        *,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="POST",
            path=f"/alerts/{alert_id}/acknowledge",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected alert acknowledgement payload")

    async def get_dashboard_overview(
        self, *, access_token: str | None
    ) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path="/dashboard/overview",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected dashboard overview payload")

    async def get_health(self, *, access_token: str | None) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="GET",
            path="/dashboard/health",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected health payload")

    async def refresh_access_token(
        self,
        *,
        access_token: str | None,
    ) -> dict[str, Any] | ApiError:
        payload = await self._request_json(
            method="POST",
            path="/auth/refresh",
            access_token=access_token,
        )
        if isinstance(payload, dict):
            return payload
        if isinstance(payload, ApiError):
            return payload
        return ApiError(status_code=502, message="Unexpected refresh payload")

