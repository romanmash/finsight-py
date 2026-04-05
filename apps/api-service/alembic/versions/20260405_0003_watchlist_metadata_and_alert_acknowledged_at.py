"""Add watchlist metadata fields and alert acknowledged timestamp.

Revision ID: 20260405_0003
Revises: 20260404_0002
Create Date: 2026-04-05 18:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260405_0003"
down_revision = "20260404_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("watchlist_items"):
        watchlist_columns = {
            column["name"] for column in inspector.get_columns("watchlist_items")
        }
        if "name" not in watchlist_columns:
            op.add_column(
                "watchlist_items",
                sa.Column("name", sa.String(length=128), nullable=True),
            )
        if "sector" not in watchlist_columns:
            op.add_column(
                "watchlist_items",
                sa.Column("sector", sa.String(length=128), nullable=True),
            )
        if "list_type" not in watchlist_columns:
            op.add_column(
                "watchlist_items",
                sa.Column("list_type", sa.String(length=32), nullable=True),
            )

    if inspector.has_table("alerts"):
        alert_columns = {column["name"] for column in inspector.get_columns("alerts")}
        if "acknowledged_at" not in alert_columns:
            op.add_column(
                "alerts",
                sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("alerts"):
        alert_columns = {column["name"] for column in inspector.get_columns("alerts")}
        if "acknowledged_at" in alert_columns:
            op.drop_column("alerts", "acknowledged_at")

    if inspector.has_table("watchlist_items"):
        watchlist_columns = {column["name"] for column in inspector.get_columns("watchlist_items")}
        if "list_type" in watchlist_columns:
            op.drop_column("watchlist_items", "list_type")
        if "sector" in watchlist_columns:
            op.drop_column("watchlist_items", "sector")
        if "name" in watchlist_columns:
            op.drop_column("watchlist_items", "name")
