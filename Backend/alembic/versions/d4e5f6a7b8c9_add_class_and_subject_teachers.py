"""add_class_and_subject_teachers

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-05 23:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add class_teacher_id to sections
    op.add_column(
        'sections',
        sa.Column(
            'class_teacher_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        )
    )
    op.create_index(
        'idx_sections_class_teacher_id',
        'sections',
        ['class_teacher_id'],
    )

    # 2. Add teacher_id to class_subjects
    op.add_column(
        'class_subjects',
        sa.Column(
            'teacher_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        )
    )
    op.create_index(
        'idx_class_subjects_teacher_id',
        'class_subjects',
        ['teacher_id'],
    )


def downgrade() -> None:
    op.drop_index('idx_class_subjects_teacher_id', table_name='class_subjects')
    op.drop_column('class_subjects', 'teacher_id')

    op.drop_index('idx_sections_class_teacher_id', table_name='sections')
    op.drop_column('sections', 'class_teacher_id')
