"""add_chat_tables_and_school_constraints

Revision ID: e8c4b12399df
Revises: 45d51154da76
Create Date: 2026-09-20 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8c4b12399df'
down_revision: Union[str, Sequence[str], None] = '45d51154da76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add school_id to student_profiles and backfill
    op.add_column('student_profiles', sa.Column('school_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_student_profiles_school_id_schools',
        'student_profiles',
        'schools',
        ['school_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index('idx_student_profiles_school_id', 'student_profiles', ['school_id'], unique=False)

    # Backfill student school_id from creator's principal profile or staff profile
    op.execute(
        """
        UPDATE student_profiles sp
        SET school_id = pp.school_id
        FROM users u
        JOIN principal_profiles pp ON u.created_by = pp.user_id
        WHERE sp.user_id = u.id AND pp.school_id IS NOT NULL AND sp.school_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE student_profiles sp
        SET school_id = stp.school_id
        FROM users u
        JOIN staff_profiles stp ON u.created_by = stp.user_id
        WHERE sp.user_id = u.id AND stp.school_id IS NOT NULL AND sp.school_id IS NULL;
        """
    )
    # Default fallback for any remaining students without creator (e.g. test seeds)
    op.execute(
        """
        UPDATE student_profiles
        SET school_id = (SELECT id FROM schools WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1)
        WHERE school_id IS NULL;
        """
    )

    # 2. Enforce 1-to-1 Principal to School constraint
    # Drop old non-unique index if present, add unique partial index
    op.execute("DROP INDEX IF EXISTS idx_principal_profiles_school_id;")
    op.create_index(
        'uq_principal_profiles_school_id',
        'principal_profiles',
        ['school_id'],
        unique=True,
        postgresql_where=sa.text('school_id IS NOT NULL'),
    )

    # 3. Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.Column('user_a_id', sa.UUID(), nullable=False),
        sa.Column('user_b_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_a_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_b_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_a_id', 'user_b_id', name='uq_conversations_user_pair'),
    )
    op.create_index('idx_conversations_school_id', 'conversations', ['school_id'], unique=False)
    op.create_index('idx_conversations_updated_at', 'conversations', ['updated_at'], unique=False)

    # 4. Create conversation_participants table
    op.create_table(
        'conversation_participants',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_participants'),
    )
    op.create_index('idx_conversation_participants_user_id', 'conversation_participants', ['user_id'], unique=False)
    op.create_index('idx_conversation_participants_conv_id', 'conversation_participants', ['conversation_id'], unique=False)

    # 5. Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_messages_conversation_created', 'messages', ['conversation_id', 'created_at'], unique=False)
    op.create_index('idx_messages_sender_id', 'messages', ['sender_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_messages_sender_id', table_name='messages')
    op.drop_index('idx_messages_conversation_created', table_name='messages')
    op.drop_table('messages')

    op.drop_index('idx_conversation_participants_conv_id', table_name='conversation_participants')
    op.drop_index('idx_conversation_participants_user_id', table_name='conversation_participants')
    op.drop_table('conversation_participants')

    op.drop_index('idx_conversations_updated_at', table_name='conversations')
    op.drop_index('idx_conversations_school_id', table_name='conversations')
    op.drop_table('conversations')

    op.drop_index('uq_principal_profiles_school_id', table_name='principal_profiles')
    op.create_index('idx_principal_profiles_school_id', 'principal_profiles', ['school_id'], unique=False)

    op.drop_index('idx_student_profiles_school_id', table_name='student_profiles')
    op.drop_constraint('fk_student_profiles_school_id_schools', 'student_profiles', type_='foreignkey')
    op.drop_column('student_profiles', 'school_id')
