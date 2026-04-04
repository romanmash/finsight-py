from __future__ import annotations

import httpx
import pytest
import respx
from telegram_bot.auth import OperatorLookupError, authenticate_operator


@pytest.mark.asyncio()
async def test_authenticate_operator_registered_syncs_chat_id() -> None:
    operator_payload = {
        "operator_id": "3f4cf965-5296-4ff8-b6a9-2db8f2d09bdf",
        "email": "viewer@example.com",
        "role": "viewer",
        "telegram_user_id": 12345,
        "telegram_chat_id": 111,
        "is_active": True,
    }

    with respx.mock(assert_all_called=True) as router:
        router.get("http://api.test/operators", params={"telegram_user_id": 12345}).mock(
            return_value=httpx.Response(200, json=operator_payload)
        )
        router.patch("http://api.test/operators/3f4cf965-5296-4ff8-b6a9-2db8f2d09bdf").mock(
            return_value=httpx.Response(200, json=operator_payload)
        )

        operator = await authenticate_operator(
            telegram_user_id=12345,
            chat_id=999,
            api_base_url="http://api.test",
            service_token="service-token",
        )

    assert operator is not None
    assert operator.email == "viewer@example.com"


@pytest.mark.asyncio()
async def test_authenticate_operator_unregistered_returns_none() -> None:
    with respx.mock(assert_all_called=True) as router:
        router.get("http://api.test/operators", params={"telegram_user_id": 99999}).mock(
            return_value=httpx.Response(404)
        )

        operator = await authenticate_operator(
            telegram_user_id=99999,
            chat_id=999,
            api_base_url="http://api.test",
            service_token="service-token",
        )

    assert operator is None


@pytest.mark.asyncio()
async def test_authenticate_operator_api_unreachable_raises_lookup_error() -> None:
    with respx.mock(assert_all_called=True) as router:
        router.get("http://api.test/operators", params={"telegram_user_id": 12345}).mock(
            side_effect=httpx.ConnectError("connect failed")
        )

        with pytest.raises(OperatorLookupError):
            await authenticate_operator(
                telegram_user_id=12345,
                chat_id=999,
                api_base_url="http://api.test",
                service_token="service-token",
            )
