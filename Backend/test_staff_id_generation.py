"""
Test Staff ID Auto-Generation:
Format: [Joining Year] + [Role Code] + [Padded Sequence Number]
Example: 2026STF001
Sequence resets per year and per role code.
"""
from datetime import date, datetime, timezone
import uuid

from app.core.database import SessionLocal
from app.models.enums import Gender, UserRole
from app.models.school import School
from app.models.staff import StaffProfile
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.profile import StaffProfileCreate
from app.schemas.staff import CreateStaffRequest
from app.services.user_service import UserService


def test_staff_id_generation():
    db = SessionLocal()
    try:
        user_repo = UserRepository(db)
        service = UserService(user_repo=user_repo, db=db)

        # 1. Create a dummy school
        school = School(
            name="Test Academy for Staff ID",
            code=f"ACAD_{uuid.uuid4().hex[:6]}",
            email=f"acad_{uuid.uuid4().hex[:6]}@school.com",
            phone="1234567890",
            address="123 Education Lane",
            is_active=True,
            setup_completed=True,
        )
        db.add(school)
        db.commit()
        db.refresh(school)

        print("\n--- 1. Testing Initial Generation on Empty School ---")
        id_1, seq_1 = service.generate_staff_id(school_id=school.id, joining_year=2026, role_code="STF")
        assert id_1 == "2026STF001", f"Expected 2026STF001, got {id_1}"
        assert seq_1 == 1, f"Expected 1, got {seq_1}"
        print(f"[PASS] Empty school ID: {id_1}, seq: {seq_1}")

        print("\n--- 2. Testing Consecutive Auto-Generation via create_staff ---")
        # Create first staff without supplying roll_no
        staff_req_1 = CreateStaffRequest(
            first_name="StaffFirst",
            last_name="One",
            login_mobile=f"91{uuid.uuid4().hex[:8]}",
            email=f"staff1_{uuid.uuid4().hex[:6]}@school.com",
            profile=StaffProfileCreate(
                gender=Gender.MALE,
                date_of_birth=date(1990, 1, 1),
            ),
        )
        user_1, token_1 = service.create_staff(data=staff_req_1, school_id=school.id)
        assert user_1.staff_profile.roll_no == "2026STF001", f"Expected 2026STF001, got {user_1.staff_profile.roll_no}"
        print(f"[PASS] Staff 1 created with auto-id: {user_1.staff_profile.roll_no}")

        # Check preview for next staff
        next_id, next_seq = service.generate_staff_id(school_id=school.id, joining_year=2026, role_code="STF")
        assert next_id == "2026STF002", f"Expected 2026STF002, got {next_id}"
        assert next_seq == 2, f"Expected 2, got {next_seq}"
        print(f"[PASS] Next preview ID: {next_id}, seq: {next_seq}")

        # Create second staff
        staff_req_2 = CreateStaffRequest(
            first_name="StaffSecond",
            last_name="Two",
            login_mobile=f"92{uuid.uuid4().hex[:8]}",
            email=f"staff2_{uuid.uuid4().hex[:6]}@school.com",
            profile=StaffProfileCreate(
                gender=Gender.FEMALE,
                date_of_birth=date(1992, 2, 2),
            ),
        )
        user_2, token_2 = service.create_staff(data=staff_req_2, school_id=school.id)
        assert user_2.staff_profile.roll_no == "2026STF002", f"Expected 2026STF002, got {user_2.staff_profile.roll_no}"
        print(f"[PASS] Staff 2 created with auto-id: {user_2.staff_profile.roll_no}")

        print("\n--- 3. Testing Sequence Reset for a New Year ---")
        id_2027, seq_2027 = service.generate_staff_id(school_id=school.id, joining_year=2027, role_code="STF")
        assert id_2027 == "2027STF001", f"Expected 2027STF001, got {id_2027}"
        assert seq_2027 == 1, f"Expected 1, got {seq_2027}"
        print(f"[PASS] Year 2027 sequence starts from 001: {id_2027}")

        print("\n--- 4. Testing Sequence Reset for a Different Role Code ---")
        id_adm, seq_adm = service.generate_staff_id(school_id=school.id, joining_year=2026, role_code="ADM")
        assert id_adm == "2026ADM001", f"Expected 2026ADM001, got {id_adm}"
        assert seq_adm == 1, f"Expected 1, got {seq_adm}"
        print(f"[PASS] Role code ADM sequence starts from 001: {id_adm}")

        # Clean up
        db.delete(user_1.staff_profile)
        db.delete(user_2.staff_profile)
        db.delete(user_1)
        db.delete(user_2)
        db.delete(school)
        db.commit()

        print("\n[SUCCESS] All Staff ID Auto-Generation Tests PASSED successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    test_staff_id_generation()
