from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.enums import UserRole
from app.models.principal import PrincipalProfile
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
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
                joinedload(User.principal_profile),
                joinedload(User.staff_profile),
                joinedload(User.student_profile),
            )
            .where(User.id == user_id)
        )
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))

        return self.db.scalars(stmt).first()

    def get_by_email(self, email: str, exclude_user_id: UUID | None = None) -> User | None:
        """Find non-deleted user by case-insensitive email address."""
        stmt = (
            select(User)
            .options(joinedload(User.principal_profile))
            .where(
                func.lower(User.email) == email.lower(),
                User.deleted_at.is_(None),
            )
        )
        if exclude_user_id:
            stmt = stmt.where(User.id != exclude_user_id)

        return self.db.scalars(stmt).first()

    def get_by_login_mobile(self, login_mobile: str, exclude_user_id: UUID | None = None) -> User | None:
        """Find non-deleted user by login mobile number."""
        stmt = (
            select(User)
            .options(joinedload(User.principal_profile))
            .where(
                User.login_mobile == login_mobile,
                User.deleted_at.is_(None),
            )
        )
        if exclude_user_id:
            stmt = stmt.where(User.id != exclude_user_id)

        return self.db.scalars(stmt).first()

    def list_users(
        self,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        """List users across roles with search, filter, and pagination."""
        stmt = select(User).where(User.deleted_at.is_(None))
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
                    User.login_mobile.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        stmt = (
            stmt.options(
                joinedload(User.principal_profile),
                joinedload(User.staff_profile),
                joinedload(User.student_profile),
            )
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        items = list(self.db.scalars(stmt).unique().all())
        return items, total

    def list_staff(
        self,
        is_active: bool | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        """List Staff users only."""
        stmt = select(User).where(User.deleted_at.is_(None), User.role == UserRole.STAFF)

        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)

        if search:
            search_term = f"%{search.strip()}%"
            stmt = stmt.outerjoin(User.staff_profile).where(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.login_mobile.ilike(search_term),
                    StaffProfile.roll_no.ilike(search_term),
                    StaffProfile.father_first_name.ilike(search_term),
                    StaffProfile.father_last_name.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        stmt = (
            stmt.options(joinedload(User.staff_profile))
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        items = list(self.db.scalars(stmt).unique().all())
        return items, total

    def list_students(
        self,
        is_active: bool | None = None,
        class_name: str | None = None,
        section: str | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        """List Student users only."""
        stmt = select(User).where(User.deleted_at.is_(None), User.role == UserRole.STUDENT)

        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)

        stmt = stmt.outerjoin(User.student_profile)

        if class_name:
            stmt = stmt.where(StudentProfile.class_name == class_name)
        if section:
            stmt = stmt.where(StudentProfile.section == section)

        if search:
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                    User.login_mobile.ilike(search_term),
                    StudentProfile.middle_name.ilike(search_term),
                    StudentProfile.roll_no.ilike(search_term),
                    StudentProfile.class_name.ilike(search_term),
                    StudentProfile.section.ilike(search_term),
                    StudentProfile.house.ilike(search_term),
                    StudentProfile.father_first_name.ilike(search_term),
                    StudentProfile.father_last_name.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        stmt = (
            stmt.options(joinedload(User.student_profile))
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        items = list(self.db.scalars(stmt).unique().all())
        return items, total

    def add_principal_profile(self, profile: PrincipalProfile, autocommit: bool = False) -> PrincipalProfile:
        """Persist a PrincipalProfile."""
        self.db.add(profile)
        if autocommit:
            self.db.commit()
            self.db.refresh(profile)
        else:
            self.db.flush()
        return profile

    def add_staff_profile(self, profile: StaffProfile, autocommit: bool = False) -> StaffProfile:
        """Persist a StaffProfile."""
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
