"""add_split_subjects

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-06 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_split column to subjects if not exists
    op.execute(
        "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_split BOOLEAN NOT NULL DEFAULT FALSE;"
    )

    # 2. Add parent_id column to subjects if not exists
    op.execute(
        "ALTER TABLE subjects ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES subjects(id) ON DELETE CASCADE;"
    )

    # 3. Add index on parent_id
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_subjects_parent_id ON subjects(parent_id);"
    )

    # 4. Partial unique indexes for top-level subjects and child subjects
    op.execute("DROP INDEX IF EXISTS uq_subjects_school_name;")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_name ON subjects (school_id, name) WHERE deleted_at IS NULL AND parent_id IS NULL;"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_parent_name ON subjects (school_id, parent_id, name) WHERE deleted_at IS NULL AND parent_id IS NOT NULL;"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_subjects_school_parent_name;")
    op.execute("DROP INDEX IF EXISTS uq_subjects_school_name;")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_name ON subjects (school_id, name) WHERE deleted_at IS NULL;"
    )
    op.execute("DROP INDEX IF EXISTS idx_subjects_parent_id;")
    op.execute("ALTER TABLE subjects DROP COLUMN IF EXISTS parent_id;")
    op.execute("ALTER TABLE subjects DROP COLUMN IF EXISTS is_split;")
