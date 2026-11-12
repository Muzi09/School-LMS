"""staff_tag_type_wings_and_shifts

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-12 12:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new columns to staff_profiles
    op.add_column('staff_profiles', sa.Column('tag', sa.String(length=100), nullable=False, server_default='Teacher'))
    op.add_column('staff_profiles', sa.Column('is_academic', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('staff_profiles', sa.Column('is_non_academic', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('staff_profiles', sa.Column('working_shifts', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'))

    # Update designation to default to tag/Teacher if null
    op.execute(sa.text("UPDATE staff_profiles SET tag = COALESCE(designation, 'Teacher') WHERE tag IS NULL OR tag = ''"))
    op.execute(sa.text("UPDATE staff_profiles SET designation = COALESCE(tag, 'Teacher') WHERE designation IS NULL OR designation = ''"))

    # 2. Create staff_wings association table
    op.create_table(
        'staff_wings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('staff_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('wing_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['staff_profile_id'], ['staff_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['wing_id'], ['wings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ondelete='RESTRICT'),
    )

    op.create_index('idx_staff_wings_school_id', 'staff_wings', ['school_id'], unique=False)
    op.create_index('idx_staff_wings_staff_profile_id', 'staff_wings', ['staff_profile_id'], unique=False)
    op.create_index('idx_staff_wings_wing_id', 'staff_wings', ['wing_id'], unique=False)
    op.create_index(
        'uq_staff_wings_profile_wing',
        'staff_wings',
        ['staff_profile_id', 'wing_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL')
    )


def downgrade() -> None:
    op.drop_index('uq_staff_wings_profile_wing', table_name='staff_wings')
    op.drop_index('idx_staff_wings_wing_id', table_name='staff_wings')
    op.drop_index('idx_staff_wings_staff_profile_id', table_name='staff_wings')
    op.drop_index('idx_staff_wings_school_id', table_name='staff_wings')
    op.drop_table('staff_wings')

    op.drop_column('staff_profiles', 'working_shifts')
    op.drop_column('staff_profiles', 'is_non_academic')
    op.drop_column('staff_profiles', 'is_academic')
    op.drop_column('staff_profiles', 'tag')

