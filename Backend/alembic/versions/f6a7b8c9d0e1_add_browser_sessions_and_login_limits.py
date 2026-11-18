"""Add opaque browser sessions and shared login counters."""

import sqlalchemy as sa
from alembic import op

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("client_message_id", sa.Uuid(), nullable=True))
    op.create_index("uq_messages_sender_client_id", "messages", ["conversation_id", "sender_id", "client_message_id"], unique=True)
    op.create_table(
        "browser_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_browser_sessions_user_id", "browser_sessions", ["user_id"])
    op.create_index("ix_browser_sessions_expires_at", "browser_sessions", ["expires_at"])
    op.create_table(
        "login_attempt_windows",
        sa.Column("scope_key", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
    )
    op.create_index("ix_login_attempt_windows_expires_at", "login_attempt_windows", ["expires_at"])


def downgrade() -> None:
    op.drop_table("login_attempt_windows")
    op.drop_table("browser_sessions")
    op.drop_index("uq_messages_sender_client_id", table_name="messages")
    op.drop_column("messages", "client_message_id")
