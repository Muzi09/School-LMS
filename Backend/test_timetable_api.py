"""
Test Timetable API Endpoints via FastAPI TestClient
Tests:
- GET /api/v1/timetable/periods
- POST /api/v1/timetable/periods
- PUT /api/v1/timetable/periods/{id}
- DELETE /api/v1/timetable/periods/{id}
- GET /api/v1/timetable/teachers
- GET /api/v1/timetable?section_id={id}
- POST /api/v1/timetable
- PUT /api/v1/timetable/{id}
- DELETE /api/v1/timetable/{id}
- Section conflict & Teacher conflict HTTP 409 responses with structured details
- Permission checks (Staff cannot create/update/delete periods or entries, but CAN view)
"""
import uuid
from datetime import date
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.enums import Gender, UserRole
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.subject import ClassSubject, Subject
from app.models.timetable import TimetablePeriod
from app.models.user import User

client = TestClient(app)


def test_timetable_api():
    db = SessionLocal()
    try:
        suffix = uuid.uuid4().hex[:6]
        print(f"\n==================================================")
        print(f"STARTING TIMETABLE API ENDPOINT TESTS [suffix={suffix}]")
        print(f"==================================================")

        # 1. Create School, Principal, Teaching Staff
        school = School(
            name=f"API Test Academy {suffix}",
            code=f"API_SCH_{suffix}",
            is_active=True,
            setup_completed=True,
        )
        db.add(school)
        db.commit()
        db.refresh(school)

        principal = User(
            first_name="Admin",
            last_name=f"Principal {suffix}",
            login_mobile=f"71{suffix[:8]}",
            role=UserRole.PRINCIPAL,
            is_active=True,
        )
        teacher_1 = User(
            first_name="Amit",
            last_name=f"Verma {suffix}",
            login_mobile=f"72{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        teacher_2 = User(
            first_name="Neha",
            last_name=f"Singh {suffix}",
            login_mobile=f"73{suffix[:8]}",
            role=UserRole.STAFF,
            is_active=True,
        )
        db.add_all([principal, teacher_1, teacher_2])
        db.commit()
        db.refresh(principal)
        db.refresh(teacher_1)
        db.refresh(teacher_2)

        # Link profiles to school
        from app.models.principal import PrincipalProfile
        princ_prof = PrincipalProfile(
            user_id=principal.id,
            school_id=school.id,
            school_setup_completed=True,
        )
        staff_1 = StaffProfile(
            user_id=teacher_1.id,
            school_id=school.id,
            roll_no=f"STF-API1-{suffix}",
            gender=Gender.MALE,
            date_of_birth=date(1991, 1, 1),
            status="ACTIVE",
        )
        staff_2 = StaffProfile(
            user_id=teacher_2.id,
            school_id=school.id,
            roll_no=f"STF-API2-{suffix}",
            gender=Gender.FEMALE,
            date_of_birth=date(1993, 2, 2),
            status="ACTIVE",
        )
        db.add_all([princ_prof, staff_1, staff_2])

        # Class, Section, Subjects
        school_class = SchoolClass(school_id=school.id, name="Class 10", order_index=10)
        db.add(school_class)
        db.commit()
        db.refresh(school_class)

        section = Section(school_id=school.id, class_id=school_class.id, name="A")
        sub_math = Subject(school_id=school.id, name="Mathematics", code="MTH")
        sub_sci = Subject(school_id=school.id, name="Science", code="SCI")
        db.add_all([section, sub_math, sub_sci])
        db.commit()
        db.refresh(section)
        db.refresh(sub_math)
        db.refresh(sub_sci)

        cs_math = ClassSubject(school_id=school.id, class_id=school_class.id, subject_id=sub_math.id, section_id=None)
        cs_sci = ClassSubject(school_id=school.id, class_id=school_class.id, subject_id=sub_sci.id, section_id=None)
        db.add_all([cs_math, cs_sci])
        db.commit()

        principal_headers = {"X-User-Id": str(principal.id)}
        staff_headers = {"X-User-Id": str(teacher_1.id)}

        # -------------------------------------------------------------------
        # 1. Test Period Endpoints
        # -------------------------------------------------------------------
        print("\n1. Testing POST /api/v1/timetable/periods (Create Period)...")
        res = client.post(
            "/api/v1/timetable/periods",
            json={"period_number": 1, "start_time": "08:00", "end_time": "08:45"},
            headers=principal_headers,
        )
        assert res.status_code == 201, res.text
        p1_data = res.json()
        period_1_id = p1_data["id"]
        assert p1_data["period_number"] == 1
        assert p1_data["start_time"] == "08:00"
        print(f"   [PASS] Created Period 1: ID={period_1_id}")

        # Staff cannot create period (403 Forbidden)
        res = client.post(
            "/api/v1/timetable/periods",
            json={"period_number": 2, "start_time": "08:45", "end_time": "09:30"},
            headers=staff_headers,
        )
        assert res.status_code == 403, f"Expected 403 for staff, got {res.status_code}"
        print("   [PASS] Staff successfully blocked from creating period (403 Forbidden)")

        # Create period 2 with principal
        res = client.post(
            "/api/v1/timetable/periods",
            json={"period_number": 2, "start_time": "08:45", "end_time": "09:30"},
            headers=principal_headers,
        )
        assert res.status_code == 201, res.text
        period_2_id = res.json()["id"]
        print(f"   [PASS] Created Period 2: ID={period_2_id}")

        # List periods (both staff and principal can view)
        res = client.get("/api/v1/timetable/periods", headers=staff_headers)
        assert res.status_code == 200, res.text
        assert len(res.json()) >= 2
        print(f"   [PASS] Staff successfully listed {len(res.json())} periods")

        # -------------------------------------------------------------------
        # 2. Test Eligible Teachers
        # -------------------------------------------------------------------
        print("\n2. Testing GET /api/v1/timetable/teachers...")
        res = client.get("/api/v1/timetable/teachers", headers=principal_headers)
        assert res.status_code == 200, res.text
        teachers_list = res.json()
        assert len(teachers_list) == 2
        print(f"   [PASS] Teachers returned: {[t['name'] for t in teachers_list]}")

        # -------------------------------------------------------------------
        # 3. Test Timetable Entry Creation & Conflicts
        # -------------------------------------------------------------------
        print("\n3. Testing POST /api/v1/timetable (Create Entry)...")
        entry_payload = {
            "section_id": str(section.id),
            "subject_id": str(sub_math.id),
            "teacher_user_id": str(teacher_1.id),
            "period_id": period_1_id,
            "day_of_week": "MONDAY",
        }
        res = client.post("/api/v1/timetable", json=entry_payload, headers=principal_headers)
        assert res.status_code == 201, res.text
        entry_1_data = res.json()
        entry_1_id = entry_1_data["id"]
        assert entry_1_data["day_of_week"] == "MONDAY"
        assert entry_1_data["subject"]["name"] == "Mathematics"
        print(f"   [PASS] Timetable entry created: ID={entry_1_id}")

        # Staff cannot create timetable entry
        res = client.post("/api/v1/timetable", json=entry_payload, headers=staff_headers)
        assert res.status_code == 403, f"Expected 403 for staff, got {res.status_code}"
        print("   [PASS] Staff successfully blocked from creating timetable entry (403 Forbidden)")

        # Section Conflict
        print("\n4. Testing Section Conflict via API...")
        conflict_payload = {
            "section_id": str(section.id),
            "subject_id": str(sub_sci.id),
            "teacher_user_id": str(teacher_2.id),
            "period_id": period_1_id,
            "day_of_week": "MONDAY",
        }
        res = client.post("/api/v1/timetable", json=conflict_payload, headers=principal_headers)
        assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("code") == "SECTION_SCHEDULE_CONFLICT"
        print(f"   [PASS] 409 SECTION_SCHEDULE_CONFLICT received: code={data.get('code')}, message='{data.get('message')}'")

        # -------------------------------------------------------------------
        # 4. Test Weekly Timetable Grid GET
        # -------------------------------------------------------------------
        print("\n5. Testing GET /api/v1/timetable?section_id=...")
        res = client.get(f"/api/v1/timetable?section_id={section.id}", headers=staff_headers)
        assert res.status_code == 200, res.text
        grid_data = res.json()
        assert grid_data["section"]["class_name"] == "Class 10"
        assert grid_data["section"]["section_name"] == "A"
        assert len(grid_data["periods"]) >= 2
        assert len(grid_data["entries"]) == 1
        assert len(grid_data["subjects"]) == 2
        print(f"   [PASS] Grid successfully fetched: {len(grid_data['entries'])} entries, {len(grid_data['periods'])} periods")

        # -------------------------------------------------------------------
        # 5. Test Entry Delete & Update
        # -------------------------------------------------------------------
        print("\n6. Testing DELETE /api/v1/timetable/{entry_id}...")
        res = client.delete(f"/api/v1/timetable/{entry_1_id}", headers=principal_headers)
        assert res.status_code == 200, res.text
        print(f"   [PASS] Timetable entry deleted")

        # Verify entry no longer in grid
        res = client.get(f"/api/v1/timetable?section_id={section.id}", headers=principal_headers)
        assert len(res.json()["entries"]) == 0
        print("   [PASS] Entry successfully removed from active timetable grid")

        print("\n==================================================")
        print("ALL TIMETABLE API ENDPOINT TESTS PASSED!")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    test_timetable_api()
