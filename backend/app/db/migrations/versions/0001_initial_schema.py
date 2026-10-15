"""initial schema

Creates the seven tables the Phase 2 API reads and writes: roles and users for
authentication, sessions for token revocation, and the three simulation tables
(configuration, per-tick metrics, and the final two-strategy report).

Revision ID: 0001
Revises:
Create Date: 2026-10-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "name",
            sa.Enum(
                "operator",
                "evaluator",
                name="role_name",
                native_enum=False,
                length=20,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role_id", sa.Uuid(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_id", sa.String(length=36), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sessions_token_id"), "sessions", ["token_id"], unique=True)
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)

    op.create_table(
        "simulation_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("quiet_rate_per_minute", sa.Float(), nullable=False),
        # JSONB where the database has it (Postgres), plain JSON elsewhere — the
        # weights are read as a whole object, never queried by key.
        sa.Column(
            "type_weights",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
        ),
        sa.Column(
            "mode",
            sa.Enum(
                "adaptive",
                "fixed",
                name="control_mode",
                native_enum=False,
                length=16,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_simulation_configs_owner_id"), "simulation_configs", ["owner_id"], unique=False
    )

    op.create_table(
        "simulation_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("config_id", sa.Uuid(), nullable=True),
        sa.Column(
            "mode",
            sa.Enum(
                "adaptive",
                "fixed",
                name="control_mode",
                native_enum=False,
                length=16,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "running", "completed", "aborted",
                name="simulation_status", native_enum=False, length=16,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("tick_count", sa.Integer(), nullable=False),
        sa.Column("vehicles_processed", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["config_id"], ["simulation_configs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_simulation_sessions_user_id"), "simulation_sessions", ["user_id"], unique=False
    )

    op.create_table(
        "simulation_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("tick", sa.Integer(), nullable=False),
        sa.Column("t", sa.Float(), nullable=False),
        sa.Column(
            "strategy",
            sa.Enum(
                "adaptive",
                "fixed",
                name="control_mode",
                native_enum=False,
                length=16,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("average_wait_seconds", sa.Float(), nullable=False),
        sa.Column("throughput_per_minute", sa.Float(), nullable=False),
        sa.Column("emergency_response_seconds", sa.Float(), nullable=False),
        sa.Column("longest_queue", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["simulation_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "tick", "strategy", name="uq_metric_session_tick_strategy"),
    )
    op.create_index(
        op.f("ix_simulation_metrics_session_id"), "simulation_metrics", ["session_id"], unique=False
    )

    op.create_table(
        "simulation_reports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("adaptive_average_wait_seconds", sa.Float(), nullable=False),
        sa.Column("adaptive_throughput_per_minute", sa.Float(), nullable=False),
        sa.Column("adaptive_emergency_response_seconds", sa.Float(), nullable=False),
        sa.Column("adaptive_longest_queue", sa.Integer(), nullable=False),
        sa.Column("fixed_average_wait_seconds", sa.Float(), nullable=False),
        sa.Column("fixed_throughput_per_minute", sa.Float(), nullable=False),
        sa.Column("fixed_emergency_response_seconds", sa.Float(), nullable=False),
        sa.Column("fixed_longest_queue", sa.Integer(), nullable=False),
        sa.Column("vehicles_processed", sa.Integer(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["simulation_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )


def downgrade() -> None:
    op.drop_table("simulation_reports")
    op.drop_index(op.f("ix_simulation_metrics_session_id"), table_name="simulation_metrics")
    op.drop_table("simulation_metrics")
    op.drop_index(op.f("ix_simulation_sessions_user_id"), table_name="simulation_sessions")
    op.drop_table("simulation_sessions")
    op.drop_index(op.f("ix_simulation_configs_owner_id"), table_name="simulation_configs")
    op.drop_table("simulation_configs")
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_token_id"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_table("roles")
