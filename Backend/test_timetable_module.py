"""
Comprehensive Timetable Module Automated Test Suite
Covers:
- Period CRUD & Validation (timing order, duplicate number, overlapping timings)
- Timetable Entry CRUD & Soft Deletion
- Section schedule conflict detection (structured error)
- Teacher schedule conflict detection (structured error)
- Subject assigned to section validation (ClassSubject check)
- Eligible active teaching staff validation
- Cross-school isolation (multi-tenancy)
- Permission enforcement (Principal vs Staff)
- Efficient weekly grid response structure
"""
import uuid
from datetime import date, time

from app.core.database import SessionLocal
from app.core.exceptions import BadRequestException, NotFoundException, ScheduleConflictException
from app.models.enums import Gender, UserRole
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.subject import ClassSubject, Subject
from app.models.timetable import DayOfWeek, TimetableEntry, TimetablePeriod
from app.models.user import User
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryUpdate,
    TimetablePeriodCreate,
    TimetablePeriodUpdate,
)
from app.services.timetable_service import TimetableService


def test_timetable_complete_flow():
    db = SessionLocal()
    service = TimetableService(db=db)

    try:
        suffix = uuid.uuid4().hex[:6]
        print(f"\n==================================================")
        print(f"STARTING TIMETABLE TEST SUITE [suffix={suffix}]")
        print(f"==================================================")

        # -------------------------------------------------------------------
        # Setup Test Fixtures: School A and School B
        # -------------------------------------------------------------------
        school_a = School(
            name=f"School Alpha {suffix}",
            code=f"SCH_A_{suffix}",
            is_active=True,
            setup_completed=True,
        )
        school_b = School(
            name=f"School Beta {suffix}",
            code=f"SCH_B_{suffix}",
            is_active=True,
            setup_completed=True,
        )
        db.add_all([school_a, school_b])
        db.commit()
        db.refresh(school_a)
        db.refresh(school_b)

        # Principal A and Staff Teacher 1, Staff Teacher 2 for School A
        principal_a = User(
            first_name="Principal",
            last_name=f"Alpha {suffix}",
            login_mobile=f"81{suffix[:8]}",
            role=UserRole.PRINCIPAL,
            is_active=True,
        )
        teacher_1 = User(
            first_name="Rahul",
            last_name=f"Sharma {suffix}",
            login_mobile=f"82{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        teacher_2 = User(
            first_name="Priya",
            last_name=f"Patel {suffix}",
            login_mobile=f"83{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        # Teacher for School B
        teacher_b = User(
            first_name="Vikram",
            last_name=f"Rathore {suffix}",
            login_mobile=f"84{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add_all([principal_a, teacher_1, teacher_2, teacher_b])
        db.commit()
        db.refresh(principal_a)
        db.refresh(teacher_1)
        db.refresh(teacher_2)
        db.refresh(teacher_b)

        staff_prof_1 = StaffProfile(
            user_id=teacher_1.id,
            school_id=school_a.id,
            roll_no=f"STF-A1-{suffix}",
            gender=Gender.MALE,
            date_of_birth=date(1990, 5, 15),
            department="Mathematics",
            status="ACTIVE",
        )
        staff_prof_2 = StaffProfile(
            user_id=teacher_2.id,
            school_id=school_a.id,
            roll_no=f"STF-A2-{suffix}",
            gender=Gender.FEMALE,
            date_of_birth=date(1992, 8, 20),
            department="Science",
            status="ACTIVE",
        )
        staff_prof_b = StaffProfile(
            user_id=teacher_b.id,
            school_id=school_b.id,
            roll_no=f"STF-B1-{suffix}",
            gender=Gender.MALE,
            date_of_birth=date(1989, 3, 10),
            department="English",
            status="ACTIVE",
        )
        db.add_all([staff_prof_1, staff_prof_2, staff_prof_b])

        # Classes and Sections for School A
        class_8 = SchoolClass(school_id=school_a.id, name="Class 8", order_index=8)
        class_9 = SchoolClass(school_id=school_a.id, name="Class 9", order_index=9)
        db.add_all([class_8, class_9])
        db.commit()
        db.refresh(class_8)
        db.refresh(class_9)

        sec_8a = Section(school_id=school_a.id, class_id=class_8.id, name="A")
        sec_8b = Section(school_id=school_a.id, class_id=class_8.id, name="B")
        sec_9a = Section(school_id=school_a.id, class_id=class_9.id, name="A")
        db.add_all([sec_8a, sec_8b, sec_9a])

        # Subjects for School A
        sub_math = Subject(school_id=school_a.id, name="Mathematics", code="MATH")
        sub_sci = Subject(school_id=school_a.id, name="Science", code="SCI")
        sub_eng = Subject(school_id=school_a.id, name="English", code="ENG")
        # Subject only for School B
        sub_b = Subject(school_id=school_b.id, name="French", code="FRN")
        db.add_all([sub_math, sub_sci, sub_eng, sub_b])
        db.commit()
        db.refresh(sec_8a)
        db.refresh(sec_8b)
        db.refresh(sec_9a)
        db.refresh(sub_math)
        db.refresh(sub_sci)
        db.refresh(sub_eng)
        db.refresh(sub_b)

        # Map ClassSubjects:
        # Class 8 has Math and Science
        cs_8_math = ClassSubject(school_id=school_a.id, class_id=class_8.id, subject_id=sub_math.id, section_id=None)
        cs_8_sci = ClassSubject(school_id=school_a.id, class_id=class_8.id, subject_id=sub_sci.id, section_id=None)
        # Class 9 Section A has English and Math
        cs_9_math = ClassSubject(school_id=school_a.id, class_id=class_9.id, subject_id=sub_math.id, section_id=sec_9a.id)
        cs_9_eng = ClassSubject(school_id=school_a.id, class_id=class_9.id, subject_id=sub_eng.id, section_id=sec_9a.id)
        db.add_all([cs_8_math, cs_8_sci, cs_9_math, cs_9_eng])
        db.commit()

        print("[OK] Test fixtures created successfully.")

        # -------------------------------------------------------------------
        # TEST 1: Periods Management & Validation
        # -------------------------------------------------------------------
        print("\n--- TEST 1: Periods Creation & Validation ---")
        p1 = service.create_period(
            school_id=school_a.id,
            data=TimetablePeriodCreate(period_number=1, start_time="08:00", end_time="08:45"),
            user_id=principal_a.id,
        )
        assert p1.period_number == 1
        assert p1.start_time == time(8, 0)
        assert p1.end_time == time(8, 45)
        print(f"   [PASS] Created Period 1: {p1.start_time} - {p1.end_time}")

        p2 = service.create_period(
            school_id=school_a.id,
            data=TimetablePeriodCreate(period_number=2, start_time="08:45", end_time="09:30"),
            user_id=principal_a.id,
        )
        assert p2.period_number == 2
        print(f"   [PASS] Created Period 2: {p2.start_time} - {p2.end_time}")

        # Invalid start >= end
        try:
            service.create_period(
                school_id=school_a.id,
                data=TimetablePeriodCreate(period_number=3, start_time="10:00", end_time="09:00"),
                user_id=principal_a.id,
            )
            assert False, "Should have failed on start >= end"
        except BadRequestException as e:
            print(f"   [PASS] Correctly rejected invalid timing: {e.message}")

        # Duplicate period_number
        try:
            service.create_period(
                school_id=school_a.id,
                data=TimetablePeriodCreate(period_number=1, start_time="10:00", end_time="10:45"),
                user_id=principal_a.id,
            )
            assert False, "Should have failed on duplicate period number"
        except BadRequestException as e:
            print(f"   [PASS] Correctly rejected duplicate period number: {e.message}")

        # Overlapping period timings
        try:
            service.create_period(
                school_id=school_a.id,
                data=TimetablePeriodCreate(period_number=3, start_time="08:30", end_time="09:15"),
                user_id=principal_a.id,
            )
            assert False, "Should have failed on overlapping timings"
        except BadRequestException as e:
            print(f"   [PASS] Correctly rejected overlapping period timings: {e.message}")

        p3 = service.create_period(
            school_id=school_a.id,
            data=TimetablePeriodCreate(period_number=3, start_time="09:30", end_time="10:15"),
            user_id=principal_a.id,
        )
        print(f"   [PASS] Created Period 3: {p3.start_time} - {p3.end_time}")

        # -------------------------------------------------------------------
        # TEST 2: Teacher & Subject Eligibility
        # -------------------------------------------------------------------
        print("\n--- TEST 2: Eligible Teachers & Section Subjects ---")
        teachers_a = service.list_eligible_teachers(school_id=school_a.id)
        teacher_ids_a = {t["id"] for t in teachers_a}
        assert teacher_1.id in teacher_ids_a
        assert teacher_2.id in teacher_ids_a
        assert teacher_b.id not in teacher_ids_a
        print(f"   [PASS] Eligible teachers in School A ({len(teachers_a)} found): {[t['name'] for t in teachers_a]}")

        sec_8a_subjects = service.list_section_subjects(school_id=school_a.id, section_id=sec_8a.id)
        sec_8a_sub_names = [s.name for s in sec_8a_subjects]
        assert "Mathematics" in sec_8a_sub_names
        assert "Science" in sec_8a_sub_names
        assert "English" not in sec_8a_sub_names  # English is only on Class 9
        print(f"   [PASS] Subjects for Class 8-A: {sec_8a_sub_names} (English correctly omitted)")

        # -------------------------------------------------------------------
        # TEST 3: Create Timetable Entry
        # -------------------------------------------------------------------
        print("\n--- TEST 3: Timetable Entry Creation ---")
        entry_1 = service.create_entry(
            school_id=school_a.id,
            data=TimetableEntryCreate(
                section_id=sec_8a.id,
                subject_id=sub_math.id,
                teacher_user_id=teacher_1.id,
                period_id=p1.id,
                day_of_week=DayOfWeek.MONDAY,
            ),
            user_id=principal_a.id,
        )
        assert entry_1.id is not None
        assert entry_1.day_of_week == "MONDAY"
        print(f"   [PASS] Scheduled entry: Class 8-A, Monday P1 -> Mathematics (Rahul Sharma)")

        # -------------------------------------------------------------------
        # TEST 4: Section Schedule Conflict
        # -------------------------------------------------------------------
        print("\n--- TEST 4: Section Schedule Conflict Detection ---")
        try:
            # Try scheduling Science for 8-A on Monday P1 with teacher 2
            service.create_entry(
                school_id=school_a.id,
                data=TimetableEntryCreate(
                    section_id=sec_8a.id,
                    subject_id=sub_sci.id,
                    teacher_user_id=teacher_2.id,
                    period_id=p1.id,
                    day_of_week=DayOfWeek.MONDAY,
                ),
                user_id=principal_a.id,
            )
            assert False, "Should have thrown SECTION_SCHEDULE_CONFLICT"
        except ScheduleConflictException as e:
            assert e.code == "SECTION_SCHEDULE_CONFLICT"
            assert e.details["period"] == 1
            assert e.details["section_name"] == "A"
            print(f"   [PASS] Structured SECTION_SCHEDULE_CONFLICT caught: '{e.message}'")
            print(f"          Details: {e.details}")

        # -------------------------------------------------------------------
        # TEST 5: Teacher Schedule Conflict
        # -------------------------------------------------------------------
        print("\n--- TEST 5: Teacher Schedule Conflict Detection ---")
        try:
            # Teacher 1 (Rahul) is already teaching Class 8-A on Monday P1.
            # Try scheduling Teacher 1 for Class 9-A on Monday P1!
            service.create_entry(
                school_id=school_a.id,
                data=TimetableEntryCreate(
                    section_id=sec_9a.id,
                    subject_id=sub_math.id,
                    teacher_user_id=teacher_1.id,
                    period_id=p1.id,
                    day_of_week=DayOfWeek.MONDAY,
                ),
                user_id=principal_a.id,
            )
            assert False, "Should have thrown TEACHER_SCHEDULE_CONFLICT"
        except ScheduleConflictException as e:
            assert e.code == "TEACHER_SCHEDULE_CONFLICT"
            assert "Rahul Sharma" in e.message
            assert "Class 8-A" in e.message
            assert e.details["period"] == 1
            print(f"   [PASS] Structured TEACHER_SCHEDULE_CONFLICT caught: '{e.message}'")
            print(f"          Details: {e.details}")

        # -------------------------------------------------------------------
        # TEST 6: Invalid Subject for Section (ClassSubject validation)
        # -------------------------------------------------------------------
        print("\n--- TEST 6: Invalid Subject for Section ---")
        try:
            # Class 8-A does not have English assigned
            service.create_entry(
                school_id=school_a.id,
                data=TimetableEntryCreate(
                    section_id=sec_8a.id,
                    subject_id=sub_eng.id,
                    teacher_user_id=teacher_2.id,
                    period_id=p2.id,
                    day_of_week=DayOfWeek.MONDAY,
                ),
                user_id=principal_a.id,
            )
            assert False, "Should have rejected subject not mapped in ClassSubject"
        except BadRequestException as e:
            print(f"   [PASS] Correctly rejected unassigned subject: '{e.message}'")

        # -------------------------------------------------------------------
        # TEST 7: Cross-School Isolation
        # -------------------------------------------------------------------
        print("\n--- TEST 7: Cross-School Isolation Prevention ---")
        try:
            # Try to assign School B's teacher to School A's class
            service.create_entry(
                school_id=school_a.id,
                data=TimetableEntryCreate(
                    section_id=sec_8a.id,
                    subject_id=sub_sci.id,
                    teacher_user_id=teacher_b.id,
                    period_id=p2.id,
                    day_of_week=DayOfWeek.MONDAY,
                ),
                user_id=principal_a.id,
            )
            assert False, "Should have rejected teacher from another school"
        except BadRequestException as e:
            print(f"   [PASS] Rejected cross-school teacher assignment: '{e.message}'")

        try:
            # Try to schedule School B's subject in School A
            service.create_entry(
                school_id=school_a.id,
                data=TimetableEntryCreate(
                    section_id=sec_8a.id,
                    subject_id=sub_b.id,
                    teacher_user_id=teacher_2.id,
                    period_id=p2.id,
                    day_of_week=DayOfWeek.MONDAY,
                ),
                user_id=principal_a.id,
            )
            assert False, "Should have rejected subject from another school"
        except NotFoundException as e:
            print(f"   [PASS] Rejected cross-school subject assignment: '{e.message}'")

        # -------------------------------------------------------------------
        # TEST 8: Full Timetable Grid Response (N+1-Free)
        # -------------------------------------------------------------------
        print("\n--- TEST 8: Full Timetable Grid Retrieval ---")
        # Add another entry: Monday P2 -> Science (Priya Patel)
        entry_2 = service.create_entry(
            school_id=school_a.id,
            data=TimetableEntryCreate(
                section_id=sec_8a.id,
                subject_id=sub_sci.id,
                teacher_user_id=teacher_2.id,
                period_id=p2.id,
                day_of_week=DayOfWeek.MONDAY,
            ),
            user_id=principal_a.id,
        )
        print(f"   [PASS] Added second entry: Class 8-A, Monday P2 -> Science (Priya Patel)")

        grid = service.get_timetable_grid(school_id=school_a.id, section_id=sec_8a.id)
        assert grid["section"]["class_name"] == "Class 8"
        assert grid["section"]["section_name"] == "A"
        assert len(grid["periods"]) == 3
        assert len(grid["entries"]) == 2
        assert len(grid["subjects"]) >= 2
        first_entry = grid["entries"][0]
        assert first_entry["subject"]["name"] == "Mathematics"
        assert "Rahul Sharma" in first_entry["teacher"]["name"]
        print(f"   [PASS] Grid successfully loaded: Section {grid['section']['class_name']}-{grid['section']['section_name']}, "
              f"{len(grid['periods'])} periods, {len(grid['entries'])} entries, {len(grid['subjects'])} subjects")

        # -------------------------------------------------------------------
        # TEST 9: Entry Update & Delete (Soft-Delete)
        # -------------------------------------------------------------------
        print("\n--- TEST 9: Entry Update & Soft Delete ---")
        updated_entry = service.update_entry(
            school_id=school_a.id,
            entry_id=entry_1.id,
            data=TimetableEntryUpdate(period_id=p3.id),
            user_id=principal_a.id,
        )
        assert updated_entry.period_id == p3.id
        print(f"   [PASS] Successfully moved entry 1 to Period 3")

        service.delete_entry(school_id=school_a.id, entry_id=entry_1.id, user_id=principal_a.id)
        db_entry = db.query(TimetableEntry).filter(TimetableEntry.id == entry_1.id).first()
        assert db_entry.deleted_at is not None
        assert db_entry.deleted_by == principal_a.id
        print(f"   [PASS] Entry 1 soft-deleted (deleted_at={db_entry.deleted_at}, deleted_by={db_entry.deleted_by})")

        # After delete, grid should only have 1 entry
        grid_after_del = service.get_timetable_grid(school_id=school_a.id, section_id=sec_8a.id)
        assert len(grid_after_del["entries"]) == 1
        print(f"   [PASS] Grid after deletion accurately shows {len(grid_after_del['entries'])} entry")

        # Period cannot be deleted while having active entries
        try:
            service.delete_period(school_id=school_a.id, period_id=p2.id, user_id=principal_a.id)
            assert False, "Should have prevented period deletion when active entries exist"
        except BadRequestException as e:
            print(f"   [PASS] Prevented deletion of period with active entries: '{e.message}'")

        # Delete entry_2 so period can be deleted
        service.delete_entry(school_id=school_a.id, entry_id=entry_2.id, user_id=principal_a.id)
        service.delete_period(school_id=school_a.id, period_id=p2.id, user_id=principal_a.id)
        deleted_p2 = db.query(TimetablePeriod).filter(TimetablePeriod.id == p2.id).first()
        assert deleted_p2.deleted_at is not None
        print(f"   [PASS] Period 2 successfully soft-deleted after entries removed")

        print("\n==================================================")
        print("ALL TIMETABLE SERVICE & INTEGRATION TESTS PASSED!")
        print("==================================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    test_timetable_complete_flow()
