"""rename super_admin_id to admin_id in smtp_configurations

Revision ID: f3a8b1c9e2d4
Revises: a7bd5ef5ffbc
Create Date: 2026-09-04 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a8b1c9e2d4'
down_revision: Union[str, Sequence[str], None] = 'a7bd5ef5ffbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename column if exists
    op.alter_column('smtp_configurations', 'super_admin_id', new_column_name='admin_id')
    
    # Try updating index name
    try:
        op.drop_index('ix_smtp_configurations_super_admin_id', table_name='smtp_configurations', if_exists=True)
        op.create_index(op.f('ix_smtp_configurations_admin_id'), 'smtp_configurations', ['admin_id'], unique=True)
    except Exception:
        pass

    # Try updating constraint name
    try:
        op.drop_constraint('uq_smtp_super_admin_id', 'smtp_configurations', type_='unique')
        op.create_unique_constraint('uq_smtp_admin_id', 'smtp_configurations', ['admin_id'])
    except Exception:
        pass


def downgrade() -> None:
    op.alter_column('smtp_configurations', 'admin_id', new_column_name='super_admin_id')
    try:
        op.drop_index(op.f('ix_smtp_configurations_admin_id'), table_name='smtp_configurations')
        op.create_index('ix_smtp_configurations_super_admin_id', 'smtp_configurations', ['super_admin_id'], unique=True)
    except Exception:
        pass

    try:
        op.drop_constraint('uq_smtp_admin_id', 'smtp_configurations', type_='unique')
        op.create_unique_constraint('uq_smtp_super_admin_id', 'smtp_configurations', ['super_admin_id'])
    except Exception:
        pass
