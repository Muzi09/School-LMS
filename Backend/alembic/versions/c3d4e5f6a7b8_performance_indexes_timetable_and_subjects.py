"""performance_indexes_timetable_and_subjects

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-12 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Composite covering index for teacher conflict detection
    op.create_index(
        'idx_timetable_entries_teacher_conflict',
        'timetable_entries',
        ['school_id', 'teacher_user_id', 'day_of_week'],
        unique=False,
        postgresql_where=sa.text('deleted_at IS NULL')
    )

    # 2. Composite covering index for section slot queries
    op.create_index(
        'idx_timetable_entries_section_slot',
        'timetable_entries',
        ['school_id', 'section_id', 'day_of_week', 'period_id'],
        unique=False,
        postgresql_where=sa.text('deleted_at IS NULL')
    )

    # 3. Composite covering index for class-subject section queries
    op.create_index(
        'idx_class_subjects_section_subject',
        'class_subjects',
        ['school_id', 'section_id', 'subject_id'],
        unique=False,
        postgresql_where=sa.text('deleted_at IS NULL')
    )

    # 4. Composite covering index for class-subject class queries
    op.create_index(
        'idx_class_subjects_class_subject',
        'class_subjects',
        ['school_id', 'class_id', 'subject_id'],
        unique=False,
        postgresql_where=sa.text('deleted_at IS NULL')
    )


def downgrade() -> None:
    op.drop_index('idx_class_subjects_class_subject', table_name='class_subjects')
    op.drop_index('idx_class_subjects_section_subject', table_name='class_subjects')
    op.drop_index('idx_timetable_entries_section_slot', table_name='timetable_entries')
    op.drop_index('idx_timetable_entries_teacher_conflict', table_name='timetable_entries')

