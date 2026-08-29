"""update_user_profiles_columns

Revision ID: c7d8e9f0a1b2
Revises: b6e09975e211
Create Date: 2026-08-29 18:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'b6e09975e211'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update users table
    op.alter_column('users', 'phone', new_column_name='login_mobile')
    op.execute("""
        UPDATE users
        SET login_mobile = substring(id::text, 1, 10)
        WHERE login_mobile IS NULL OR login_mobile IN (
            SELECT login_mobile FROM users WHERE deleted_at IS NULL GROUP BY login_mobile HAVING count(*) > 1
        )
    """)
    op.alter_column('users', 'login_mobile', nullable=False)
    op.alter_column('users', 'email', nullable=True)
    op.alter_column('users', 'last_name', nullable=False)

    op.create_index(
        'uq_users_login_mobile_active',
        'users',
        ['login_mobile'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
    )

    # 2. Update admin_profiles table
    op.add_column('admin_profiles', sa.Column('roll_no', sa.String(length=50), nullable=True))
    op.execute("UPDATE admin_profiles SET roll_no = COALESCE(employee_code, 'ADM-000') WHERE roll_no IS NULL")
    op.alter_column('admin_profiles', 'roll_no', nullable=False)

    op.add_column('admin_profiles', sa.Column('gender', sa.SmallInteger(), nullable=True))
    op.execute("UPDATE admin_profiles SET gender = 1 WHERE gender IS NULL")
    op.alter_column('admin_profiles', 'gender', nullable=False)

    op.add_column('admin_profiles', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.execute("UPDATE admin_profiles SET date_of_birth = '1990-01-01' WHERE date_of_birth IS NULL")
    op.alter_column('admin_profiles', 'date_of_birth', nullable=False)

    op.add_column('admin_profiles', sa.Column('father_first_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE admin_profiles SET father_first_name = 'Father' WHERE father_first_name IS NULL")
    op.alter_column('admin_profiles', 'father_first_name', nullable=False)

    op.add_column('admin_profiles', sa.Column('father_last_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE admin_profiles SET father_last_name = 'Admin' WHERE father_last_name IS NULL")
    op.alter_column('admin_profiles', 'father_last_name', nullable=False)

    op.create_index('idx_admin_profiles_roll_no', 'admin_profiles', ['roll_no'], unique=False)

    # 3. Update teacher_profiles table
    op.add_column('teacher_profiles', sa.Column('roll_no', sa.String(length=50), nullable=True))
    op.execute("UPDATE teacher_profiles SET roll_no = COALESCE(employee_code, 'TCH-000') WHERE roll_no IS NULL")
    op.alter_column('teacher_profiles', 'roll_no', nullable=False)
    op.alter_column('teacher_profiles', 'employee_code', nullable=True)

    op.add_column('teacher_profiles', sa.Column('gender', sa.SmallInteger(), nullable=True))
    op.execute("UPDATE teacher_profiles SET gender = 1 WHERE gender IS NULL")
    op.alter_column('teacher_profiles', 'gender', nullable=False)

    op.add_column('teacher_profiles', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.execute("UPDATE teacher_profiles SET date_of_birth = '1990-01-01' WHERE date_of_birth IS NULL")
    op.alter_column('teacher_profiles', 'date_of_birth', nullable=False)

    op.add_column('teacher_profiles', sa.Column('father_first_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE teacher_profiles SET father_first_name = 'Father' WHERE father_first_name IS NULL")
    op.alter_column('teacher_profiles', 'father_first_name', nullable=False)

    op.add_column('teacher_profiles', sa.Column('father_last_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE teacher_profiles SET father_last_name = 'Teacher' WHERE father_last_name IS NULL")
    op.alter_column('teacher_profiles', 'father_last_name', nullable=False)

    op.create_index('idx_teacher_profiles_roll_no', 'teacher_profiles', ['roll_no'], unique=False)

    # 4. Update student_profiles table
    op.add_column('student_profiles', sa.Column('middle_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE student_profiles SET middle_name = '' WHERE middle_name IS NULL")
    op.alter_column('student_profiles', 'middle_name', nullable=False)

    op.add_column('student_profiles', sa.Column('roll_no', sa.String(length=50), nullable=True))
    op.execute("UPDATE student_profiles SET roll_no = COALESCE(roll_number, admission_number, 'STU-000') WHERE roll_no IS NULL")
    op.alter_column('student_profiles', 'roll_no', nullable=False)

    op.execute("UPDATE student_profiles SET gender = 1 WHERE gender IS NULL")
    op.alter_column('student_profiles', 'gender', nullable=False)

    op.execute("UPDATE student_profiles SET date_of_birth = '2010-01-01' WHERE date_of_birth IS NULL")
    op.alter_column('student_profiles', 'date_of_birth', nullable=False)

    op.add_column('student_profiles', sa.Column('class_name', sa.String(length=50), nullable=True))
    op.execute("UPDATE student_profiles SET class_name = '10' WHERE class_name IS NULL")
    op.alter_column('student_profiles', 'class_name', nullable=False)

    op.add_column('student_profiles', sa.Column('section', sa.String(length=50), nullable=True))
    op.execute("UPDATE student_profiles SET section = 'A' WHERE section IS NULL")
    op.alter_column('student_profiles', 'section', nullable=False)

    op.add_column('student_profiles', sa.Column('house', sa.String(length=50), nullable=True))
    op.execute("UPDATE student_profiles SET house = 'Red' WHERE house IS NULL")
    op.alter_column('student_profiles', 'house', nullable=False)

    op.add_column('student_profiles', sa.Column('father_first_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE student_profiles SET father_first_name = 'Father' WHERE father_first_name IS NULL")
    op.alter_column('student_profiles', 'father_first_name', nullable=False)

    op.add_column('student_profiles', sa.Column('father_last_name', sa.String(length=100), nullable=True))
    op.execute("UPDATE student_profiles SET father_last_name = 'Student' WHERE father_last_name IS NULL")
    op.alter_column('student_profiles', 'father_last_name', nullable=False)

    op.alter_column('student_profiles', 'admission_number', nullable=True)
    op.alter_column('student_profiles', 'guardian_name', nullable=True)
    op.alter_column('student_profiles', 'guardian_phone', nullable=True)

    op.create_index('idx_student_profiles_roll_no', 'student_profiles', ['roll_no'], unique=False)
    op.create_index('idx_student_profiles_class_section', 'student_profiles', ['class_name', 'section'], unique=False)


def downgrade() -> None:
    pass
