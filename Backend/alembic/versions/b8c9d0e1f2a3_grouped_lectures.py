"""Weekly lecture groups and section-specific eligibility."""
from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None

def slot_index(grouped):
    predicate = "deleted_at IS NULL AND timetable_id IS NOT NULL"
    if grouped:
        predicate += " AND placement_id IS NULL"
    op.create_index("uq_timetable_entries_slot_with_tt", "timetable_entries",
                    ["timetable_id", "section_id", "day_of_week", "period_id"],
                    unique=True, postgresql_where=sa.text(predicate))

def upgrade():
    op.add_column("sections", sa.Column("parallel_subject_ids", sa.JSON()))
    op.add_column("timetables", sa.Column("lecture_plan", sa.JSON()))
    for name in ("placement_id", "option_id"):
        op.add_column("timetable_entries", sa.Column(name, sa.Uuid()))
    op.add_column("timetable_entries", sa.Column("room_number", sa.String(80)))
    op.drop_index("uq_timetable_entries_slot_with_tt", table_name="timetable_entries")
    slot_index(True)
    op.create_index("uq_group_section_option", "timetable_entries",
                    ["timetable_id", "placement_id", "option_id", "section_id"], unique=True,
                    postgresql_where=sa.text("deleted_at IS NULL AND placement_id IS NOT NULL"))

def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM timetable_entries WHERE placement_id IS NOT NULL AND deleted_at IS NULL LIMIT 1")).first():
        raise RuntimeError("Remove grouped placements before downgrading.")
    op.drop_index("uq_group_section_option", table_name="timetable_entries")
    op.drop_index("uq_timetable_entries_slot_with_tt", table_name="timetable_entries")
    slot_index(False)
    for name in ("room_number", "option_id", "placement_id"):
        op.drop_column("timetable_entries", name)
    op.drop_column("timetables", "lecture_plan")
    op.drop_column("sections", "parallel_subject_ids")
