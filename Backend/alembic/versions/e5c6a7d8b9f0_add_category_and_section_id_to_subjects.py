"""add_category_and_section_id_to_subjects

Revision ID: e5c6a7d8b9f0
Revises: 87db4281c667
Create Date: 2026-09-08 20:17:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5c6a7d8b9f0'
down_revision: Union[str, Sequence[str], None] = '87db4281c667'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add category and is_academic columns to subjects
    op.add_column(
        'subjects',
        sa.Column('category', sa.String(length=50), server_default='academic', nullable=False)
    )
    op.add_column(
        'subjects',
        sa.Column('is_academic', sa.Boolean(), server_default='true', nullable=False)
    )

    # 2. Add section_id column to class_subjects
    op.add_column(
        'class_subjects',
        sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_class_subjects_section_id_sections',
        'class_subjects',
        'sections',
        ['section_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index(
        'idx_class_subjects_section_id',
        'class_subjects',
        ['section_id'],
        unique=False
    )

    # 3. Update unique index on class_subjects to include section_id
    op.drop_index(
        'uq_class_subjects_class_subject',
        table_name='class_subjects',
        postgresql_where=sa.text('deleted_at IS NULL'),
        if_exists=True
    )
    op.create_index(
        'uq_class_subjects_class_section_subject',
        'class_subjects',
        ['class_id', 'section_id', 'subject_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL')
    )


def downgrade() -> None:
    op.drop_index(
        'uq_class_subjects_class_section_subject',
        table_name='class_subjects',
        postgresql_where=sa.text('deleted_at IS NULL')
    )
    op.create_index(
        'uq_class_subjects_class_subject',
        'class_subjects',
        ['class_id', 'subject_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL')
    )
    op.drop_index('idx_class_subjects_section_id', table_name='class_subjects')
    op.drop_constraint('fk_class_subjects_section_id_sections', 'class_subjects', type_='foreignkey')
    op.drop_column('class_subjects', 'section_id')
    op.drop_column('subjects', 'is_academic')
    op.drop_column('subjects', 'category')
