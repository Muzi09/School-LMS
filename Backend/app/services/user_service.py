from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import generate_onboarding_token, hash_password, hash_pin, hash_token
from app.models.enums import UserRole
from app.models.principal import PrincipalProfile
from app.models.staff import StaffProfile
from app.models.staff_onboarding_token import StaffOnboardingToken
from app.models.student import StudentProfile
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import CreatePrincipalRequest, UserUpdate
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
    # PRINCIPAL OPERATIONS
    # ----------------------------------------------------
    def create_principal(
        self,
        data: CreatePrincipalRequest,
        created_by_id: UUID | None = None,
        school_id: UUID | None = None,
    ) -> User:
        """Create a Principal user with PrincipalProfile atomically."""
        if data.email:
            self.verify_email_available(data.email)
        self.verify_mobile_available(data.login_mobile)

        try:
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                login_mobile=data.login_mobile,
                password_hash=hash_password(data.password) if data.password else None,
                role=UserRole.PRINCIPAL,
                is_active=True,
                created_by=created_by_id,
            )
            created_user = self.user_repo.create(user, autocommit=False)

            profile = PrincipalProfile(
                user_id=created_user.id,
                school_id=school_id,
                pin_hash=None,
                school_setup_completed=False,
            )
            self.user_repo.add_principal_profile(profile, autocommit=False)

            self.db.commit()
            return self.user_repo.get_by_id_with_profiles(created_user.id)
        except Exception:
            self.db.rollback()
            raise

    # ----------------------------------------------------
    # STAFF OPERATIONS
    # ----------------------------------------------------
    def create_staff(
        self,
        data: CreateStaffRequest,
        created_by_id: UUID | None = None,
        school_id: UUID | None = None,
    ) -> tuple[User, str]:
        """
        Create a Staff user with StaffProfile atomically in PENDING_ACTIVATION state.
        Generates a secure single-use first login setup token.
        Returns (user, raw_token).
        """
        self.verify_email_available(data.email)
        self.verify_mobile_available(data.login_mobile)

        try:
            # 1. Create User Account (without password - set by Staff on first login)
            user = User(
                first_name=data.first_name,
                last_name=data.last_name,
                email=data.email,
                login_mobile=data.login_mobile,
                password_hash=None,
                role=UserRole.STAFF,
                is_active=True,
                created_by=created_by_id,
                updated_by=created_by_id,
            )
            self.user_repo.create(user, autocommit=False)

            # 2. Create StaffProfile with PENDING_ACTIVATION status
            profile_data = data.profile.model_dump() if data.profile else {}
            staff_profile = StaffProfile(
                user_id=user.id,
                school_id=school_id,
                status="PENDING_ACTIVATION",
                **profile_data,
            )
            self.user_repo.add_staff_profile(staff_profile, autocommit=False)

            # 3. Generate secure onboarding token
            raw_token, token_hash = generate_onboarding_token()
            expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.ONBOARDING_TOKEN_EXPIRE_HOURS)
            token_record = StaffOnboardingToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
            self.db.add(token_record)

            self.db.commit()
            created_user = self.get_staff_by_id(user.id)
            return created_user, raw_token
        except Exception:
            self.db.rollback()
            raise

    def generate_staff_setup_token(self, staff_id: UUID) -> tuple[str, StaffOnboardingToken]:
        """Generate a secure onboarding token for Staff first login setup."""
        raw_token, token_hash = generate_onboarding_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.ONBOARDING_TOKEN_EXPIRE_HOURS)
        token_record = StaffOnboardingToken(
            user_id=staff_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(token_record)
        return raw_token, token_record

    def validate_staff_setup_token(self, raw_token: str) -> tuple[StaffOnboardingToken, User]:
        """Validate staff setup token exists, unexpired, and unused."""
        raw_clean = (raw_token or "").strip()
        if not raw_clean:
            raise BadRequestException("Setup token is required.")

        t_hash = hash_token(raw_clean)
        token_record = (
            self.db.query(StaffOnboardingToken)
            .filter(StaffOnboardingToken.token_hash == t_hash)
            .first()
        )

        if not token_record:
            raise NotFoundException("Invalid or unrecognized setup link.")

        if token_record.used_at is not None:
            raise BadRequestException(
                "This setup link has already been used. Please log in with your credentials on the normal login page."
            )

        now_utc = datetime.now(timezone.utc)
        if token_record.expires_at < now_utc:
            raise BadRequestException(
                "This setup link has expired. Please ask your School Principal to resend your setup link."
            )

        user = self.user_repo.get_by_id_with_profiles(token_record.user_id)
        if not user or not user.is_active or user.role != UserRole.STAFF:
            raise BadRequestException("Invalid staff account for this setup link.")

        if user.staff_profile and user.staff_profile.status == "ACTIVE":
            raise BadRequestException(
                "This staff account has already been activated. Please use the normal login page."
            )

        return token_record, user

    def complete_staff_setup(self, raw_token: str, password: str, pin: str) -> User:
        """Atomically activate staff account by setting password, PIN, and status=ACTIVE."""
        token_record, user = self.validate_staff_setup_token(raw_token)

        try:
            user.password_hash = hash_password(password)
            if user.staff_profile:
                user.staff_profile.pin_hash = hash_pin(pin)
                user.staff_profile.status = "ACTIVE"
                user.staff_profile.activated_at = datetime.now(timezone.utc)
            user.updated_at = datetime.now(timezone.utc)

            token_record.used_at = datetime.now(timezone.utc)

            self.db.commit()
            return self.get_staff_by_id(user.id)
        except Exception:
            self.db.rollback()
            raise

    def resend_staff_setup_token(self, staff_id: UUID) -> tuple[User, str]:
        """Invalidate old tokens and generate a fresh setup token for pending staff."""
        user = self.get_staff_by_id(staff_id)
        if user.staff_profile and user.staff_profile.status == "ACTIVE":
            raise BadRequestException("This staff member has already activated their account.")

        # Invalidate any existing active tokens for this user
        now_utc = datetime.now(timezone.utc)
        self.db.query(StaffOnboardingToken).filter(
            StaffOnboardingToken.user_id == staff_id,
            StaffOnboardingToken.used_at.is_(None),
        ).update({"used_at": now_utc}, synchronize_session=False)

        raw_token, _ = self.generate_staff_setup_token(staff_id)
        self.db.commit()
        return user, raw_token

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
    def calculate_roll_number(
        self,
        first_name: str,
        last_name: str,
        class_name: str,
        section: str,
        student_id: UUID | None = None,
    ) -> tuple[str, int]:
        """
        Calculate preview roll number for a student in a class & section
        sorted alphabetically by first_name, then last_name.
        Returns (calculated_roll_no, total_students_count).
        """
        fn = first_name.strip()
        ln = last_name.strip()
        cn = class_name.strip()
        sec = section.strip()

        stmt = (
            select(User)
            .join(User.student_profile)
            .where(
                User.deleted_at.is_(None),
                User.role == UserRole.STUDENT,
                StudentProfile.class_name == cn,
                StudentProfile.section == sec,
            )
        )
        if student_id:
            stmt = stmt.where(User.id != student_id)

        existing_students = list(self.db.scalars(stmt).unique().all())

        # Build comparison list with candidate
        student_entries = [
            (u.first_name.strip(), u.last_name.strip(), False)
            for u in existing_students
        ]
        student_entries.append((fn, ln, True))

        # Sort alphabetically (case-insensitive) by first_name, then last_name
        student_entries.sort(key=lambda x: (x[0].casefold(), x[1].casefold()))

        for idx, entry in enumerate(student_entries, start=1):
            if entry[2]:  # candidate found
                return str(idx), len(student_entries)

        return "1", 1

    def reassign_class_section_roll_numbers(
        self,
        class_name: str,
        section: str,
    ) -> None:
        """
        Reassigns roll numbers sequentially (1, 2, ..., N) to all active students
        in a given class and section, sorted alphabetically by first_name, then last_name.
        """
        cn = class_name.strip()
        sec = section.strip()
        if not cn or not sec:
            return

        stmt = (
            select(User)
            .join(User.student_profile)
            .where(
                User.deleted_at.is_(None),
                User.role == UserRole.STUDENT,
                StudentProfile.class_name == cn,
                StudentProfile.section == sec,
            )
            .options(joinedload(User.student_profile))
            .order_by(
                func.lower(User.first_name).asc(),
                func.lower(User.last_name).asc(),
                func.lower(func.coalesce(StudentProfile.middle_name, "")).asc(),
                User.created_at.asc(),
            )
        )
        students = list(self.db.scalars(stmt).unique().all())

        for idx, student in enumerate(students, start=1):
            if student.student_profile:
                new_roll = str(idx)
                if student.student_profile.roll_no != new_roll:
                    student.student_profile.roll_no = new_roll
                    self.db.add(student.student_profile)

    def create_student(
        self,
        data: CreateStudentRequest,
        created_by_id: UUID | None = None,
        school_id: UUID | None = None,
    ) -> User:
        """Create a Student user with StudentProfile atomically."""
        if data.email:
            self.verify_email_available(data.email)
        self.verify_mobile_available(data.login_mobile)

        try:
            # 1. Create User Account
            user = User(
                first_name=data.first_name.strip(),
                last_name=data.last_name.strip(),
                email=data.email.strip() if data.email else None,
                login_mobile=data.login_mobile.strip(),
                password_hash=hash_password(data.password) if data.password else None,
                role=UserRole.STUDENT,
                is_active=True,
                created_by=created_by_id,
                updated_by=created_by_id,
            )
            self.user_repo.create(user, autocommit=False)

            # 2. Create StudentProfile
            profile_dict = data.profile.model_dump()
            if not profile_dict.get("roll_no"):
                profile_dict["roll_no"] = "temp"

            student_profile = StudentProfile(
                user_id=user.id,
                school_id=school_id,
                **profile_dict,
            )
            self.user_repo.add_student_profile(student_profile, autocommit=False)
            self.db.flush()

            # 3. Automatically assign/reorder sequential alphabetical roll numbers for the class & section
            self.reassign_class_section_roll_numbers(
                class_name=student_profile.class_name,
                section=student_profile.section,
            )

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

        old_first_name = user.first_name
        old_last_name = user.last_name
        old_class_name = user.student_profile.class_name if user.student_profile else None
        old_section = user.student_profile.section if user.student_profile else None

        if data.email is not None and (user.email is None or data.email.lower() != user.email.lower()):
            self.verify_email_available(data.email, exclude_user_id=student_id)
            user.email = data.email

        if data.login_mobile is not None and data.login_mobile != user.login_mobile:
            self.verify_mobile_available(data.login_mobile, exclude_user_id=student_id)
            user.login_mobile = data.login_mobile

        if data.first_name is not None:
            user.first_name = data.first_name.strip()
        if data.last_name is not None:
            user.last_name = data.last_name.strip()
        if data.password is not None:
            user.password_hash = hash_password(data.password) if data.password else None
        if data.is_active is not None:
            user.is_active = data.is_active

        user.updated_by = updated_by_id
        user.updated_at = datetime.utcnow()

        if data.profile and user.student_profile:
            for key, value in data.profile.model_dump(exclude_unset=True).items():
                setattr(user.student_profile, key, value)

        self.db.flush()

        new_class_name = user.student_profile.class_name if user.student_profile else None
        new_section = user.student_profile.section if user.student_profile else None

        name_changed = (user.first_name != old_first_name) or (user.last_name != old_last_name)
        class_section_changed = (new_class_name != old_class_name) or (new_section != old_section)

        if new_class_name and new_section and (name_changed or class_section_changed):
            self.reassign_class_section_roll_numbers(new_class_name, new_section)
            if class_section_changed and old_class_name and old_section:
                self.reassign_class_section_roll_numbers(old_class_name, old_section)

        self.db.commit()
        self.db.refresh(user)
        return user

    # ----------------------------------------------------
    # GENERAL USER OPERATIONS
    # ----------------------------------------------------
    def get_user_by_id(self, user_id: UUID) -> User:
        """Retrieve user with all profiles eager-loaded."""
        user = self.user_repo.get_by_id_with_profiles(user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")
        return user

    def list_users(
        self,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[User], int]:
        """List users with role filters, search, and pagination."""
        skip = (page - 1) * page_size
        return self.user_repo.list_users(
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
        """Update user general details and role profile details."""
        user = self.get_user_by_id(user_id)

        if data.email is not None and (user.email is None or data.email.lower() != user.email.lower()):
            self.verify_email_available(data.email, exclude_user_id=user_id)
            user.email = data.email

        if data.login_mobile is not None and data.login_mobile != user.login_mobile:
            self.verify_mobile_available(data.login_mobile, exclude_user_id=user_id)
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

        if data.principal_profile and user.principal_profile:
            for key, value in data.principal_profile.model_dump(exclude_unset=True).items():
                setattr(user.principal_profile, key, value)
        elif data.staff_profile and user.staff_profile:
            for key, value in data.staff_profile.model_dump(exclude_unset=True).items():
                setattr(user.staff_profile, key, value)
        elif data.student_profile and user.student_profile:
            for key, value in data.student_profile.model_dump(exclude_unset=True).items():
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
        user = self.user_repo.get_by_id_with_profiles(user_id)
        if not user:
            raise NotFoundException(f"User with ID '{user_id}' not found.")

        class_name = user.student_profile.class_name if user.student_profile else None
        section = user.student_profile.section if user.student_profile else None
        is_student = user.role == UserRole.STUDENT

        self.user_repo.soft_delete(
            instance=user,
            deleted_by_id=deleted_by_id,
            autocommit=False,
        )

        if is_student and class_name and section:
            self.reassign_class_section_roll_numbers(class_name, section)

        self.db.commit()
