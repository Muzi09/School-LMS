from datetime import date
from uuid import uuid4

from app.controllers.user_controller import UserController
from app.core.database import SessionLocal
from app.core.exceptions import ConflictException
from app.models.enums import Gender, UserRole
from app.models.school import School
from app.repositories.school_repository import SchoolRepository
from app.repositories.user_repository import UserRepository
from app.schemas.profile import StaffProfileCreate, StudentProfileCreate
from app.schemas.user import (
    CreatePrincipalRequest,
    CreateStaffRequest,
    CreateStudentRequest,
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
        user_service = UserService(user_repo=user_repo, db=db)
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

        print("2. Creating Principal User (Role 1) via Controller...")
        principal_req = CreatePrincipalRequest(
            first_name="Super",
            last_name="Principal",
            login_mobile=f"99{suffix[:8]}",
            email=f"principal_{suffix}@testschool.edu",
            password="SecurePassword123!",
        )
        principal_read = user_controller.create_principal(data=principal_req)
        assert principal_read.role == UserRole.PRINCIPAL
        assert principal_read.first_name == "Super"
        assert principal_read.last_name == "Principal"
        assert principal_read.login_mobile == f"99{suffix[:8]}"
        assert principal_read.email == f"principal_{suffix}@testschool.edu"
        print(f"   Principal created: {principal_read.id}, Role={principal_read.role}")

        print("3. Creating Staff User (Role 2) via Controller...")
        staff_req = CreateStaffRequest(
            first_name="Alice",
            last_name="StaffMember",
            login_mobile=f"98{suffix[:8]}",
            email=f"staff_{suffix}@testschool.edu",
            password="SecurePassword123!",
            school_id=school.id,
            profile=StaffProfileCreate(
                roll_no=f"STF-ROL-{suffix}",
                gender=Gender.FEMALE,
                date_of_birth=date(1988, 4, 12),
                father_first_name="John",
                father_last_name="StaffMember",
            ),
        )
        staff_read = user_controller.create_staff(data=staff_req)
        assert staff_read.role == UserRole.STAFF
        assert staff_read.staff_profile is not None
        assert staff_read.staff_profile.roll_no == f"STF-ROL-{suffix}"
        assert staff_read.staff_profile.gender == Gender.FEMALE
        assert staff_read.staff_profile.date_of_birth == date(1988, 4, 12)
        assert staff_read.staff_profile.father_first_name == "John"
        assert staff_read.staff_profile.father_last_name == "StaffMember"
        print(f"   Staff created: {staff_read.id}, Roll No: {staff_read.staff_profile.roll_no}")

        print("4. Creating Student User (Role 3) via Controller...")
        student_req = CreateStudentRequest(
            first_name="Charlie",
            last_name="Student",
            login_mobile=f"96{suffix[:8]}",
            password="SecurePassword123!",
            school_id=school.id,
            profile=StudentProfileCreate(
                middle_name="Alexander",
                roll_no=f"STU-{suffix}",
                gender=Gender.MALE,
                date_of_birth=date(2008, 5, 15),
                class_name="Grade 10",
                section="Section A",
                house="Spartans",
                father_first_name="David",
                father_last_name="Student",
            ),
        )
        student_read = user_controller.create_student(data=student_req)
        assert student_read.role == UserRole.STUDENT
        assert student_read.student_profile is not None
        assert student_read.student_profile.middle_name == "Alexander"
        assert student_read.student_profile.roll_no == f"STU-{suffix}"
        assert student_read.student_profile.gender == Gender.MALE
        assert student_read.student_profile.date_of_birth == date(2008, 5, 15)
        assert student_read.student_profile.class_name == "Grade 10"
        assert student_read.student_profile.section == "Section A"
        assert student_read.student_profile.house == "Spartans"
        assert student_read.student_profile.father_first_name == "David"
        assert student_read.student_profile.father_last_name == "Student"
        print(f"   Student created: {student_read.id}, Class: {student_read.student_profile.class_name}, Section: {student_read.student_profile.section}")

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

        print("9. Testing Conflict Handling (Duplicate Email)...")
        try:
            user_controller.create_staff(data=staff_req)
            raise AssertionError("Should have raised ConflictException for duplicate email")
        except ConflictException as e:
            print(f"   ConflictException verified: '{e.message}'")

        print("\nAll 3-Role (Principal, Staff, Student) tests PASSED successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
