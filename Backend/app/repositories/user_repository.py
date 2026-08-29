from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.admin import AdminProfile
from app.models.enums import UserRole
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """Data access repository for User entities and their associated role profiles."""

    def __init__(self, db: Session):
        super().__init__(model=User, db=db)

    def get_by_id_with_profiles(self, user_id: UUID, include_deleted: bool = False) -> User | None:
        """Retrieve user with all profiles eager-loaded."""
        stmt = (
            select(User)
            .options(
                joinedload(User.admin_profile),
                joinedload(User.teacher_profile),
                joinedload(User.student_profile),
            )
            .where(User.id == user_id)
        )
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))

        return self.db.scalars(stmt).first()

    def get_by_email(self, email: str, exclude_user_id: UUID | None = None) -> User | None:
        """Find non-deleted user by case-insensitive email address."""
        stmt = select(User).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        )
        if exclude_user_id:
            stmt = stmt.where(User.id != exclude_user_id)

        return self.db.scalars(stmt).first()

    def list_users(
        self,
        school_id: UUID | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        """List users with filtering, searching, and pagination."""
        stmt = select(User).where(User.deleted_at.is_(None))

        if school_id:
            stmt = stmt.where(User.school_id == school_id)
        if role is not None:
            stmt = stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)

        if search:
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.phone.ilike(search_term),
                )
            )

        # Count total matching rows
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        # Eager load relationships & paginate
        stmt = (
            stmt.options(
                joinedload(User.admin_profile),
                joinedload(User.teacher_profile),
                joinedload(User.student_profile),
            )
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        items = list(self.db.scalars(stmt).unique().all())
        return items, total

    def add_admin_profile(self, profile: AdminProfile, autocommit: bool = False) -> AdminProfile:
        """Persist an AdminProfile."""
        self.db.add(profile)
        if autocommit:
            self.db.commit()
            self.db.refresh(profile)
        else:
            self.db.flush()
        return profile

    def add_teacher_profile(self, profile: TeacherProfile, autocommit: bool = False) -> TeacherProfile:
        """Persist a TeacherProfile."""
        self.db.add(profile)
        if autocommit:
            self.db.commit()
            self.db.refresh(profile)
        else:
            self.db.flush()
        return profile

    def add_student_profile(self, profile: StudentProfile, autocommit: bool = False) -> StudentProfile:
        """Persist a StudentProfile."""
        self.db.add(profile)
        if autocommit:
            self.db.commit()
            self.db.refresh(profile)
        else:
            self.db.flush()
        return profile
