"""relax_timetable_entries_teacher_unique_constraint

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-13 22:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the unique index that caused IntegrityError on teacher double-booking
    op.execute("DROP INDEX IF EXISTS uq_timetable_entries_teacher_with_tt")

    # 2. Re-create as a standard non-unique index for fast lookup without blocking conflicting assignments
    op.create_index(
        'idx_timetable_entries_teacher_tt_slot',
        'timetable_entries',
        ['timetable_id', 'teacher_user_id', 'day_of_week', 'period_id'],
        unique=False,
        postgresql_where=sa.text('deleted_at IS NULL AND teacher_user_id IS NOT NULL AND timetable_id IS NOT NULL')
    )


def downgrade() -> None:
    op.execute("""
        DO $migration$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM timetable_entries
                WHERE deleted_at IS NULL AND teacher_user_id IS NOT NULL AND timetable_id IS NOT NULL
                GROUP BY timetable_id, teacher_user_id, day_of_week, period_id
                HAVING count(*) > 1
            ) THEN
                RAISE EXCEPTION 'Resolve duplicate teacher slots before restoring the older unique index.';
            END IF;
        END
        $migration$;
    """)
    op.execute("DROP INDEX IF EXISTS idx_timetable_entries_teacher_tt_slot")
    op.create_index(
        'uq_timetable_entries_teacher_with_tt',
        'timetable_entries',
        ['timetable_id', 'teacher_user_id', 'day_of_week', 'period_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND teacher_user_id IS NOT NULL AND timetable_id IS NOT NULL')
    )

