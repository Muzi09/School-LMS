"""add_user_last_seen_at

Revision ID: f9a1b2c3d4e5
Revises: e8c4b12399df
Create Date: 2026-09-21 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = '72a50deca431'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'last_seen_at')
