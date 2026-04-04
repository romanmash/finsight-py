"""Create baseline 006 collector data tables.

Revision ID: 20260404_0000
Revises:
Create Date: 2026-04-04 22:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260404_0000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("watchlist_items"):
        op.create_table(
            "watchlist_items",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("ticker", sa.String(length=16), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("price_change_pct_threshold", sa.Float(), nullable=True),
            sa.Column("volume_spike_multiplier", sa.Float(), nullable=True),
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
        )
        op.create_index("ix_watchlist_items_ticker", "watchlist_items", ["ticker"], unique=False)

    if not inspector.has_table("missions"):
        op.create_table(
            "missions",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("mission_type", sa.String(length=64), nullable=False),
            sa.Column("source", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("query", sa.String(length=1024), nullable=False),
            sa.Column("ticker", sa.String(length=16), nullable=True),
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
        )

    if not inspector.has_table("alerts"):
        op.create_table(
            "alerts",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("watchlist_item_id", sa.Uuid(), nullable=False),
            sa.Column("mission_id", sa.Uuid(), nullable=True),
            sa.Column("severity", sa.String(length=32), nullable=False),
            sa.Column("trigger_condition", sa.String(length=512), nullable=False),
            sa.Column("observed_value", sa.Float(), nullable=True),
            sa.Column("threshold_value", sa.Float(), nullable=True),
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
            sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(
                ["watchlist_item_id"], ["watchlist_items.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_alerts_watchlist_item_id",
            "alerts",
            ["watchlist_item_id"],
            unique=False,
        )
        op.create_index("ix_alerts_mission_id", "alerts", ["mission_id"], unique=False)

    if not inspector.has_table("agent_runs"):
        op.create_table(
            "agent_runs",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("mission_id", sa.Uuid(), nullable=False),
            sa.Column("agent_name", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("tokens_in", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("tokens_out", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column(
                "cost_usd",
                sa.Numeric(precision=12, scale=8),
                nullable=False,
                server_default=sa.text("0.00"),
            ),
            sa.Column("provider", sa.String(length=64), nullable=True),
            sa.Column("model", sa.String(length=128), nullable=True),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("input_snapshot", sa.JSON(), nullable=True),
            sa.Column("output_snapshot", sa.JSON(), nullable=True),
            sa.Column("error_message", sa.String(length=2048), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_agent_runs_mission_id", "agent_runs", ["mission_id"], unique=False)
        op.create_index("ix_agent_runs_agent_name", "agent_runs", ["agent_name"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("agent_runs"):
        op.drop_table("agent_runs")
    if inspector.has_table("alerts"):
        op.drop_table("alerts")
    if inspector.has_table("missions"):
        op.drop_table("missions")
    if inspector.has_table("watchlist_items"):
        op.drop_table("watchlist_items")
