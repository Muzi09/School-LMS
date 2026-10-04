"""add_timetable_module

Revision ID: c3d4e5f6a7b8
Revises: 2c622540ee68
Create Date: 2026-10-03 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '2c622540ee68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Clean up any leftover or draft tables
    op.execute("DROP TABLE IF EXISTS timetable_entries CASCADE")
    op.execute("DROP TABLE IF EXISTS timetable_periods CASCADE")
    op.execute("DROP TABLE IF EXISTS teaching_assignments CASCADE")
    op.execute("DROP TABLE IF EXISTS timetables CASCADE")
    op.execute("DROP TABLE IF EXISTS period_sets CASCADE")
    op.execute("DROP TABLE IF EXISTS academic_years CASCADE")

    # 1. Create timetable_periods
    op.create_table(
        'timetable_periods',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_number', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=True),
        sa.CheckConstraint('period_number > 0', name='chk_timetable_periods_period_number_pos'),
        sa.CheckConstraint('start_time < end_time', name='chk_timetable_periods_time_order'),
    )

    op.create_index('idx_timetable_periods_school_id', 'timetable_periods', ['school_id'])
    op.create_index(
        'uq_timetable_periods_school_period_num',
        'timetable_periods',
        ['school_id', 'period_number'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # 2. Create timetable_entries
    op.create_table(
        'timetable_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('teacher_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetable_periods.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_of_week', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=True),
        sa.CheckConstraint(
            "day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')",
            name='chk_timetable_entries_day_of_week',
        ),
    )

    op.create_index('idx_timetable_entries_school_id', 'timetable_entries', ['school_id'])
    op.create_index('idx_timetable_entries_section_id', 'timetable_entries', ['section_id'])
    op.create_index('idx_timetable_entries_teacher_user_id', 'timetable_entries', ['teacher_user_id'])
    op.create_index('idx_timetable_entries_period_id', 'timetable_entries', ['period_id'])
    op.create_index('idx_timetable_entries_day_of_week', 'timetable_entries', ['day_of_week'])
    op.create_index(
        'uq_timetable_entries_section_slot',
        'timetable_entries',
        ['school_id', 'section_id', 'day_of_week', 'period_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
    )
    op.create_index(
        'uq_timetable_entries_teacher_slot',
        'timetable_entries',
        ['school_id', 'teacher_user_id', 'day_of_week', 'period_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
    )


def downgrade() -> None:
    op.drop_table('timetable_entries')
    op.drop_table('timetable_periods')
