"""Seed entrypoint for demo data."""

from __future__ import annotations

import asyncio
import os
from typing import Final

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.lib.auth import create_access_token
from api.seeds.alerts import seed_alerts
from api.seeds.knowledge import seed_knowledge
from api.seeds.missions import seed_missions
from api.seeds.operators import seed_operators
from api.seeds.watchlist import seed_watchlist

_SERVICE_SUBJECT: Final[str] = "service:telegram-bot"
_SERVICE_ROLE: Final[str] = "service"
_SERVICE_TTL_MINUTES: Final[int] = 365 * 24 * 60


async def seed(session: AsyncSession) -> None:
    """Populate the database with deterministic demo records."""
    await seed_operators(session)
    await seed_watchlist(session)
    await seed_missions(session)
    await seed_knowledge(session)
    await seed_alerts(session)


async def main() -> None:
    """Run seeders against DATABASE_URL and print service token for .env."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    engine = create_async_engine(database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_factory() as session:
            await seed(session)
            await session.commit()
        token = create_access_token(
            sub=_SERVICE_SUBJECT,
            role=_SERVICE_ROLE,
            ttl_minutes=_SERVICE_TTL_MINUTES,
        )
        print(f"TELEGRAM_SERVICE_TOKEN={token}")
    finally:
        await engine.dispose()


def run() -> None:
    """Console script wrapper."""
    asyncio.run(main())


if __name__ == "__main__":
    run()
