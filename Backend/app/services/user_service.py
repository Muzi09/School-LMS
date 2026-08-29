from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import hash_password
from app.models.admin import AdminProfile
from app.models.enums import UserRole
from app.models.school import School
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User
from app.repositories.school_repository import SchoolRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    CreateAdminRequest,
    CreateStudentRequest,
    CreateTeacherRequest,
    UserUpdate,
)


class UserService:
    """
    Business Logic Service for User Management and Role-specific Profiles.
    Coordinates between repositories, validates domain invariants, and manages transactions.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        school_repo: SchoolRepository,
        db: Session,
    ):
        self.user_repo = user_repo
        self.school_repo = school_repo
        self.db = db

    def verify_school_exists(self, school_id: UUID) -> School:
        """Verify school exists and is active."""
        school = self.school_repo.get_by_id(school_id)
        if not school:
            raise NotFoundException(f"School with ID '{school_id}' does not exist or is deleted.")
        if not school.is_active:
            raise BadRequestException(f"School '{school.name}' is currently inactive.")
        return school

    def verify_email_available(self, email: str, exclude_user_id: UUID | None = None) -> None:
        """Verify that the email is not already taken by an active user."""
        existing = self.user_repo.get_by_email(email=email, exclude_user_id=exclude_user_id)
        if existing:
            raise ConflictException(f"User with email '{email}' already exists.")

    def create_admin(
        self,
        data: CreateAdminRequest,
        created_by_id: UUID | None = None,
    ) -> User:
        """Create a School Admin user with AdminProfile atomically."""
        self.verify_school_exists(data.school_id)
        self.verify_email_available(data.email)

        try:
            # 1. Create User
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                phone=data.phone,
                password_hash=hash_password(data.password),
                role=UserRole.ADMIN,
                school_id=data.school_id,
                is_active=True,
                is_verified=True,
                created_by=created_by_id,
                updated_by=created_by_id,
            )
            self.user_repo.create(user, autocommit=False)

            # 2. Create AdminProfile
            profile_data = data.profile.model_dump() if data.profile else {}
            admin_profile = AdminProfile(
                user_id=user.id,
                **profile_data,
            )
            self.user_repo.add_admin_profile(admin_profile, autocommit=False)

            self.db.commit()
            return self.get_user_by_id(user.id)
        except Exception:
            self.db.rollback()
            raise

    def create_teacher(
        self,
        data: CreateTeacherRequest,
        created_by_id: UUID | None = None,
    ) -> User:
        """Create a Teacher user with TeacherProfile atomically."""
        self.verify_school_exists(data.school_id)
        self.verify_email_available(data.email)

        try:
            # 1. Create User
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                phone=data.phone,
                password_hash=hash_password(data.password),
                role=UserRole.TEACHER,
                school_id=data.school_id,
                is_active=True,
                is_verified=True,
                created_by=created_by_id,
                updated_by=created_by_id,
            )
            self.user_repo.create(user, autocommit=False)

            # 2. Create TeacherProfile
            teacher_profile = TeacherProfile(
                user_id=user.id,
                **data.profile.model_dump(),
            )
            self.user_repo.add_teacher_profile(teacher_profile, autocommit=False)

            self.db.commit()
            return self.get_user_by_id(user.id)
        except Exception:
            self.db.rollback()
            raise

    def create_student(
        self,
        data: CreateStudentRequest,
        created_by_id: UUID | None = None,
    ) -> User:
        """Create a Student user with StudentProfile atomically."""
        self.verify_school_exists(data.school_id)
        self.verify_email_available(data.email)

        try:
            # 1. Create User
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                phone=data.phone,
                password_hash=hash_password(data.password),
                role=UserRole.STUDENT,
                school_id=data.school_id,
                is_active=True,
                is_verified=True,
                created_by=created_by_id,
                updated_by=created_by_id,
            )
            self.user_repo.create(user, autocommit=False)

            # 2. Create StudentProfile
            student_profile = StudentProfile(
                user_id=user.id,
                **data.profile.model_dump(),
            )
            self.user_repo.add_student_profile(student_profile, autocommit=False)

            self.db.commit()
            return self.get_user_by_id(user.id)
        except Exception:
            self.db.rollback()
            raise

    def get_user_by_id(self, user_id: UUID) -> User:
        """Retrieve user with profiles eager-loaded."""
        user = self.user_repo.get_by_id_with_profiles(user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")
        return user

    def list_users(
        self,
        school_id: UUID | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[User], int]:
        """List users with filtering, searching, and pagination."""
        skip = (page - 1) * page_size
        return self.user_repo.list_users(
            school_id=school_id,
            role=role,
            is_active=is_active,
            search=search,
            skip=skip,
            limit=page_size,
        )

    def update_user(
        self,
        user_id: UUID,
        data: UserUpdate,
        updated_by_id: UUID | None = None,
    ) -> User:
        """Update core user information and profile fields."""
        user = self.get_user_by_id(user_id)

        if data.email and data.email.lower() != user.email.lower():
            self.verify_email_available(data.email, exclude_user_id=user_id)
            user.email = data.email

        if data.first_name is not None:
            user.first_name = data.first_name
        if data.last_name is not None:
            user.last_name = data.last_name
        if data.phone is not None:
            user.phone = data.phone
        if data.password is not None:
            user.password_hash = hash_password(data.password)
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.is_verified is not None:
            user.is_verified = data.is_verified

        user.updated_by = updated_by_id
        user.updated_at = datetime.utcnow()

        # Update Admin Profile
        if data.admin_profile and user.admin_profile:
            for key, value in data.admin_profile.model_dump(exclude_unset=True).items():
                setattr(user.admin_profile, key, value)

        # Update Teacher Profile
        if data.teacher_profile and user.teacher_profile:
            for key, value in data.teacher_profile.model_dump(exclude_unset=True).items():
                setattr(user.teacher_profile, key, value)

        # Update Student Profile
        if data.student_profile and user.student_profile:
            for key, value in data.student_profile.model_dump(exclude_unset=True).items():
                setattr(user.student_profile, key, value)

        self.db.commit()
        self.db.refresh(user)
        return user

    def change_user_status(
        self,
        user_id: UUID,
        is_active: bool,
        updated_by_id: UUID | None = None,
    ) -> User:
        """Activate or deactivate a user account."""
        user = self.get_user_by_id(user_id)
        user.is_active = is_active
        user.updated_by = updated_by_id
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user

    def soft_delete_user(
        self,
        user_id: UUID,
        deleted_by_id: UUID | None = None,
    ) -> None:
        """Soft delete a user."""
        user = self.get_user_by_id(user_id)
        self.user_repo.soft_delete(
            instance=user,
            deleted_by_id=deleted_by_id,
            autocommit=True,
        )
