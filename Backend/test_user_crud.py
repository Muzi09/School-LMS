from datetime import date
from uuid import uuid4

from app.controllers.user_controller import UserController
from app.core.database import SessionLocal
from app.core.exceptions import ConflictException, NotFoundException
from app.models.enums import Gender, UserRole
from app.models.school import School
from app.repositories.school_repository import SchoolRepository
from app.repositories.user_repository import UserRepository
from app.schemas.profile import AdminProfileCreate, StudentProfileCreate, TeacherProfileCreate
from app.schemas.user import (
    CreateAdminRequest,
    CreateStudentRequest,
    CreateTeacherRequest,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.user_service import UserService


def run_tests():
    db = SessionLocal()
    try:
        # Initialize N-Tier Layer stack
        school_repo = SchoolRepository(db=db)
        user_repo = UserRepository(db=db)
        user_service = UserService(user_repo=user_repo, school_repo=school_repo, db=db)
        user_controller = UserController(user_service=user_service)

        print("1. Checking/Creating test school via Repository...")
        school = school_repo.get_by_code("TEST-SCH-01")
        if not school:
            school = School(
                name="Test International Academy",
                code="TEST-SCH-01",
                email="info@testschool.edu",
                is_active=True,
            )
            school = school_repo.create(school)
        print(f"   School ID: {school.id}")

        suffix = uuid4().hex[:6]

        print("2. Creating Admin User via Controller...")
        admin_req = CreateAdminRequest(
            first_name="Alice",
            last_name="Administrator",
            email=f"admin_{suffix}@testschool.edu",
            phone="1234567890",
            password="SecurePassword123!",
            school_id=school.id,
            profile=AdminProfileCreate(
                employee_code=f"ADM-{suffix}",
                designation="Principal",
                department="Management",
            ),
        )
        admin_read = user_controller.create_admin(data=admin_req)
        assert admin_read.role == UserRole.ADMIN
        assert admin_read.admin_profile is not None
        assert admin_read.admin_profile.designation == "Principal"
        print(f"   Admin created: {admin_read.id}, Designation: {admin_read.admin_profile.designation}")

        print("3. Creating Teacher User via Controller...")
        teacher_req = CreateTeacherRequest(
            first_name="Bob",
            last_name="Teacher",
            email=f"teacher_{suffix}@testschool.edu",
            phone="9876543210",
            password="SecurePassword123!",
            school_id=school.id,
            profile=TeacherProfileCreate(
                employee_code=f"TCH-{suffix}",
                designation="Senior Lecturer",
                department="Physics",
                qualification="M.Sc Physics, B.Ed",
                specialization="Classical Mechanics",
                experience_years=5,
                joining_date=date(2022, 8, 1),
            ),
        )
        teacher_read = user_controller.create_teacher(data=teacher_req)
        assert teacher_read.role == UserRole.TEACHER
        assert teacher_read.teacher_profile is not None
        assert teacher_read.teacher_profile.department == "Physics"
        print(f"   Teacher created: {teacher_read.id}, Dept: {teacher_read.teacher_profile.department}")

        print("4. Creating Student User via Controller...")
        student_req = CreateStudentRequest(
            first_name="Charlie",
            last_name="Student",
            email=f"student_{suffix}@testschool.edu",
            phone="5551234567",
            password="SecurePassword123!",
            school_id=school.id,
            profile=StudentProfileCreate(
                admission_number=f"ADM-STU-{suffix}",
                roll_number="101",
                date_of_birth=date(2008, 5, 15),
                gender=Gender.MALE,
                blood_group="O+",
                guardian_name="David Student",
                guardian_relation="Father",
                guardian_phone="5559876543",
                guardian_email="david@example.com",
            ),
        )
        student_read = user_controller.create_student(data=student_req)
        assert student_read.role == UserRole.STUDENT
        assert student_read.student_profile is not None
        assert student_read.student_profile.guardian_name == "David Student"
        print(f"   Student created: {student_read.id}, Guardian: {student_read.student_profile.guardian_name}")

        print("5. Testing List & Search via Controller...")
        paginated_res = user_controller.list_users(school_id=school.id, search="Charlie")
        assert paginated_res.total >= 1
        assert any(u.id == student_read.id for u in paginated_res.items)
        print(f"   Search verified: found {paginated_res.total} matches for 'Charlie'")

        print("6. Testing User Update via Controller...")
        updated_student = user_controller.update_user(
            user_id=student_read.id,
            data=UserUpdate(first_name="Charles"),
        )
        assert updated_student.first_name == "Charles"
        print(f"   Update verified: name is now {updated_student.first_name}")

        print("7. Testing User Status Change via Controller...")
        status_updated = user_controller.change_user_status(
            user_id=student_read.id,
            data=UserStatusUpdate(is_active=False),
        )
        assert status_updated.is_active is False
        print(f"   Status change verified: is_active is now {status_updated.is_active}")

        print("8. Testing Soft Delete via Controller...")
        del_response = user_controller.delete_user(user_id=student_read.id)
        assert "deleted successfully" in del_response.message
        list_after_del = user_controller.list_users(school_id=school.id, search="Charles")
        assert not any(u.id == student_read.id for u in list_after_del.items)
        print("   Soft delete verified: excluded from active list")

        print("9. Testing Domain Exception Handling (Duplicate Email)...")
        try:
            user_controller.create_admin(data=admin_req)
            raise AssertionError("Should have raised ConflictException for duplicate email")
        except ConflictException as e:
            print(f"   ConflictException verified: '{e.message}'")

        print("\nAll N-Tier Architecture integration tests PASSED successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
