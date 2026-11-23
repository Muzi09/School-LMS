"""Resolve rooms from section and subject settings, preserving legacy labels for review."""
from alembic import op
import sqlalchemy as sa

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def migrate_labels():
    # One pass across saved lessons, reusable groups and weekday rosters.
    op.execute("""
        CREATE TEMP TABLE legacy_room_choices ON COMMIT DROP AS
        WITH plans AS (
            SELECT school_id, lecture_plan::jsonb AS plan FROM timetables
            WHERE deleted_at IS NULL AND lecture_plan IS NOT NULL
        ), options AS (
            SELECT school_id, opt FROM plans
            CROSS JOIN LATERAL jsonb_each(plan->'groups') g
            CROSS JOIN LATERAL jsonb_array_elements(g.value->'options') opt
            UNION ALL
            SELECT school_id, opt FROM plans
            CROSS JOIN LATERAL jsonb_each(plan->'placements') p
            CROSS JOIN LATERAL jsonb_array_elements(p.value->'expected') opt
        ), evidence AS (
            SELECT e.school_id, e.section_id, e.subject_id, e.room_number AS label
            FROM timetable_entries e
            JOIN timetable_periods p ON p.id = e.period_id AND p.school_id = e.school_id
            JOIN timetables tt ON tt.id = coalesce(e.timetable_id,p.timetable_id) AND tt.school_id = e.school_id
            WHERE e.deleted_at IS NULL AND tt.deleted_at IS NULL AND e.room_number IS NOT NULL
            UNION ALL
            SELECT o.school_id, s.id, sub.id, opt->>'room_number'
            FROM options o CROSS JOIN LATERAL jsonb_array_elements_text(opt->'section_ids') ids(id)
            JOIN sections s ON s.id::text = ids.id AND s.school_id = o.school_id
            JOIN subjects sub ON sub.id::text = opt->>'subject_id' AND sub.school_id = o.school_id
            WHERE opt->>'room_number' IS NOT NULL
        ), labels AS (
            SELECT DISTINCT e.school_id, s.class_id, s.id AS section_id, sub.id AS subject_id, sub.name,
                regexp_replace(label, '^[[:space:]]+|[[:space:]]+$', '', 'g') AS label
            FROM evidence e
            JOIN sections s ON s.id = e.section_id AND s.school_id = e.school_id AND s.deleted_at IS NULL
            JOIN subjects sub ON sub.id = e.subject_id AND sub.school_id = e.school_id AND sub.deleted_at IS NULL
        )
        SELECT l.school_id, l.class_id, l.section_id, l.subject_id, l.name, array_agg(label ORDER BY label) AS labels,
            EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.school_id = l.school_id
                AND cs.class_id = l.class_id AND cs.subject_id = l.subject_id AND cs.deleted_at IS NULL
                AND (cs.section_id = l.section_id OR cs.section_id IS NULL)) AS allocated
        FROM labels l WHERE label <> ''
        GROUP BY l.school_id, l.class_id, l.section_id, l.subject_id, l.name
    """)
    op.execute("""
        INSERT INTO class_subjects (id, school_id, class_id, section_id, subject_id, room_override)
        SELECT gen_random_uuid(), school_id, class_id, section_id, subject_id, labels[1]
        FROM legacy_room_choices WHERE allocated AND cardinality(labels) = 1
        ON CONFLICT (class_id, section_id, subject_id) WHERE deleted_at IS NULL
        DO UPDATE SET room_override = EXCLUDED.room_override
    """)
    op.execute("""
        UPDATE sections s SET room_reviews = pending.reviews
        FROM (SELECT school_id, section_id, json_object_agg(subject_id::text,
            json_build_object('name', name, 'labels', labels)) AS reviews
            FROM legacy_room_choices WHERE NOT allocated OR cardinality(labels) > 1
            GROUP BY school_id, section_id) pending
        WHERE s.id = pending.section_id AND s.school_id = pending.school_id
    """)


def upgrade():
    op.add_column("sections", sa.Column("room_number", sa.String(80)))
    op.add_column("sections", sa.Column("room_reviews", sa.JSON()))
    op.add_column("class_subjects", sa.Column("room_override", sa.String(80)))
    migrate_labels()


def downgrade():
    op.drop_column("class_subjects", "room_override")
    op.drop_column("sections", "room_reviews")
    op.drop_column("sections", "room_number")
