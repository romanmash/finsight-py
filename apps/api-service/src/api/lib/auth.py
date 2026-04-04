"""Auth and JWT helper functions."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated, cast

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt  # type: ignore[import-untyped]
from passlib.context import CryptContext  # type: ignore[import-untyped]
from pydantic import BaseModel, ValidationError

from api.lib.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class TokenPayload(BaseModel):
    sub: str
    role: str
    exp: int
    iat: int


def create_access_token(sub: str, role: str, ttl_minutes: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=ttl_minutes)
    payload = {
        "sub": sub,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    return cast(str, token)


def decode_access_token(token: str) -> TokenPayload:
    settings = get_settings()
    try:
        payload = cast(
            dict[str, str | int],
            jwt.decode(token, settings.secret_key, algorithms=["HS256"]),
        )
        return TokenPayload.model_validate(payload)
    except (JWTError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc


def hash_password(plain: str) -> str:
    return cast(str, pwd_context.hash(plain))


def verify_password(plain: str, hashed: str) -> bool:
    return cast(bool, pwd_context.verify(plain, hashed))


async def get_current_operator(token: Annotated[str, Depends(oauth2_scheme)]) -> TokenPayload:
    return decode_access_token(token)


CurrentOperator = Annotated[TokenPayload, Depends(get_current_operator)]
RoleDependency = Callable[[TokenPayload], Awaitable[TokenPayload]]


def require_role(*roles: str) -> RoleDependency:
    allowed = {"admin", "viewer", "service"}
    invalid = [role for role in roles if role not in allowed]
    if invalid:
        raise ValueError(f"Invalid roles: {invalid}")

    async def _dependency(payload: CurrentOperator) -> TokenPayload:
        if payload.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return payload

    return _dependency
