"""add_group_and_broadcast_support

Revision ID: a1b2c3d4e5f6
Revises: f9a1b2c3d4e5
Create Date: 2026-09-21 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f9a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update conversations table for GROUP and BROADCAST support
    op.add_column(
        'conversations',
        sa.Column('type', sa.String(length=20), server_default='DIRECT', nullable=False)
    )
    op.add_column(
        'conversations',
        sa.Column('name', sa.String(length=255), nullable=True)
    )
    op.add_column(
        'conversations',
        sa.Column('created_by_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_conversations_created_by_id_users',
        'conversations',
        'users',
        ['created_by_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.alter_column('conversations', 'user_a_id', nullable=True)
    op.alter_column('conversations', 'user_b_id', nullable=True)

    # Drop old table-level unique constraint and replace with partial unique index for DIRECT
    op.drop_constraint('uq_conversations_user_pair', 'conversations', type_='unique')
    op.create_index(
        'uq_conversations_direct_user_pair',
        'conversations',
        ['user_a_id', 'user_b_id'],
        unique=True,
        postgresql_where=sa.text("type = 'DIRECT'")
    )
    op.create_index('idx_conversations_type', 'conversations', ['type'], unique=False)
    op.create_index('idx_conversations_created_by_id', 'conversations', ['created_by_id'], unique=False)

    # 2. Update conversation_participants table with role (ADMIN, MEMBER)
    op.add_column(
        'conversation_participants',
        sa.Column('role', sa.String(length=20), server_default='MEMBER', nullable=False)
    )

    # 3. Update messages table with message_type (TEXT, SYSTEM)
    op.add_column(
        'messages',
        sa.Column('message_type', sa.String(length=20), server_default='TEXT', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('messages', 'message_type')

    op.drop_column('conversation_participants', 'role')

    op.drop_index('idx_conversations_created_by_id', table_name='conversations')
    op.drop_index('idx_conversations_type', table_name='conversations')
    op.drop_index('uq_conversations_direct_user_pair', table_name='conversations')

    # Re-apply non-null constraint and original unique constraint
    op.alter_column('conversations', 'user_b_id', nullable=False)
    op.alter_column('conversations', 'user_a_id', nullable=False)
    op.create_unique_constraint('uq_conversations_user_pair', 'conversations', ['user_a_id', 'user_b_id'])

    op.drop_constraint('fk_conversations_created_by_id_users', 'conversations', type_='foreignkey')
    op.drop_column('conversations', 'created_by_id')
    op.drop_column('conversations', 'name')
    op.drop_column('conversations', 'type')
