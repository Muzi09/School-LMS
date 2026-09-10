"""super admin setup and school setup

Revision ID: a7bd5ef5ffbc
Revises: ea6606c2b12e
Create Date: 2026-09-01 16:46:32.176850

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7bd5ef5ffbc'
down_revision: Union[str, Sequence[str], None] = 'ea6606c2b12e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Redundant users table creation removed because users table is created in 0aeb2f9da68a
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
