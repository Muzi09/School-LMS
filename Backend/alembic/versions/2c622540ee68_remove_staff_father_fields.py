"""remove_staff_father_fields

Revision ID: 2c622540ee68
Revises: 69822169ca18
Create Date: 2026-10-02 12:57:19.517044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c622540ee68'
down_revision: Union[str, Sequence[str], None] = '69822169ca18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('staff_profiles', 'father_first_name')
    op.drop_column('staff_profiles', 'father_last_name')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('staff_profiles', sa.Column('father_first_name', sa.String(length=100), nullable=True))
    op.add_column('staff_profiles', sa.Column('father_last_name', sa.String(length=100), nullable=True))
