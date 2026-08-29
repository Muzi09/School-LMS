"""update role enum

Revision ID: 95dcde8a17c0
Revises: df4885752c2a
Create Date: 2026-08-28 18:24:08.922963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95dcde8a17c0'
down_revision: Union[str, Sequence[str], None] = 'df4885752c2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'users',
        'role',
        existing_type=sa.Enum('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', name='user_role'),
        type_=sa.SmallInteger(),
        existing_nullable=False,
        postgresql_using="""
            CASE role::text
                WHEN 'SUPER_ADMIN' THEN 1
                WHEN 'ADMIN' THEN 2
                WHEN 'TEACHER' THEN 3
                WHEN 'STUDENT' THEN 4
                ELSE role::text::smallint
            END
        """
    )
    sa.Enum(name='user_role').drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    user_role_enum = sa.Enum('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', name='user_role')
    user_role_enum.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        'users',
        'role',
        existing_type=sa.SmallInteger(),
        type_=user_role_enum,
        existing_nullable=False,
        postgresql_using="""
            CASE role
                WHEN 1 THEN 'SUPER_ADMIN'::user_role
                WHEN 2 THEN 'ADMIN'::user_role
                WHEN 3 THEN 'TEACHER'::user_role
                WHEN 4 THEN 'STUDENT'::user_role
                ELSE 'STUDENT'::user_role
            END
        """
    )
