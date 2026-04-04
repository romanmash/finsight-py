"""Operator authentication via api-service routes."""

from __future__ import annotations

from uuid import UUID

import httpx
import structlog
from pydantic import BaseModel, ValidationError

logger = structlog.get_logger(__name__)


class OperatorLookupError(RuntimeError):
    """Raised when operator lookup cannot be completed reliably."""


class TelegramOperator(BaseModel):
    """Operator projection used by telegram-bot."""

    operator_id: UUID
    email: str
    role: str
    telegram_user_id: int | None
    telegram_chat_id: int | None
    is_active: bool


def _auth_headers(service_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {service_token}"}


async def _sync_chat_id(
    *,
    operator_id: UUID,
    chat_id: int,
    api_base_url: str,
    service_token: str,
    timeout_seconds: float,
) -> None:
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.patch(
            f"{api_base_url}/operators/{operator_id}",
            headers=_auth_headers(service_token),
            json={"telegram_chat_id": chat_id},
        )
    response.raise_for_status()


async def authenticate_operator(
    *,
    telegram_user_id: int,
    chat_id: int,
    api_base_url: str,
    service_token: str,
    timeout_seconds: float = 10.0,
) -> TelegramOperator | None:
    """Resolve operator by Telegram user id and keep chat binding in sync."""
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(
                f"{api_base_url}/operators",
                headers=_auth_headers(service_token),
                params={"telegram_user_id": telegram_user_id},
            )
    except httpx.HTTPError as exc:
        logger.warning("operator_lookup_failed", telegram_user_id=telegram_user_id)
        raise OperatorLookupError("operator lookup failed") from exc

    if response.status_code == 404:
        return None
    if response.status_code != 200:
        logger.warning(
            "operator_lookup_unexpected_status",
            telegram_user_id=telegram_user_id,
            status_code=response.status_code,
        )
        raise OperatorLookupError("operator lookup returned unexpected status")

    try:
        operator = TelegramOperator.model_validate(response.json())
    except ValidationError as exc:
        logger.warning("operator_lookup_invalid_payload", telegram_user_id=telegram_user_id)
        raise OperatorLookupError("operator lookup returned invalid payload") from exc

    if not operator.is_active:
        return None

    if operator.telegram_chat_id != chat_id:
        try:
            await _sync_chat_id(
                operator_id=operator.operator_id,
                chat_id=chat_id,
                api_base_url=api_base_url,
                service_token=service_token,
                timeout_seconds=timeout_seconds,
            )
        except httpx.HTTPError:
            logger.warning(
                "operator_chat_id_sync_failed",
                operator_id=str(operator.operator_id),
                chat_id=chat_id,
            )

    return operator


__all__ = ["OperatorLookupError", "TelegramOperator", "authenticate_operator"]
