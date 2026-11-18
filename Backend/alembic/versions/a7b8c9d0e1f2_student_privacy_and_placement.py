"""Normalize student-school placement and record student-data access."""

import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("student_profiles", sa.Column("section_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_student_profiles_section", "student_profiles", "sections", ["section_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_student_profiles_section_id", "student_profiles", ["section_id"])
    op.execute("""
        UPDATE student_profiles AS profile
        SET section_id = section.id
        FROM sections AS section
        JOIN school_classes AS room_class ON section.class_id = room_class.id AND section.school_id = room_class.school_id
        WHERE profile.school_id = section.school_id AND profile.class_name = room_class.name
          AND profile.section = section.name AND room_class.deleted_at IS NULL AND section.deleted_at IS NULL
    """)

    op.create_table(
        "student_record_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("school_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid()),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("approval_reference", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_student_record_events_school_created", "student_record_events", ["school_id", "created_at"])

    op.create_unique_constraint("uq_timetable_setup_owner", "timetable_setups", ["school_id", "timetable_id", "id"])
    # Existing mismatches need operator review. PostgreSQL enforces this constraint on new or changed rows.
    op.execute("""
        ALTER TABLE timetable_setup_assignments
        ADD CONSTRAINT fk_timetable_setup_assignment_owner
        FOREIGN KEY (school_id, timetable_id, setup_id)
        REFERENCES timetable_setups (school_id, timetable_id, id)
        ON DELETE CASCADE NOT VALID
    """)


def downgrade() -> None:
    op.execute("""
        DO $migration$
        BEGIN
            IF EXISTS (SELECT 1 FROM student_record_events) THEN
                RAISE EXCEPTION 'Preserve the student record events in a verified backup before downgrading.';
            END IF;
        END
        $migration$;
    """)
    op.drop_constraint("fk_timetable_setup_assignment_owner", "timetable_setup_assignments", type_="foreignkey")
    op.drop_constraint("uq_timetable_setup_owner", "timetable_setups", type_="unique")
    op.drop_table("student_record_events")
    op.drop_index("ix_student_profiles_section_id", table_name="student_profiles")
    op.drop_constraint("fk_student_profiles_section", "student_profiles", type_="foreignkey")
    op.drop_column("student_profiles", "section_id")
