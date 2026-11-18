"""bell_timing_setups_redesign

Revision ID: a1b2c3d4e5f6
Revises: 89f97af72bd2
Create Date: 2026-11-05 18:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '89f97af72bd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add version, order_index, schedules_json to timetable_setups
    op.add_column('timetable_setups', sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('timetable_setups', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('timetable_setups', sa.Column('schedules_json', sa.Text(), nullable=True))

    # 2. Add schedule_id, period_type to timetable_periods
    op.add_column('timetable_periods', sa.Column('schedule_id', sa.String(length=50), nullable=True, server_default='default'))
    op.add_column('timetable_periods', sa.Column('period_type', sa.String(length=30), nullable=False, server_default='CLASS'))

    # 3. Update unique index on timetable_periods to include schedule_id
    op.drop_index('uq_timetable_periods_setup_period_num', table_name='timetable_periods', postgresql_where=sa.text('deleted_at IS NULL AND setup_id IS NOT NULL'))
    op.create_index(
        'uq_timetable_periods_setup_sched_num',
        'timetable_periods',
        ['setup_id', 'schedule_id', 'period_number'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND setup_id IS NOT NULL')
    )

    # Use PostgreSQL statements so the same backfill works in SQL-only runs.
    op.execute("""
        UPDATE timetable_periods
        SET period_type = CASE WHEN is_break THEN 'RECESS' ELSE 'CLASS' END,
            schedule_id = COALESCE(schedule_id, 'default')
    """)
    op.execute("""
        DO $migration$
        DECLARE
            setup_row RECORD;
            days jsonb;
        BEGIN
            FOR setup_row IN SELECT id, applicable_days FROM timetable_setups WHERE deleted_at IS NULL LOOP
                BEGIN
                    days := setup_row.applicable_days::jsonb;
                EXCEPTION WHEN invalid_text_representation THEN
                    days := NULL;
                END;
                IF jsonb_typeof(days) IS DISTINCT FROM 'array' THEN
                    days := '["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"]'::jsonb;
                END IF;

                UPDATE timetable_setups
                SET schedules_json = jsonb_build_array(jsonb_build_object(
                    'id', 'default',
                    'days', days,
                    'periods', COALESCE((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', period.id,
                            'period_number', period.period_number,
                            'start_time', left(period.start_time::text, 5),
                            'end_time', left(period.end_time::text, 5),
                            'is_break', period.is_break,
                            'label', COALESCE(period.label, CASE WHEN period.is_break THEN 'RECESS' ELSE 'P' || period.period_number END),
                            'type', period.period_type
                        ) ORDER BY period.period_number)
                        FROM timetable_periods period
                        WHERE period.setup_id = setup_row.id AND period.deleted_at IS NULL
                    ), '[]'::jsonb)
                ))::text
                WHERE id = setup_row.id;
            END LOOP;
        END
        $migration$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $migration$
        BEGIN
            IF EXISTS (SELECT 1 FROM timetable_setups WHERE version <> 1 OR order_index <> 0)
               OR EXISTS (
                    SELECT 1 FROM timetable_periods
                    WHERE schedule_id IS DISTINCT FROM 'default'
                       OR period_type <> CASE WHEN is_break THEN 'RECESS' ELSE 'CLASS' END
               ) THEN
                RAISE EXCEPTION 'Bell schedule data cannot be represented by the previous schema. Restore a verified backup or repair forward.';
            END IF;
        END
        $migration$;
    """)
    op.drop_index('uq_timetable_periods_setup_sched_num', table_name='timetable_periods', postgresql_where=sa.text('deleted_at IS NULL AND setup_id IS NOT NULL'))
    op.create_index(
        'uq_timetable_periods_setup_period_num',
        'timetable_periods',
        ['setup_id', 'period_number'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL AND setup_id IS NOT NULL')
    )
    op.drop_column('timetable_periods', 'period_type')
    op.drop_column('timetable_periods', 'schedule_id')
    op.drop_column('timetable_setups', 'schedules_json')
    op.drop_column('timetable_setups', 'version')
    op.drop_column('timetable_setups', 'order_index')

