"""Create knowledge_entries table for reasoning agents.

Revision ID: 20260404_0002
Revises: 20260404_0001
Create Date: 2026-04-04 22:30:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260404_0002"
down_revision = "20260404_0001"
branch_labels = None
depends_on = None

_MIGRATION_STATE_TABLE = "finsight_migration_state"


def _index_exists(inspector: sa.Inspector, table: str, name: str) -> bool:
    return any(index.get("name") == name for index in inspector.get_indexes(table))


def _unique_constraint_exists(inspector: sa.Inspector, table: str, name: str) -> bool:
    return any(
        constraint.get("name") == name for constraint in inspector.get_unique_constraints(table)
    )


def _column_exists(columns: set[str], name: str) -> bool:
    return name in columns


def _has_duplicate_non_null_content_hashes(bind: sa.Connection) -> bool:
    query = sa.text(
        """
        SELECT 1
        FROM knowledge_entries
        WHERE content_hash IS NOT NULL
        GROUP BY content_hash
        HAVING COUNT(*) > 1
        LIMIT 1
        """
    )
    return bind.execute(query).scalar() is not None


def _nullify_duplicate_content_hashes(bind: sa.Connection) -> None:
    bind.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY content_hash
                        ORDER BY
                            CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END,
                            updated_at DESC,
                            CASE WHEN created_at IS NULL THEN 1 ELSE 0 END,
                            created_at DESC,
                            id DESC
                    ) AS row_number
                FROM knowledge_entries
                WHERE content_hash IS NOT NULL
            )
            UPDATE knowledge_entries
            SET content_hash = NULL
            WHERE id IN (
                SELECT id FROM ranked WHERE row_number > 1
            )
            """
        )
    )


def _ensure_state_table(bind: sa.Connection) -> None:
    inspector = sa.inspect(bind)
    if inspector.has_table(_MIGRATION_STATE_TABLE):
        return
    op.create_table(
        _MIGRATION_STATE_TABLE,
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("created_table", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("revision_id"),
    )


def _write_state(bind: sa.Connection, created_table: bool) -> None:
    _ensure_state_table(bind)
    bind.execute(
        sa.text(f"DELETE FROM {_MIGRATION_STATE_TABLE} WHERE revision_id = :revision_id"),
        {"revision_id": revision},
    )
    bind.execute(
        sa.text(
            f"""
            INSERT INTO {_MIGRATION_STATE_TABLE} (revision_id, created_table)
            VALUES (:revision_id, :created_table)
            """
        ),
        {"revision_id": revision, "created_table": created_table},
    )


def _read_created_table_state(bind: sa.Connection) -> bool | None:
    inspector = sa.inspect(bind)
    if not inspector.has_table(_MIGRATION_STATE_TABLE):
        return None
    value = bind.execute(
        sa.text(
            f"""
            SELECT created_table
            FROM {_MIGRATION_STATE_TABLE}
            WHERE revision_id = :revision_id
            """
        ),
        {"revision_id": revision},
    ).scalar()
    if value is None:
        return None
    return bool(value)


def _clear_state(bind: sa.Connection) -> None:
    inspector = sa.inspect(bind)
    if not inspector.has_table(_MIGRATION_STATE_TABLE):
        return
    bind.execute(
        sa.text(f"DELETE FROM {_MIGRATION_STATE_TABLE} WHERE revision_id = :revision_id"),
        {"revision_id": revision},
    )
    remaining = bind.execute(sa.text(f"SELECT 1 FROM {_MIGRATION_STATE_TABLE} LIMIT 1")).scalar()
    if remaining is None:
        op.drop_table(_MIGRATION_STATE_TABLE)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    has_table = inspector.has_table("knowledge_entries")

    if not has_table:
        op.create_table(
            "knowledge_entries",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("ticker", sa.String(length=16), nullable=True),
            sa.Column("entry_type", sa.String(length=32), nullable=True),
            sa.Column("content_summary", sa.String(length=4096), nullable=True),
            sa.Column("content_hash", sa.String(length=64), nullable=True),
            sa.Column("content", sa.String(length=4096), nullable=False),
            sa.Column("source_type", sa.String(length=64), nullable=True),
            sa.Column("author_agent", sa.String(length=64), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=False),
            sa.Column("tickers", sa.JSON(), nullable=False),
            sa.Column("tags", sa.JSON(), nullable=False),
            sa.Column("embedding", sa.JSON(), nullable=True),
            sa.Column("freshness_date", sa.Date(), nullable=True),
            sa.Column("freshness_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("provenance_history", sa.JSON(), nullable=False),
            sa.Column("conflict_markers", sa.JSON(), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("content_hash", name="uq_knowledge_entries_content_hash"),
        )
    else:
        existing_columns = {
            str(column["name"]) for column in inspector.get_columns("knowledge_entries")
        }
        if not _column_exists(existing_columns, "ticker"):
            op.add_column(
                "knowledge_entries",
                sa.Column("ticker", sa.String(length=16), nullable=True),
            )
        if not _column_exists(existing_columns, "entry_type"):
            op.add_column(
                "knowledge_entries",
                sa.Column("entry_type", sa.String(length=32), nullable=True),
            )
        if not _column_exists(existing_columns, "content_summary"):
            op.add_column(
                "knowledge_entries",
                sa.Column("content_summary", sa.String(length=4096), nullable=True),
            )
        if not _column_exists(existing_columns, "content_hash"):
            op.add_column(
                "knowledge_entries",
                sa.Column("content_hash", sa.String(length=64), nullable=True),
            )
        if not _column_exists(existing_columns, "content"):
            op.add_column(
                "knowledge_entries",
                sa.Column("content", sa.String(length=4096), nullable=True),
            )
        if not _column_exists(existing_columns, "source_type"):
            op.add_column(
                "knowledge_entries",
                sa.Column("source_type", sa.String(length=64), nullable=True),
            )
        if not _column_exists(existing_columns, "author_agent"):
            op.add_column(
                "knowledge_entries",
                sa.Column("author_agent", sa.String(length=64), nullable=True),
            )
        if not _column_exists(existing_columns, "tickers"):
            op.add_column(
                "knowledge_entries",
                sa.Column("tickers", sa.JSON(), nullable=True),
            )
        if not _column_exists(existing_columns, "freshness_date"):
            op.add_column(
                "knowledge_entries",
                sa.Column("freshness_date", sa.Date(), nullable=True),
            )
        if not _column_exists(existing_columns, "freshness_at"):
            op.add_column(
                "knowledge_entries",
                sa.Column("freshness_at", sa.DateTime(timezone=True), nullable=True),
            )
        if not _column_exists(existing_columns, "provenance_history"):
            op.add_column(
                "knowledge_entries",
                sa.Column("provenance_history", sa.JSON(), nullable=True),
            )
        if not _column_exists(existing_columns, "conflict_markers"):
            op.add_column(
                "knowledge_entries",
                sa.Column("conflict_markers", sa.JSON(), nullable=True),
            )
        if not _column_exists(existing_columns, "deleted_at"):
            op.add_column(
                "knowledge_entries",
                sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            )
        if not _column_exists(existing_columns, "updated_at"):
            op.add_column(
                "knowledge_entries",
                sa.Column(
                    "updated_at",
                    sa.DateTime(timezone=True),
                    nullable=False,
                    server_default=sa.text("CURRENT_TIMESTAMP"),
                ),
            )
        if not _column_exists(existing_columns, "created_at"):
            op.add_column(
                "knowledge_entries",
                sa.Column(
                    "created_at",
                    sa.DateTime(timezone=True),
                    nullable=False,
                    server_default=sa.text("CURRENT_TIMESTAMP"),
                ),
            )

    _write_state(bind, created_table=not has_table)

    inspector = sa.inspect(bind)
    has_unique_constraint = _unique_constraint_exists(
        inspector,
        "knowledge_entries",
        "uq_knowledge_entries_content_hash",
    )
    has_unique_index = any(
        index.get("name") == "uq_knowledge_entries_content_hash_idx" and bool(index.get("unique"))
        for index in inspector.get_indexes("knowledge_entries")
    )
    if not has_unique_constraint and not has_unique_index:
        if _has_duplicate_non_null_content_hashes(bind):
            _nullify_duplicate_content_hashes(bind)
        op.create_index(
            "uq_knowledge_entries_content_hash_idx",
            "knowledge_entries",
            ["content_hash"],
            unique=True,
        )

    inspector = sa.inspect(bind)
    if not _index_exists(inspector, "knowledge_entries", "ix_knowledge_entries_ticker"):
        op.create_index(
            "ix_knowledge_entries_ticker",
            "knowledge_entries",
            ["ticker"],
            unique=False,
        )
    if not _index_exists(inspector, "knowledge_entries", "ix_knowledge_entries_entry_type"):
        op.create_index(
            "ix_knowledge_entries_entry_type",
            "knowledge_entries",
            ["entry_type"],
            unique=False,
        )
    if not _index_exists(inspector, "knowledge_entries", "ix_knowledge_entries_content_hash"):
        op.create_index(
            "ix_knowledge_entries_content_hash",
            "knowledge_entries",
            ["content_hash"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    created_table = _read_created_table_state(bind)

    if inspector.has_table("knowledge_entries"):
        if created_table:
            op.drop_table("knowledge_entries")
            _clear_state(bind)
            return
        if _index_exists(inspector, "knowledge_entries", "uq_knowledge_entries_content_hash_idx"):
            op.drop_index("uq_knowledge_entries_content_hash_idx", table_name="knowledge_entries")
        if _index_exists(inspector, "knowledge_entries", "ix_knowledge_entries_content_hash"):
            op.drop_index("ix_knowledge_entries_content_hash", table_name="knowledge_entries")
        if _index_exists(inspector, "knowledge_entries", "ix_knowledge_entries_entry_type"):
            op.drop_index("ix_knowledge_entries_entry_type", table_name="knowledge_entries")
        if _index_exists(inspector, "knowledge_entries", "ix_knowledge_entries_ticker"):
            op.drop_index("ix_knowledge_entries_ticker", table_name="knowledge_entries")

    _clear_state(bind)
