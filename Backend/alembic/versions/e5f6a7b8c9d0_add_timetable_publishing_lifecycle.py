"""add_timetable_publishing_lifecycle

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-14 10:45:00.000000

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
    op.add_column(
        'timetables',
        sa.Column('status', sa.String(length=20), nullable=False, server_default='DRAFT')
    )
    op.add_column(
        'timetables',
        sa.Column('version', sa.Integer(), nullable=False, server_default='1')
    )
    op.add_column(
        'timetables',
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'timetables',
        sa.Column(
            'published_by',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True
        )
    )
    op.add_column(
        'timetables',
        sa.Column('last_published_entries_json', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('timetables', 'last_published_entries_json')
    op.drop_column('timetables', 'published_by')
    op.drop_column('timetables', 'published_at')
    op.drop_column('timetables', 'version')
    op.drop_column('timetables', 'status')

