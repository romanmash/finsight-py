"""Authentication routes."""

from __future__ import annotations

import hashlib
import os
import secrets
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Annotated, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.repositories.operator import OperatorRepository
from api.db.repositories.refresh_token import RefreshTokenRepository
from api.lib.auth import (
    TokenPayload,
    create_access_token,
    get_current_operator,
    require_role,
    verify_password,
)
from api.lib.config import get_settings, load_all_configs
from api.lib.db import get_session

router = APIRouter()


def _limiter_storage_uri() -> str:
    if os.getenv("ENVIRONMENT", "dev") == "test":
        return "memory://"
    return get_settings().redis_url


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_limiter_storage_uri(),
    headers_enabled=True,
)
_config = load_all_configs().api
_admin_role_dependency = require_role("admin")
_service_role_dependency = require_role("service")
_service_or_admin_dependency = require_role("service", "admin")

CurrentOperator = Annotated[TokenPayload, Depends(get_current_operator)]
AdminOperator = Annotated[TokenPayload, Depends(_admin_role_dependency)]
ServiceOperator = Annotated[TokenPayload, Depends(_service_role_dependency)]
ServiceOrAdminOperator = Annotated[TokenPayload, Depends(_service_or_admin_dependency)]
OperatorForm = Annotated[OAuth2PasswordRequestForm, Depends()]


class OperatorLike(Protocol):
    id: UUID
    email: str
    role: str
    is_active: bool
    password_hash: str
    telegram_user_id: int | None
    telegram_chat_id: int | None


class OperatorRepositoryLike(Protocol):
    async def get_by_email(self, email: str) -> OperatorLike | None: ...

    async def get_by_id(self, operator_id: UUID) -> OperatorLike | None: ...

    async def get_by_telegram_user_id(self, user_id: int) -> OperatorLike | None: ...

    async def update(
        self,
        operator_id: UUID,
        data: Mapping[str, int | str | None],
    ) -> OperatorLike | None: ...


class RefreshTokenRecord(Protocol):
    id: UUID
    operator_id: UUID
    token_hash: str
    expires_at: datetime
    revoked_at: datetime | None


class RefreshTokenRepositoryLike(Protocol):
    async def create(self, data: Mapping[str, object]) -> RefreshTokenRecord: ...

    async def get_by_hash(self, token_hash: str) -> RefreshTokenRecord | None: ...

    async def revoke(self, token_id: UUID) -> None: ...


def get_operator_repo(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> OperatorRepositoryLike:
    return OperatorRepository(session)


def get_refresh_token_repo(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RefreshTokenRepositoryLike:
    return RefreshTokenRepository(session)


def _hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _set_refresh_cookie(response: Response, raw_refresh_token: str) -> None:
    expires_at = datetime.now(UTC) + timedelta(days=_config.refresh_token_ttl_days)
    max_age = _config.refresh_token_ttl_days * 24 * 60 * 60
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/auth",
        max_age=max_age,
        expires=expires_at,
    )


@router.post("/login")
@limiter.limit(_config.rate_limit_login)
async def login(
    request: Request,
    response: Response,
    form_data: OperatorForm,
    operator_repo: Annotated[OperatorRepositoryLike, Depends(get_operator_repo)],
    refresh_repo: Annotated[RefreshTokenRepositoryLike, Depends(get_refresh_token_repo)],
) -> dict[str, str]:
    del request
    operator = await operator_repo.get_by_email(form_data.username)
    if operator is None or not verify_password(form_data.password, operator.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not operator.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    raw_refresh = secrets.token_hex(32)
    refresh_hash = _hash_refresh_token(raw_refresh)
    expires_at = datetime.now(UTC) + timedelta(days=_config.refresh_token_ttl_days)
    await refresh_repo.create(
        {
            "operator_id": operator.id,
            "token_hash": refresh_hash,
            "expires_at": expires_at,
            "revoked_at": None,
        }
    )

    access_token = create_access_token(
        sub=str(operator.id),
        role=operator.role,
        ttl_minutes=_config.access_token_ttl_minutes,
    )
    _set_refresh_cookie(response, raw_refresh)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "operator_id": str(operator.id),
        "role": operator.role,
    }


@router.post("/refresh")
@limiter.limit(_config.rate_limit_refresh)
async def refresh(
    request: Request,
    response: Response,
    refresh_repo: Annotated[RefreshTokenRepositoryLike, Depends(get_refresh_token_repo)],
    operator_repo: Annotated[OperatorRepositoryLike, Depends(get_operator_repo)],
) -> dict[str, str]:
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    refresh_hash = _hash_refresh_token(raw_refresh)
    token_record = await refresh_repo.get_by_hash(refresh_hash)
    if token_record is None or token_record.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    if token_record.expires_at <= datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    operator = await operator_repo.get_by_id(token_record.operator_id)
    if operator is None or not operator.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    await refresh_repo.revoke(token_record.id)

    new_raw_refresh = secrets.token_hex(32)
    new_refresh_hash = _hash_refresh_token(new_raw_refresh)
    new_expires_at = datetime.now(UTC) + timedelta(days=_config.refresh_token_ttl_days)
    await refresh_repo.create(
        {
            "operator_id": operator.id,
            "token_hash": new_refresh_hash,
            "expires_at": new_expires_at,
            "revoked_at": None,
        }
    )

    access_token = create_access_token(
        sub=str(operator.id),
        role=operator.role,
        ttl_minutes=_config.access_token_ttl_minutes,
    )
    _set_refresh_cookie(response, new_raw_refresh)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    refresh_repo: Annotated[RefreshTokenRepositoryLike, Depends(get_refresh_token_repo)],
) -> Response:
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh is not None:
        token_record = await refresh_repo.get_by_hash(_hash_refresh_token(raw_refresh))
        if token_record is not None:
            await refresh_repo.revoke(token_record.id)

    response.delete_cookie(
        key="refresh_token",
        path="/auth",
        secure=True,
        samesite="strict",
        httponly=True,
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me")
async def me(payload: CurrentOperator) -> dict[str, str]:
    return {"operator_id": payload.sub, "role": payload.role}


@router.get("/admin-only", include_in_schema=False)
async def admin_only(_: AdminOperator) -> dict[str, bool]:
    return {"ok": True}


@router.get("/service-only", include_in_schema=False)
async def service_only(_: ServiceOperator) -> dict[str, bool]:
    return {"ok": True}
