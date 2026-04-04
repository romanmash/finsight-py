"""Runtime wiring check for auth repositories without mock overrides."""

from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


async def test_login_works_with_real_repository_wiring(app_client: AsyncClient) -> None:
    from api.db.base import Base
    from api.db.models.operator import OperatorORM
    from api.lib.auth import hash_password
    from api.lib.db import get_session
    from api.main import app
    from api.routes.auth import get_operator_repo, get_refresh_token_repo

    engine = create_async_engine("sqlite+aiosqlite:///./.cache/tests/auth-runtime.db", future=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as seed_session:
        seed_session.add(
            OperatorORM(
                id=uuid4(),
                email="runtime-admin@example.com",
                password_hash=hash_password("runtime-pass"),
                role="admin",
                is_active=True,
                telegram_user_id=999,
                telegram_chat_id=999,
            )
        )
        await seed_session.commit()

    async def test_session_override() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides.pop(get_operator_repo, None)
    app.dependency_overrides.pop(get_refresh_token_repo, None)
    app.dependency_overrides[get_session] = test_session_override
    try:
        response = await app_client.post(
            "/auth/login",
            data={"username": "runtime-admin@example.com", "password": "runtime-pass"},
        )
        assert response.status_code == 200
        assert response.json()["role"] == "admin"
    finally:
        app.dependency_overrides.pop(get_session, None)
        await engine.dispose()
