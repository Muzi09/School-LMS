"""bell_timing_setups_redesign

Revision ID: a1b2c3d4e5f6
Revises: 89f97af72bd2
Create Date: 2026-11-05 18:25:00.000000

"""
from typing import Sequence, Union
import json
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

    # 4. Migrate existing data: set period_type based on is_break
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE timetable_periods
        SET period_type = CASE WHEN is_break THEN 'RECESS' ELSE 'CLASS' END,
            schedule_id = 'default'
        WHERE schedule_id IS NULL OR period_type IS NULL
    """))

    # Populate schedules_json for existing setups
    setups = conn.execute(sa.text("SELECT id, applicable_days FROM timetable_setups WHERE deleted_at IS NULL")).fetchall()
    for s in setups:
        s_id = str(s[0])
        app_days_raw = s[1]
        app_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        if app_days_raw:
            try:
                parsed = json.loads(app_days_raw)
                if isinstance(parsed, list):
                    app_days = parsed
            except Exception:
                pass

        periods = conn.execute(sa.text("""
            SELECT id, period_number, start_time::text, end_time::text, is_break, label, period_type
            FROM timetable_periods
            WHERE setup_id = :s_id AND deleted_at IS NULL
            ORDER BY period_number ASC
        """), {"s_id": s_id}).fetchall()

        period_items = []
        for p in periods:
            period_items.append({
                "id": str(p[0]),
                "period_number": p[1],
                "start_time": p[2][:5] if p[2] else "08:30",
                "end_time": p[3][:5] if p[3] else "09:15",
                "is_break": bool(p[4]),
                "label": p[5] or (f"P{p[1]}" if not p[4] else "RECESS"),
                "type": p[6] or ("RECESS" if p[4] else "CLASS"),
            })

        schedules_payload = [
            {
                "id": "default",
                "days": app_days,
                "periods": period_items,
            }
        ]

        conn.execute(sa.text("""
            UPDATE timetable_setups
            SET schedules_json = :schedules_json
            WHERE id = :s_id
        """), {"s_id": s_id, "schedules_json": json.dumps(schedules_payload)})


def downgrade() -> None:
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

