"""Create debug_reader role with read-only grants.

Revision ID: 20260406_0005
Revises: 20260405_0004
Create Date: 2026-04-06 14:30:00
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.url import make_url

# revision identifiers, used by Alembic.
revision = "20260406_0005"
down_revision = "20260405_0004"
branch_labels = None
depends_on = None


def _quoted(value: str) -> str:
    return value.replace("'", "''")


def _quote_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _target_database_name() -> str:
    candidates = [
        os.getenv("DATABASE_URL", "").strip(),
        os.getenv("DEBUG_DB_URL", "").strip(),
    ]
    for candidate in candidates:
        if not candidate:
            continue
        normalized = candidate.replace("postgresql+asyncpg://", "postgresql://", 1)
        try:
            database = make_url(normalized).database
        except Exception:
            continue
        if database:
            return database
    return "finsight"


def upgrade() -> None:
    password = os.getenv("DEBUG_DB_PASSWORD", "").strip()
    if not password:
        raise RuntimeError("DEBUG_DB_PASSWORD is required for migration 20260406_0005")

    escaped = _quoted(password)
    database_name = _quote_ident(_target_database_name())

    op.execute(
        sa.text(
            f"""
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'debug_reader') THEN
                CREATE ROLE debug_reader WITH LOGIN PASSWORD '{escaped}';
              ELSE
                ALTER ROLE debug_reader WITH LOGIN PASSWORD '{escaped}';
              END IF;
            END $$;
            """
        )
    )
    op.execute(sa.text(f"GRANT CONNECT ON DATABASE {database_name} TO debug_reader;"))
    op.execute(sa.text("GRANT USAGE ON SCHEMA public TO debug_reader;"))
    op.execute(sa.text("GRANT SELECT ON ALL TABLES IN SCHEMA public TO debug_reader;"))
    op.execute(
        sa.text("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO debug_reader;")
    )


def downgrade() -> None:
    database_name = _quote_ident(_target_database_name())
    op.execute(
        sa.text(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM "
            "debug_reader;"
        )
    )
    op.execute(sa.text("REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM debug_reader;"))
    op.execute(sa.text("REVOKE USAGE ON SCHEMA public FROM debug_reader;"))
    op.execute(sa.text(f"REVOKE CONNECT ON DATABASE {database_name} FROM debug_reader;"))
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'debug_reader') THEN
                DROP ROLE debug_reader;
              END IF;
            END $$;
            """
        )
    )
