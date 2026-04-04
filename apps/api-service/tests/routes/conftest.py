"""Route test fixtures."""

from __future__ import annotations

import hashlib
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from api.lib.auth import create_access_token, hash_password
from api.lib.config import get_settings
from httpx import ASGITransport, AsyncClient


@dataclass
class MockOperator:
    id: UUID
    email: str
    role: str
    is_active: bool
    password_hash: str
    telegram_user_id: int | None = None
    telegram_chat_id: int | None = None


@dataclass
class MockRefreshToken:
    id: UUID
    operator_id: UUID
    token_hash: str
    expires_at: datetime
    revoked_at: datetime | None


@pytest.fixture(autouse=True)
def auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    Path(".cache/tests").mkdir(parents=True, exist_ok=True)
    get_settings.cache_clear()
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./.cache/tests/route-tests.db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("ENVIRONMENT", "test")


@pytest.fixture()
def admin_operator() -> MockOperator:
    return MockOperator(
        id=uuid4(),
        email="admin@example.com",
        role="admin",
        is_active=True,
        password_hash=hash_password("admin-pass"),
        telegram_user_id=111,
        telegram_chat_id=111,
    )


@pytest.fixture()
def viewer_operator() -> MockOperator:
    return MockOperator(
        id=uuid4(),
        email="viewer@example.com",
        role="viewer",
        is_active=True,
        password_hash=hash_password("viewer-pass"),
        telegram_user_id=222,
        telegram_chat_id=222,
    )


@pytest.fixture()
def mock_operator_repo(admin_operator: MockOperator, viewer_operator: MockOperator) -> AsyncMock:
    repo = AsyncMock()

    async def get_by_email(email: str) -> MockOperator | None:
        if email == admin_operator.email:
            return admin_operator
        if email == viewer_operator.email:
            return viewer_operator
        return None

    async def get_by_id(operator_id: UUID) -> MockOperator | None:
        if operator_id == admin_operator.id:
            return admin_operator
        if operator_id == viewer_operator.id:
            return viewer_operator
        return None

    async def get_by_telegram_user_id(user_id: int) -> MockOperator | None:
        if user_id == admin_operator.telegram_user_id:
            return admin_operator
        if user_id == viewer_operator.telegram_user_id:
            return viewer_operator
        return None

    async def update(
        operator_id: UUID,
        data: Mapping[str, int | str | None],
    ) -> MockOperator | None:
        operator = await get_by_id(operator_id)
        if operator is None:
            return None
        new_value = data.get("telegram_chat_id")
        if isinstance(new_value, int):
            operator.telegram_chat_id = new_value
        return operator

    repo.get_by_email.side_effect = get_by_email
    repo.get_by_id.side_effect = get_by_id
    repo.get_by_telegram_user_id.side_effect = get_by_telegram_user_id
    repo.update.side_effect = update
    return repo


@pytest.fixture()
def mock_refresh_repo(admin_operator: MockOperator) -> AsyncMock:
    repo = AsyncMock()
    store: dict[str, MockRefreshToken] = {}

    async def create(data: Mapping[str, object]) -> MockRefreshToken:
        operator_id = data.get("operator_id")
        token_hash = data.get("token_hash")
        expires_at = data.get("expires_at")
        revoked_at = data.get("revoked_at")
        if not isinstance(operator_id, UUID):
            raise TypeError("operator_id must be UUID")
        if not isinstance(token_hash, str):
            raise TypeError("token_hash must be str")
        if not isinstance(expires_at, datetime):
            raise TypeError("expires_at must be datetime")
        record = MockRefreshToken(
            id=uuid4(),
            operator_id=operator_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked_at=revoked_at if isinstance(revoked_at, datetime) else None,
        )
        store[record.token_hash] = record
        return record

    async def get_by_hash(token_hash: str) -> MockRefreshToken | None:
        return store.get(token_hash)

    async def revoke(token_id: UUID) -> None:
        for record in store.values():
            if record.id == token_id:
                record.revoked_at = datetime.now(UTC)
                return

    seed_raw = "seed-refresh"
    seed_hash = hashlib.sha256(seed_raw.encode("utf-8")).hexdigest()
    seed = MockRefreshToken(
        id=uuid4(),
        operator_id=admin_operator.id,
        token_hash=seed_hash,
        expires_at=datetime.now(UTC) + timedelta(days=1),
        revoked_at=None,
    )
    store[seed.token_hash] = seed

    repo.create.side_effect = create
    repo.get_by_hash.side_effect = get_by_hash
    repo.revoke.side_effect = revoke
    return repo


@pytest.fixture(autouse=True)
def override_repositories(
    auth_env: None,
    mock_operator_repo: AsyncMock,
    mock_refresh_repo: AsyncMock,
) -> AsyncIterator[None]:
    from api.main import app
    from api.routes import auth as auth_routes
    from api.routes import operators as operators_routes

    app.dependency_overrides[auth_routes.get_operator_repo] = lambda: mock_operator_repo
    app.dependency_overrides[auth_routes.get_refresh_token_repo] = lambda: mock_refresh_repo
    app.dependency_overrides[operators_routes.get_operator_repo] = lambda: mock_operator_repo
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    from api.routes import auth as auth_routes

    storage = getattr(auth_routes.limiter, "_storage", None)
    reset_fn = getattr(storage, "reset", None)
    if callable(reset_fn):
        reset_fn()


@pytest.fixture()
async def app_client() -> AsyncIterator[AsyncClient]:
    from api.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture()
def admin_token(admin_operator: MockOperator) -> str:
    return create_access_token(sub=str(admin_operator.id), role="admin", ttl_minutes=15)


@pytest.fixture()
def viewer_token(viewer_operator: MockOperator) -> str:
    return create_access_token(sub=str(viewer_operator.id), role="viewer", ttl_minutes=15)


@pytest.fixture()
def expired_token(admin_operator: MockOperator) -> str:
    return create_access_token(sub=str(admin_operator.id), role="admin", ttl_minutes=-1)


@pytest.fixture()
def service_token() -> str:
    return create_access_token(sub="service:telegram-bot", role="service", ttl_minutes=15)
