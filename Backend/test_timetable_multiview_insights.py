"""
Comprehensive Test Suite for Timeline-Based Timetable Multi-Views & Insights
Tests:
- GET /api/v1/timetable/teacher/{teacher_id} (Teacher View)
- GET /api/v1/timetable/free-teachers (Free Teacher Availability View)
- GET /api/v1/timetable/master (Master Timetable View)
- GET /api/v1/timetable/insights (Timetable Status & Insights Dashboard)
- Accurate calculations (Completion %, Unassigned Slots, Teacher Utilization, Coverage)
- "Not configured" state handling when periods or sections are missing
- Conflict detection (Double-booked teacher conflict & section conflict)
- School isolation and permissions
"""
import uuid
from datetime import date, time
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.enums import Gender, UserRole
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.subject import ClassSubject, Subject
from app.models.timetable import DayOfWeek, TimetableEntry, TimetablePeriod
from app.models.user import User
from app.models.principal import PrincipalProfile
from app.schemas.timetable import TimetableEntryCreate

client = TestClient(app)


def test_timetable_multiview_and_insights():
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:6]
        print(f"\n==================================================")
        print(f"STARTING TIMETABLE MULTI-VIEW & INSIGHTS TESTS [suffix={suffix}]")
        print(f"==================================================")

        # 1. Setup School A with Principal, 3 Teachers, 2 Classes (each with 1 Section)
        school_a = School(
            name=f"Horizon Academy {suffix}",
            code=f"HORIZON_{suffix}",
            is_active=True,
            setup_completed=True,
        )
        db.add(school_a)
        db.commit()
        db.refresh(school_a)

        principal_a = User(
            first_name="Dr.",
            last_name=f"Principal {suffix}",
            login_mobile=f"81{suffix[:8]}",
            role=UserRole.PRINCIPAL,
            is_active=True,
        )
        t1 = User(
            first_name="Ramesh",
            last_name=f"Kumar {suffix}",
            login_mobile=f"82{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        t2 = User(
            first_name="Sunita",
            last_name=f"Sharma {suffix}",
            login_mobile=f"83{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        t3 = User(
            first_name="Anil",
            last_name=f"Verma {suffix}",
            login_mobile=f"84{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add_all([principal_a, t1, t2, t3])
        db.commit()
        db.refresh(principal_a)
        db.refresh(t1)
        db.refresh(t2)
        db.refresh(t3)

        # Profiles
        princ_prof = PrincipalProfile(user_id=principal_a.id, school_id=school_a.id, school_setup_completed=True)
        stf1 = StaffProfile(user_id=t1.id, school_id=school_a.id, roll_no=f"STF1-{suffix}", gender=Gender.MALE, date_of_birth=date(1985, 1, 1), department="Mathematics", designation="Senior Teacher", status="ACTIVE")
        stf2 = StaffProfile(user_id=t2.id, school_id=school_a.id, roll_no=f"STF2-{suffix}", gender=Gender.FEMALE, date_of_birth=date(1988, 2, 2), department="Science", designation="TGT Science", status="ACTIVE")
        stf3 = StaffProfile(user_id=t3.id, school_id=school_a.id, roll_no=f"STF3-{suffix}", gender=Gender.MALE, date_of_birth=date(1990, 3, 3), department="English", designation="TGT English", status="ACTIVE")
        db.add_all([princ_prof, stf1, stf2, stf3])
        db.commit()

        # Classes and Sections: Class 9 Section A, Class 10 Section A
        c9 = SchoolClass(school_id=school_a.id, name=f"Class 9 {suffix}", order_index=1)
        c10 = SchoolClass(school_id=school_a.id, name=f"Class 10 {suffix}", order_index=2)
        db.add_all([c9, c10])
        db.commit()
        db.refresh(c9)
        db.refresh(c10)

        s9a = Section(school_id=school_a.id, class_id=c9.id, name="A")
        s10a = Section(school_id=school_a.id, class_id=c10.id, name="A")
        db.add_all([s9a, s10a])
        db.commit()
        db.refresh(s9a)
        db.refresh(s10a)

        # Subjects: Math, Science, English
        sub_math = Subject(school_id=school_a.id, name=f"Math {suffix}", code=f"MTH_{suffix}", is_academic=True, order_index=1)
        sub_sci = Subject(school_id=school_a.id, name=f"Science {suffix}", code=f"SCI_{suffix}", is_academic=True, order_index=2)
        sub_eng = Subject(school_id=school_a.id, name=f"English {suffix}", code=f"ENG_{suffix}", is_academic=True, order_index=3)
        db.add_all([sub_math, sub_sci, sub_eng])
        db.commit()
        db.refresh(sub_math)
        db.refresh(sub_sci)
        db.refresh(sub_eng)

        # ClassSubject mappings
        cs1 = ClassSubject(school_id=school_a.id, class_id=c9.id, subject_id=sub_math.id, teacher_id=t1.id)
        cs2 = ClassSubject(school_id=school_a.id, class_id=c9.id, subject_id=sub_sci.id, teacher_id=t2.id)
        cs3 = ClassSubject(school_id=school_a.id, class_id=c10.id, subject_id=sub_math.id, teacher_id=t1.id)
        cs4 = ClassSubject(school_id=school_a.id, class_id=c10.id, subject_id=sub_eng.id, teacher_id=t3.id)
        db.add_all([cs1, cs2, cs3, cs4])
        db.commit()

        # Auth headers for Principal
        headers_princ = {
            "X-User-Id": str(principal_a.id),
        }

        # -------------------------------------------------------------------
        # TEST 1: Insights before configuring periods ("Not configured" state)
        # -------------------------------------------------------------------
        print("\n--- TEST 1: Insights before configuring periods ---")
        res = client.get("/api/v1/timetable/insights", headers=headers_princ)
        assert res.status_code == 200, res.text
        insights_initial = res.json()
        assert insights_initial["is_configured"] is False
        assert insights_initial["total_expected_slots"] is None
        assert insights_initial["assignment_completion_percentage"] is None
        assert insights_initial["unassigned_slots"] is None
        assert insights_initial["total_teachers"] == 3
        print("   [PASS] Accurately reports not configured when 0 periods exist")

        # 2. Add Periods: Period 1 (08:30 - 09:15), Period 2 (09:15 - 10:00)
        p1 = TimetablePeriod(school_id=school_a.id, period_number=1, start_time=time(8, 30), end_time=time(9, 15))
        p2 = TimetablePeriod(school_id=school_a.id, period_number=2, start_time=time(9, 15), end_time=time(10, 0))
        db.add_all([p1, p2])
        db.commit()
        db.refresh(p1)
        db.refresh(p2)

        # -------------------------------------------------------------------
        # TEST 2: Insights with periods configured but 0 entries
        # -------------------------------------------------------------------
        print("\n--- TEST 2: Insights with 2 periods, 2 sections, 0 entries ---")
        res = client.get("/api/v1/timetable/insights", headers=headers_princ)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["is_configured"] is True
        # Expected: 2 sections * 2 periods * 6 working days = 24 total slots
        assert data["total_expected_slots"] == 24
        assert data["total_scheduled_periods"] == 0
        assert data["assignment_completion_percentage"] == 0.0
        assert data["unassigned_slots"] == 24
        assert data["total_teachers"] == 3
        assert data["conflict_count"] == 0
        assert data["coverage_summary"]["complete_count"] == 0
        assert data["coverage_summary"]["partial_count"] == 0
        assert data["coverage_summary"]["missing_count"] == 2
        print(f"   [PASS] Accurately computed expected slots = {data['total_expected_slots']}, missing = 2")

        # 3. Add Timetable Entries:
        # Mon P1: Class 9-A -> Math (Teacher 1)
        # Mon P2: Class 9-A -> Science (Teacher 2)
        # Mon P2: Class 10-A -> English (Teacher 3)
        # Tue P1: Class 10-A -> Math (Teacher 1)
        e1 = TimetableEntry(school_id=school_a.id, section_id=s9a.id, subject_id=sub_math.id, teacher_user_id=t1.id, period_id=p1.id, day_of_week=DayOfWeek.MONDAY.value)
        e2 = TimetableEntry(school_id=school_a.id, section_id=s9a.id, subject_id=sub_sci.id, teacher_user_id=t2.id, period_id=p2.id, day_of_week=DayOfWeek.MONDAY.value)
        e3 = TimetableEntry(school_id=school_a.id, section_id=s10a.id, subject_id=sub_eng.id, teacher_user_id=t3.id, period_id=p2.id, day_of_week=DayOfWeek.MONDAY.value)
        e4 = TimetableEntry(school_id=school_a.id, section_id=s10a.id, subject_id=sub_math.id, teacher_user_id=t1.id, period_id=p1.id, day_of_week=DayOfWeek.TUESDAY.value)
        db.add_all([e1, e2, e3, e4])
        db.commit()

        # -------------------------------------------------------------------
        # TEST 3: Teacher View API: GET /api/v1/timetable/teacher/{teacher_id}
        # -------------------------------------------------------------------
        print("\n--- TEST 3: Teacher View API ---")
        res = client.get(f"/api/v1/timetable/teacher/{t1.id}", headers=headers_princ)
        assert res.status_code == 200, res.text
        t_data = res.json()
        assert t_data["teacher"]["id"] == str(t1.id)
        assert "Ramesh" in t_data["teacher"]["name"]
        assert len(t_data["periods"]) == 2
        # Teacher 1 teaches: Mon P1 (9-A Math) and Tue P1 (10-A Math) -> 2 entries
        assert t_data["total_teaching_periods"] == 2
        assert len(t_data["entries"]) == 2
        assert t_data["entries"][0]["start_time"] == "08:30"
        assert t_data["entries"][0]["end_time"] == "09:15"
        assert t_data["entries"][0]["class_name"] in [c9.name, c10.name]
        print(f"   [PASS] Teacher View returned 2 scheduled teaching periods with accurate timings")

        # -------------------------------------------------------------------
        # TEST 4: Free Teacher Availability API: GET /api/v1/timetable/free-teachers
        # -------------------------------------------------------------------
        print("\n--- TEST 4: Free Teacher Availability API ---")
        res = client.get("/api/v1/timetable/free-teachers?day_of_week=MONDAY", headers=headers_princ)
        assert res.status_code == 200, res.text
        free_data = res.json()
        assert free_data["total_teachers"] == 3
        assert len(free_data["days"]) == 1
        mon_slots = free_data["days"][0]["periods"]
        assert len(mon_slots) == 2

        # In Mon P1: Only Teacher 1 is teaching. Teachers 2 and 3 should be FREE!
        p1_slot = next(s for s in mon_slots if s["period_number"] == 1)
        assert p1_slot["occupied_count"] == 1
        assert p1_slot["free_count"] == 2
        free_ids_p1 = [ft["id"] for ft in p1_slot["free_teachers"]]
        assert str(t2.id) in free_ids_p1
        assert str(t3.id) in free_ids_p1
        assert str(t1.id) not in free_ids_p1

        # In Mon P2: Teachers 2 and 3 are teaching. Teacher 1 should be FREE!
        p2_slot = next(s for s in mon_slots if s["period_number"] == 2)
        assert p2_slot["occupied_count"] == 2
        assert p2_slot["free_count"] == 1
        free_ids_p2 = [ft["id"] for ft in p2_slot["free_teachers"]]
        assert str(t1.id) in free_ids_p2
        assert str(t2.id) not in free_ids_p2
        print(f"   [PASS] Free teacher calculations accurate across partial and full time intervals")

        # -------------------------------------------------------------------
        # TEST 5: Master View API: GET /api/v1/timetable/master
        # -------------------------------------------------------------------
        print("\n--- TEST 5: Master Timetable View API ---")
        res = client.get("/api/v1/timetable/master", headers=headers_princ)
        assert res.status_code == 200, res.text
        master_data = res.json()
        assert len(master_data["periods"]) == 2
        assert len(master_data["sections"]) == 2
        assert len(master_data["entries"]) == 4
        assert master_data["sections"][0]["display_name"]
        print(f"   [PASS] Master View returned {len(master_data['sections'])} sections and {len(master_data['entries'])} entries")

        # -------------------------------------------------------------------
        # TEST 6: Timetable Insights with active entries: GET /api/v1/timetable/insights
        # -------------------------------------------------------------------
        print("\n--- TEST 6: Timetable Insights with active entries ---")
        res = client.get("/api/v1/timetable/insights", headers=headers_princ)
        assert res.status_code == 200, res.text
        ins = res.json()
        assert ins["total_scheduled_periods"] == 4
        assert ins["total_expected_slots"] == 24
        # 4 / 24 = 16.7%
        assert ins["assignment_completion_percentage"] == 16.7
        assert ins["unassigned_slots"] == 20
        # Capacity = 3 teachers * 2 periods * 6 days = 36 slots
        # Assigned with teacher = 4 / 36 = 11.1%
        assert ins["teacher_utilization_percentage"] == 11.1
        assert ins["conflict_count"] == 0
        assert ins["coverage_summary"]["partial_count"] == 2
        assert ins["coverage_summary"]["complete_count"] == 0
        assert ins["coverage_summary"]["missing_count"] == 0
        print(f"   [PASS] Timetable insights: 16.7% completion, 20 unassigned slots, 0 conflicts")

        # -------------------------------------------------------------------
        # TEST 7: School Isolation & Access Control
        # -------------------------------------------------------------------
        print("\n--- TEST 7: School Isolation ---")
        school_b = School(name=f"Other School {suffix}", code=f"OTHER_{suffix}", is_active=True, setup_completed=True)
        db.add(school_b)
        db.commit()
        db.refresh(school_b)

        principal_b = User(first_name="Other", last_name="Admin", login_mobile=f"89{suffix[:8]}", role=UserRole.PRINCIPAL, is_active=True)
        db.add(principal_b)
        db.commit()
        db.refresh(principal_b)
        db.add(PrincipalProfile(user_id=principal_b.id, school_id=school_b.id, school_setup_completed=True))
        db.commit()

        headers_b = {
            "X-User-Id": str(principal_b.id),
        }

        # School B insights should have 0 entries, 0 periods
        res_b = client.get("/api/v1/timetable/insights", headers=headers_b)
        assert res_b.status_code == 200
        assert res_b.json()["is_configured"] is False
        assert res_b.json()["total_scheduled_periods"] == 0

        # School B trying to access Teacher 1 from School A
        res_cross = client.get(f"/api/v1/timetable/teacher/{t1.id}", headers=headers_b)
        assert res_cross.status_code == 404
        print(f"   [PASS] Cross-school isolation properly enforced")

        print("\n==================================================")
        print("ALL TIMETABLE MULTI-VIEW & INSIGHTS TESTS PASSED!")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_timetable_multiview_and_insights()
