"""add_timetable_setups_and_redevelopment

Revision ID: 89f97af72bd2
Revises: 58fcf11f76ea
Create Date: 2026-11-01 19:43:41.587413

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '89f97af72bd2'
down_revision: Union[str, Sequence[str], None] = '58fcf11f76ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create timetables table
    op.create_table(
        'timetables',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('academic_year', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('idx_timetables_school_id', 'timetables', ['school_id'], unique=False)
    op.create_index(
        'uq_timetables_school_active',
        'timetables',
        ['school_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND is_active = true')
    )

    # 2. Create timetable_setups table
    op.create_table(
        'timetable_setups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timetable_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetables.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('applicable_days', sa.String(length=255), nullable=True, server_default=sa.text('\'["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"]\'')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index('idx_timetable_setups_school_id', 'timetable_setups', ['school_id'], unique=False)
    op.create_index('idx_timetable_setups_timetable_id', 'timetable_setups', ['timetable_id'], unique=False)

    # 3. Create timetable_setup_assignments table
    op.create_table(
        'timetable_setup_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timetable_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetables.id', ondelete='CASCADE'), nullable=False),
        sa.Column('setup_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetable_setups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint("target_type IN ('WING', 'CLASS', 'SECTION')", name='chk_timetable_setup_assignments_target_type'),
    )
    op.create_index('idx_timetable_setup_assignments_school_id', 'timetable_setup_assignments', ['school_id'], unique=False)
    op.create_index('idx_timetable_setup_assignments_timetable_id', 'timetable_setup_assignments', ['timetable_id'], unique=False)
    op.create_index('idx_timetable_setup_assignments_setup_id', 'timetable_setup_assignments', ['setup_id'], unique=False)
    op.create_index(
        'uq_timetable_setup_assignments_target',
        'timetable_setup_assignments',
        ['timetable_id', 'target_type', 'target_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL')
    )

    # 4. Alter timetable_periods
    op.add_column('timetable_periods', sa.Column('timetable_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetables.id', ondelete='CASCADE'), nullable=True))
    op.add_column('timetable_periods', sa.Column('setup_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetable_setups.id', ondelete='CASCADE'), nullable=True))
    op.add_column('timetable_periods', sa.Column('is_break', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('timetable_periods', sa.Column('label', sa.String(length=100), nullable=True))

    op.drop_index('uq_timetable_periods_school_period_num', table_name='timetable_periods', postgresql_where=sa.text('deleted_at IS NULL'))
    op.create_index('idx_timetable_periods_timetable_id', 'timetable_periods', ['timetable_id'], unique=False)
    op.create_index('idx_timetable_periods_setup_id', 'timetable_periods', ['setup_id'], unique=False)
    op.create_index(
        'uq_timetable_periods_setup_period_num',
        'timetable_periods',
        ['setup_id', 'period_number'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND setup_id IS NOT NULL')
    )

    # 5. Alter timetable_entries
    op.add_column('timetable_entries', sa.Column('timetable_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('timetables.id', ondelete='CASCADE'), nullable=True))
    op.drop_index('uq_timetable_entries_section_slot', table_name='timetable_entries', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_index('uq_timetable_entries_teacher_slot', table_name='timetable_entries', postgresql_where=sa.text('deleted_at IS NULL AND teacher_user_id IS NOT NULL'))
    op.create_index('idx_timetable_entries_timetable_id', 'timetable_entries', ['timetable_id'], unique=False)
    op.create_index(
        'uq_timetable_entries_slot_with_tt',
        'timetable_entries',
        ['timetable_id', 'section_id', 'day_of_week', 'period_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND timetable_id IS NOT NULL')
    )
    op.create_index(
        'uq_timetable_entries_teacher_with_tt',
        'timetable_entries',
        ['timetable_id', 'teacher_user_id', 'day_of_week', 'period_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND teacher_user_id IS NOT NULL AND timetable_id IS NOT NULL')
    )

    op.execute("""
        INSERT INTO timetables (id, school_id, name, description, academic_year, is_active, created_at, updated_at)
        SELECT gen_random_uuid(), id, 'Timetable 2026 - 2027', 'Default migrated school timetable', '2026-2027', true, now(), now()
        FROM schools WHERE deleted_at IS NULL
    """)
    op.execute("""
        INSERT INTO timetable_setups (id, school_id, timetable_id, name, description, is_default, applicable_days, created_at, updated_at)
        SELECT gen_random_uuid(), school_id, id, 'Standard Bell Schedule', 'Default bell schedule for all classes', true,
               '["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"]', now(), now()
        FROM timetables
    """)
    op.execute("""
        UPDATE timetable_periods AS period
        SET timetable_id = setup.timetable_id, setup_id = setup.id,
            is_break = false, label = 'Period ' || period.period_number::text
        FROM timetable_setups AS setup
        WHERE setup.school_id = period.school_id AND period.deleted_at IS NULL
    """)
    op.execute("""
        UPDATE timetable_entries AS entry SET timetable_id = timetable.id
        FROM timetables AS timetable
        WHERE timetable.school_id = entry.school_id AND entry.deleted_at IS NULL
    """)


def downgrade() -> None:
    op.execute("""
        DO $migration$
        BEGIN
            IF EXISTS (SELECT 1 FROM timetable_periods WHERE deleted_at IS NULL
                       GROUP BY school_id, period_number HAVING count(*) > 1)
                OR EXISTS (SELECT 1 FROM timetables WHERE deleted_at IS NULL GROUP BY school_id HAVING count(*) > 1)
                OR EXISTS (SELECT 1 FROM timetable_setup_assignments WHERE deleted_at IS NULL) THEN
                RAISE EXCEPTION 'Legacy timetable schema cannot represent this data. Restore a verified backup or roll forward.';
            END IF;
        END
        $migration$;
    """)
    op.drop_index('uq_timetable_entries_teacher_with_tt', table_name='timetable_entries', postgresql_where=sa.text('deleted_at IS NULL AND teacher_user_id IS NOT NULL AND timetable_id IS NOT NULL'))
    op.drop_index('uq_timetable_entries_slot_with_tt', table_name='timetable_entries', postgresql_where=sa.text('deleted_at IS NULL AND timetable_id IS NOT NULL'))
    op.drop_index('idx_timetable_entries_timetable_id', table_name='timetable_entries')
    op.create_index('uq_timetable_entries_teacher_slot', 'timetable_entries', ['school_id', 'teacher_user_id', 'day_of_week', 'period_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL AND teacher_user_id IS NOT NULL'))
    op.create_index('uq_timetable_entries_section_slot', 'timetable_entries', ['school_id', 'section_id', 'day_of_week', 'period_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_column('timetable_entries', 'timetable_id')

    op.drop_index('uq_timetable_periods_setup_period_num', table_name='timetable_periods', postgresql_where=sa.text('deleted_at IS NULL AND setup_id IS NOT NULL'))
    op.drop_index('idx_timetable_periods_setup_id', table_name='timetable_periods')
    op.drop_index('idx_timetable_periods_timetable_id', table_name='timetable_periods')
    op.create_index('uq_timetable_periods_school_period_num', 'timetable_periods', ['school_id', 'period_number'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_column('timetable_periods', 'label')
    op.drop_column('timetable_periods', 'is_break')
    op.drop_column('timetable_periods', 'setup_id')
    op.drop_column('timetable_periods', 'timetable_id')

    op.drop_table('timetable_setup_assignments')
    op.drop_table('timetable_setups')
    op.drop_table('timetables')

