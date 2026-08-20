"""create users and schools

Revision ID: 0aeb2f9da68a
Revises: 
Create Date: 2026-08-20 20:22:37.117886

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0aeb2f9da68a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create schools table (without foreign keys to users to break circular dependency)
    op.create_table(
        'schools',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.UUID(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_schools_active', 'schools', ['is_active'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('uq_schools_code_active', 'schools', [sa.literal_column('lower(code)')], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))

    # 2. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('role', sa.Enum('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', name='user_role'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_users_active', 'users', ['is_active'], unique=False, postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_users_role', 'users', ['role'], unique=False)
    op.create_index('idx_users_school_id', 'users', ['school_id'], unique=False)
    op.create_index('idx_users_school_role', 'users', ['school_id', 'role'], unique=False)
    op.create_index('uq_users_email_active', 'users', [sa.literal_column('lower(email)')], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))

    # 3. Add foreign key constraints on schools referencing users table
    op.create_foreign_key('fk_schools_created_by_users', 'schools', 'users', ['created_by'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_schools_updated_by_users', 'schools', 'users', ['updated_by'], ['id'], ondelete='RESTRICT')
    op.create_foreign_key('fk_schools_deleted_by_users', 'schools', 'users', ['deleted_by'], ['id'], ondelete='RESTRICT')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop foreign keys on schools referencing users
    op.drop_constraint('fk_schools_deleted_by_users', 'schools', type_='foreignkey')
    op.drop_constraint('fk_schools_updated_by_users', 'schools', type_='foreignkey')
    op.drop_constraint('fk_schools_created_by_users', 'schools', type_='foreignkey')

    # 2. Drop users table
    op.drop_index('uq_users_email_active', table_name='users', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('idx_users_school_role', table_name='users')
    op.drop_index('idx_users_school_id', table_name='users')
    op.drop_index('idx_users_role', table_name='users')
    op.drop_index('idx_users_active', table_name='users', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('users')

    # 3. Drop schools table
    op.drop_index('uq_schools_code_active', table_name='schools', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('idx_schools_active', table_name='schools', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_table('schools')

    # 4. Drop enum type
    sa.Enum(name='user_role').drop(op.get_bind(), checkfirst=True)
