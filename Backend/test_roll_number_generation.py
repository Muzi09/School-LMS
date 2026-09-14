import uuid
from datetime import date
from app.core.database import SessionLocal
from app.models.enums import Gender, UserRole
from app.models.student import StudentProfile
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.profile import StudentProfileCreate
from app.schemas.student import CreateStudentRequest, StudentUpdate
from app.services.user_service import UserService


def test_alphabetical_roll_number_flow():
    db = SessionLocal()
    try:
        user_repo = UserRepository(db=db)
        user_service = UserService(user_repo=user_repo, db=db)

        test_class = f"TestClass_{uuid.uuid4().hex[:6]}"
        test_section = "Section A"

        print(f"\n--- Testing Roll Number Generation in {test_class} {test_section} ---")

        # 1. Asim
        s1 = user_service.create_student(
            CreateStudentRequest(
                first_name="Asim",
                last_name="Khan",
                login_mobile=f"91{uuid.uuid4().hex[:8]}",
                email=None,
                password=None,  # No password supplied
                profile=StudentProfileCreate(
                    roll_no="",
                    gender=Gender.MALE,
                    date_of_birth=date(2010, 1, 1),
                    class_name=test_class,
                    section=test_section,
                    house="Red",
                    father_first_name="Father",
                    father_last_name="Khan",
                ),
            )
        )
        assert s1.student_profile.roll_no == "1"
        assert s1.password_hash is None
        print(f"Created Asim Khan -> Roll No: {s1.student_profile.roll_no} (Password hash: {s1.password_hash})")

        # 2. Bushra
        s2 = user_service.create_student(
            CreateStudentRequest(
                first_name="Bushra",
                last_name="Ansari",
                login_mobile=f"92{uuid.uuid4().hex[:8]}",
                email=None,
                profile=StudentProfileCreate(
                    roll_no="",
                    gender=Gender.FEMALE,
                    date_of_birth=date(2010, 2, 2),
                    class_name=test_class,
                    section=test_section,
                    house="Blue",
                    father_first_name="Father",
                    father_last_name="Ansari",
                ),
            )
        )
        assert s2.student_profile.roll_no == "2"
        print(f"Created Bushra Ansari -> Roll No: {s2.student_profile.roll_no}")

        # 3. Muzammil
        s3 = user_service.create_student(
            CreateStudentRequest(
                first_name="Muzammil",
                last_name="Shaikh",
                login_mobile=f"93{uuid.uuid4().hex[:8]}",
                email=None,
                profile=StudentProfileCreate(
                    roll_no="",
                    gender=Gender.MALE,
                    date_of_birth=date(2010, 3, 3),
                    class_name=test_class,
                    section=test_section,
                    house="Green",
                    father_first_name="Father",
                    father_last_name="Shaikh",
                ),
            )
        )
        assert s3.student_profile.roll_no == "3"
        print(f"Created Muzammil Shaikh -> Roll No: {s3.student_profile.roll_no}")

        # 4. Zaid
        s4 = user_service.create_student(
            CreateStudentRequest(
                first_name="Zaid",
                last_name="Qureshi",
                login_mobile=f"94{uuid.uuid4().hex[:8]}",
                email=None,
                profile=StudentProfileCreate(
                    roll_no="",
                    gender=Gender.MALE,
                    date_of_birth=date(2010, 4, 4),
                    class_name=test_class,
                    section=test_section,
                    house="Yellow",
                    father_first_name="Father",
                    father_last_name="Qureshi",
                ),
            )
        )
        assert s4.student_profile.roll_no == "4"
        print(f"Created Zaid Qureshi -> Roll No: {s4.student_profile.roll_no}")

        # 5. Preview Chetan Singh before insertion
        preview_roll, total = user_service.calculate_roll_number(
            first_name="Chetan",
            last_name="Singh",
            class_name=test_class,
            section=test_section,
        )
        print(f"Preview Roll for Chetan Singh: {preview_roll} (Total: {total})")
        assert preview_roll == "3"
        assert total == 5

        # 6. Insert Chetan Singh
        s5 = user_service.create_student(
            CreateStudentRequest(
                first_name="Chetan",
                last_name="Singh",
                login_mobile=f"95{uuid.uuid4().hex[:8]}",
                email=None,
                profile=StudentProfileCreate(
                    roll_no="",
                    gender=Gender.MALE,
                    date_of_birth=date(2010, 5, 5),
                    class_name=test_class,
                    section=test_section,
                    house="Red",
                    father_first_name="Father",
                    father_last_name="Singh",
                ),
            )
        )
        assert s5.student_profile.roll_no == "3"
        print(f"Created Chetan Singh -> Roll No: {s5.student_profile.roll_no}")

        # Re-fetch all students to verify new roll numbers
        asim = user_service.get_student_by_id(s1.id)
        bushra = user_service.get_student_by_id(s2.id)
        chetan = user_service.get_student_by_id(s5.id)
        muzammil = user_service.get_student_by_id(s3.id)
        zaid = user_service.get_student_by_id(s4.id)

        print("\nVerifying reordered roll numbers after Chetan Singh added:")
        print(f"  {asim.first_name} {asim.last_name}: {asim.student_profile.roll_no}")
        print(f"  {bushra.first_name} {bushra.last_name}: {bushra.student_profile.roll_no}")
        print(f"  {chetan.first_name} {chetan.last_name}: {chetan.student_profile.roll_no}")
        print(f"  {muzammil.first_name} {muzammil.last_name}: {muzammil.student_profile.roll_no}")
        print(f"  {zaid.first_name} {zaid.last_name}: {zaid.student_profile.roll_no}")

        assert asim.student_profile.roll_no == "1"
        assert bushra.student_profile.roll_no == "2"
        assert chetan.student_profile.roll_no == "3"
        assert muzammil.student_profile.roll_no == "4"
        assert zaid.student_profile.roll_no == "5"

        # 7. Test Soft Delete Bushra
        print("\nDeleting Bushra Ansari and verifying automatic re-index without gaps:")
        user_service.soft_delete_user(s2.id)

        asim = user_service.get_student_by_id(s1.id)
        chetan = user_service.get_student_by_id(s5.id)
        muzammil = user_service.get_student_by_id(s3.id)
        zaid = user_service.get_student_by_id(s4.id)

        print(f"  {asim.first_name} {asim.last_name}: {asim.student_profile.roll_no}")
        print(f"  {chetan.first_name} {chetan.last_name}: {chetan.student_profile.roll_no}")
        print(f"  {muzammil.first_name} {muzammil.last_name}: {muzammil.student_profile.roll_no}")
        print(f"  {zaid.first_name} {zaid.last_name}: {zaid.student_profile.roll_no}")

        assert asim.student_profile.roll_no == "1"
        assert chetan.student_profile.roll_no == "2"
        assert muzammil.student_profile.roll_no == "3"
        assert zaid.student_profile.roll_no == "4"

        print("\n ALL ROLL NUMBER GENERATION AND REORDERING TESTS PASSED SUCCESSFULLY! ")

    finally:
        db.close()


if __name__ == "__main__":
    test_alphabetical_roll_number_flow()
