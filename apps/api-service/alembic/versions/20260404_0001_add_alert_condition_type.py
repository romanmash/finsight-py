"""Add structured condition_type to alerts for stable deduplication.

Revision ID: 20260404_0001
Revises:
Create Date: 2026-04-04 21:20:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260404_0001"
down_revision = "20260404_0000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    # This patch is resilient when applied to partially-migrated environments.
    if not inspector.has_table("alerts"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("alerts")}
    if "condition_type" in existing_columns:
        return

    op.add_column("alerts", sa.Column("condition_type", sa.String(length=64), nullable=True))

    alerts = sa.table(
        "alerts",
        sa.column("trigger_condition", sa.String()),
        sa.column("condition_type", sa.String()),
    )

    op.execute(
        alerts.update()
        .where(alerts.c.trigger_condition.ilike("%news%"))
        .values(condition_type="news_spike")
    )
    op.execute(
        alerts.update()
        .where(alerts.c.trigger_condition.ilike("%volume%"))
        .values(condition_type="volume_spike")
    )
    op.execute(
        alerts.update()
        .where(alerts.c.condition_type.is_(None))
        .values(condition_type="price_move")
    )

    op.alter_column("alerts", "condition_type", existing_type=sa.String(length=64), nullable=False)
    existing_indexes = {index["name"] for index in inspector.get_indexes("alerts")}
    if "ix_alerts_condition_type" not in existing_indexes:
        op.create_index("ix_alerts_condition_type", "alerts", ["condition_type"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("alerts"):
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("alerts")}
    if "ix_alerts_condition_type" in existing_indexes:
        op.drop_index("ix_alerts_condition_type", table_name="alerts")

    existing_columns = {column["name"] for column in inspector.get_columns("alerts")}
    if "condition_type" in existing_columns:
        op.drop_column("alerts", "condition_type")
