"""Persist section order and room mode, and unify shared Parallel settings."""
import re

from alembic import op
import sqlalchemy as sa

revision = "da1e2f3a4b5c"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("sections", sa.Column("order_index", sa.Integer(), server_default="0", nullable=False))
    op.add_column("sections", sa.Column("single_room", sa.Boolean(), server_default=sa.false(), nullable=False))

    # Keep the first active wing in display order for historical duplicate assignments.
    op.execute("""
        WITH ranked AS (
            SELECT wc.id, w.deleted_at AS wing_deleted_at, row_number() OVER (
                PARTITION BY wc.class_id
                ORDER BY (w.deleted_at IS NOT NULL), w.order_index, w.name, w.id
            ) AS position
            FROM wing_classes wc JOIN wings w ON w.id = wc.wing_id
            WHERE wc.deleted_at IS NULL
        )
        UPDATE wing_classes wc SET deleted_at = now()
        FROM ranked WHERE wc.id = ranked.id
        AND (ranked.position > 1 OR ranked.wing_deleted_at IS NOT NULL)
    """)
    op.create_index("uq_wing_classes_active_class", "wing_classes", ["class_id"],
                    unique=True, postgresql_where=sa.text("deleted_at IS NULL"))

    connection = op.get_bind()
    rows = connection.execute(sa.text(
        "SELECT id, class_id, name FROM sections WHERE deleted_at IS NULL ORDER BY created_at, id"
    )).mappings()

    def section_key(row):
        return (row["class_id"], [
            (0, int(part)) if part.isdigit() else (1, part.lower())
            for part in re.split(r"(\d+)", row["name"].strip()) if part
        ])

    positions = {}
    updates = []
    for row in sorted(rows, key=section_key):
        position = positions.get(row["class_id"], 0)
        updates.append({"section_id": row["id"], "position": position})
        positions[row["class_id"]] = position + 1
    if updates:
        connection.execute(sa.text("UPDATE sections SET order_index = :position WHERE id = :section_id"), updates)

    op.execute("""
        UPDATE sections AS s SET single_room = true
        WHERE s.deleted_at IS NULL AND (s.room_reviews IS NULL OR s.room_reviews::jsonb IN ('{}', 'null'))
        AND NOT EXISTS (
            SELECT 1 FROM class_subjects cs WHERE cs.section_id = s.id
            AND cs.deleted_at IS NULL AND nullif(trim(cs.room_override), '') IS NOT NULL
        )
    """)
    op.alter_column("sections", "single_room", server_default=sa.true())
    op.execute("""
        WITH settings AS (
            SELECT s.class_id, json_agg(DISTINCT p.subject_id) AS parallel_ids
            FROM sections s
            JOIN school_classes c ON c.id = s.class_id AND c.deleted_at IS NULL
            CROSS JOIN LATERAL jsonb_array_elements_text(
                coalesce(nullif(s.parallel_subject_ids::jsonb, 'null'), '[]')
            ) p(subject_id)
            WHERE s.deleted_at IS NULL AND c.same_for_all_sections
            GROUP BY s.class_id
        )
        UPDATE sections s SET parallel_subject_ids = settings.parallel_ids
        FROM settings WHERE s.class_id = settings.class_id AND s.deleted_at IS NULL
    """)


def downgrade():
    op.drop_index("uq_wing_classes_active_class", table_name="wing_classes")
    op.drop_column("sections", "single_room")
    op.drop_column("sections", "order_index")
