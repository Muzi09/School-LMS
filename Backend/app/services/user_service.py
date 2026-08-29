from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException, NotFoundException
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.staff import CreateStaffRequest, StaffUpdate
from app.schemas.student import CreateStudentRequest, StudentUpdate


class UserService:
    """
    Business Logic Service for Staff and Student management.
    Ensures complete domain separation between Staff and Students.
    """

    def __init__(
        self,
        user_repo: UserRepository,
        db: Session,
    ):
        self.user_repo = user_repo
        self.db = db

    def verify_email_available(self, email: str, exclude_user_id: UUID | None = None) -> None:
        """Verify that the email is not already taken by an active user."""
        existing = self.user_repo.get_by_email(email=email, exclude_user_id=exclude_user_id)
        if existing:
            raise ConflictException(f"User with email '{email}' already exists.")

    def verify_mobile_available(self, login_mobile: str, exclude_user_id: UUID | None = None) -> None:
        """Verify that the login mobile is not already taken by an active user."""
        existing = self.user_repo.get_by_login_mobile(login_mobile=login_mobile, exclude_user_id=exclude_user_id)
        if existing:
            raise ConflictException(f"User with login mobile '{login_mobile}' already exists.")

    # ----------------------------------------------------
    # STAFF OPERATIONS
    # ----------------------------------------------------
    def create_staff(
        self,
        data: CreateStaffRequest,
        created_by_id: UUID | None = None,
    ) -> User:
        """Create a Staff user with StaffProfile atomically."""
        self.verify_email_available(data.email)
        self.verify_mobile_available(data.login_mobile)

        try:
            # 1. Create User Account
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                login_mobile=data.login_mobile,
                password_hash=hash_password(data.password),
                role=UserRole.STAFF,
                is_active=True,
                created_by=created_by_id,
                updated_by=created_by_id,
            )
            self.user_repo.create(user, autocommit=False)

            # 2. Create StaffProfile
            profile_data = data.profile.model_dump() if data.profile else {}
            staff_profile = StaffProfile(
                user_id=user.id,
                **profile_data,
            )
            self.user_repo.add_staff_profile(staff_profile, autocommit=False)

            self.db.commit()
            return self.get_staff_by_id(user.id)
        except Exception:
            self.db.rollback()
            raise

    def get_staff_by_id(self, staff_id: UUID) -> User:
        """Retrieve staff user by ID."""
        user = self.user_repo.get_by_id_with_profiles(staff_id)
        if not user or user.role != UserRole.STAFF:
            raise NotFoundException(f"Staff member with ID '{staff_id}' not found.")
        return user

    def list_staff(
        self,
        is_active: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[User], int]:
        """List staff members with search, filters, and pagination."""
        skip = (page - 1) * page_size
        return self.user_repo.list_staff(
            is_active=is_active,
            search=search,
            skip=skip,
            limit=page_size,
        )

    def update_staff(
        self,
        staff_id: UUID,
        data: StaffUpdate,
        updated_by_id: UUID | None = None,
    ) -> User:
        """Update staff user information and profile fields."""
        user = self.get_staff_by_id(staff_id)

        if data.email is not None and (user.email is None or data.email.lower() != user.email.lower()):
            self.verify_email_available(data.email, exclude_user_id=staff_id)
            user.email = data.email

        if data.login_mobile is not None and data.login_mobile != user.login_mobile:
            self.verify_mobile_available(data.login_mobile, exclude_user_id=staff_id)
            user.login_mobile = data.login_mobile

        if data.first_name is not None:
            user.first_name = data.first_name
        if data.last_name is not None:
            user.last_name = data.last_name
        if data.password is not None:
            user.password_hash = hash_password(data.password)
        if data.is_active is not None:
            user.is_active = data.is_active

        user.updated_by = updated_by_id
        user.updated_at = datetime.utcnow()

        if data.profile and user.staff_profile:
            for key, value in data.profile.model_dump(exclude_unset=True).items():
                setattr(user.staff_profile, key, value)

        self.db.commit()
        self.db.refresh(user)
        return user

    # ----------------------------------------------------
    # STUDENT OPERATIONS
    # ----------------------------------------------------
    def create_student(
        self,
        data: CreateStudentRequest,
        created_by_id: UUID | None = None,
    ) -> User:
        """Create a Student user with StudentProfile atomically."""
        if data.email:
            self.verify_email_available(data.email)
        self.verify_mobile_available(data.login_mobile)

        try:
            # 1. Create User Account
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                login_mobile=data.login_mobile,
                password_hash=hash_password(data.password),
                role=UserRole.STUDENT,
                is_active=True,
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
            return self.get_student_by_id(user.id)
        except Exception:
            self.db.rollback()
            raise

    def get_student_by_id(self, student_id: UUID) -> User:
        """Retrieve student user by ID."""
        user = self.user_repo.get_by_id_with_profiles(student_id)
        if not user or user.role != UserRole.STUDENT:
            raise NotFoundException(f"Student with ID '{student_id}' not found.")
        return user

    def list_students(
        self,
        is_active: bool | None = None,
        class_name: str | None = None,
        section: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[User], int]:
        """List student members with search, filters, and pagination."""
        skip = (page - 1) * page_size
        return self.user_repo.list_students(
            is_active=is_active,
            class_name=class_name,
            section=section,
            search=search,
            skip=skip,
            limit=page_size,
        )

    def update_student(
        self,
        student_id: UUID,
        data: StudentUpdate,
        updated_by_id: UUID | None = None,
    ) -> User:
        """Update student user information and profile fields."""
        user = self.get_student_by_id(student_id)

        if data.email is not None and (user.email is None or data.email.lower() != user.email.lower()):
            self.verify_email_available(data.email, exclude_user_id=student_id)
            user.email = data.email

        if data.login_mobile is not None and data.login_mobile != user.login_mobile:
            self.verify_mobile_available(data.login_mobile, exclude_user_id=student_id)
            user.login_mobile = data.login_mobile

        if data.first_name is not None:
            user.first_name = data.first_name
        if data.last_name is not None:
            user.last_name = data.last_name
        if data.password is not None:
            user.password_hash = hash_password(data.password)
        if data.is_active is not None:
            user.is_active = data.is_active

        user.updated_by = updated_by_id
        user.updated_at = datetime.utcnow()

        if data.profile and user.student_profile:
            for key, value in data.profile.model_dump(exclude_unset=True).items():
                setattr(user.student_profile, key, value)

        self.db.commit()
        self.db.refresh(user)
        return user

    # ----------------------------------------------------
    # COMMON STATUS & DELETE
    # ----------------------------------------------------
    def change_user_status(
        self,
        user_id: UUID,
        is_active: bool,
        updated_by_id: UUID | None = None,
    ) -> User:
        """Activate or deactivate a user account."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")
        user.is_active = is_active
        user.updated_by = updated_by_id
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return self.user_repo.get_by_id_with_profiles(user_id)

    def soft_delete_user(
        self,
        user_id: UUID,
        deleted_by_id: UUID | None = None,
    ) -> None:
        """Soft delete a user."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")
        self.user_repo.soft_delete(
            instance=user,
            deleted_by_id=deleted_by_id,
            autocommit=True,
        )
