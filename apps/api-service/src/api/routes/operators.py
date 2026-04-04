"""Operator service routes used by Telegram integration and admins."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.lib.auth import TokenPayload, require_role
from api.routes.auth import OperatorLike, OperatorRepositoryLike, get_operator_repo

router = APIRouter()
_service_or_admin_dependency = require_role("service", "admin")
ServiceOrAdminOperator = Annotated[TokenPayload, Depends(_service_or_admin_dependency)]


class PatchOperatorPayload(BaseModel):
    telegram_chat_id: int


def _serialize_operator(operator: OperatorLike) -> dict[str, Any]:
    return {
        "operator_id": str(operator.id),
        "email": operator.email,
        "role": operator.role,
        "telegram_user_id": operator.telegram_user_id,
        "telegram_chat_id": operator.telegram_chat_id,
        "is_active": operator.is_active,
    }


@router.get("")
async def get_operator_by_telegram_user_id(
    telegram_user_id: Annotated[int, Query(...)],
    _: ServiceOrAdminOperator,
    operator_repo: Annotated[OperatorRepositoryLike, Depends(get_operator_repo)],
) -> dict[str, Any]:
    operator = await operator_repo.get_by_telegram_user_id(telegram_user_id)
    if operator is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")
    return _serialize_operator(operator)


@router.patch("/{operator_id}")
async def patch_operator_telegram_chat_id(
    operator_id: UUID,
    payload: PatchOperatorPayload,
    _: ServiceOrAdminOperator,
    operator_repo: Annotated[OperatorRepositoryLike, Depends(get_operator_repo)],
) -> dict[str, Any]:
    updated = await operator_repo.update(
        operator_id,
        {"telegram_chat_id": payload.telegram_chat_id},
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found")
    return _serialize_operator(updated)
