from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import Gender, UserRole

client = TestClient(app)


def test_api():
    suffix = uuid4().hex[:6]

    print("1. Testing Health Endpoint (GET /)...")
    res = client.get("/")
    assert res.status_code == 200, res.text
    print(f"   Health check: {res.json()}")

    print("2. Testing POST /api/v1/staff (Create Staff without school_id)...")
    staff_payload = {
        "first_name": "AliceStaff",
        "last_name": "Johnson",
        "email": f"alice_{suffix}@testschool.edu",
        "login_mobile": f"92{suffix[:8]}",
        "password": "Password123!",
        "profile": {
            "roll_no": f"STF-{suffix}",
            "gender": Gender.FEMALE,
            "date_of_birth": "1988-02-20",
            "father_first_name": "James",
            "father_last_name": "Johnson",
        },
    }
    res = client.post("/api/v1/staff", json=staff_payload)
    assert res.status_code == 201, res.text
    staff_data = res.json()
    staff_id = staff_data["id"]
    assert staff_data["role"] == UserRole.STAFF
    assert staff_data["staff_profile"]["roll_no"] == f"STF-{suffix}"
    assert staff_data["staff_profile"]["gender"] == Gender.FEMALE
    assert staff_data["staff_profile"]["father_first_name"] == "James"
    print(f"   Staff created: ID={staff_id}, roll_no={staff_data['staff_profile']['roll_no']}")

    print("3. Testing GET /api/v1/staff (List Staff)...")
    res = client.get(f"/api/v1/staff?search=AliceStaff")
    assert res.status_code == 200, res.text
    staff_list = res.json()
    assert staff_list["total"] >= 1
    assert any(s["id"] == staff_id for s in staff_list["items"])
    for s in staff_list["items"]:
        assert s["role"] == UserRole.STAFF
    print(f"   Staff list returned {staff_list['total']} items, all verified as Staff role")

    print("4. Testing POST /api/v1/students (Create Student without school_id)...")
    student_payload = {
        "first_name": "CharlieStudent",
        "last_name": "Brown",
        "login_mobile": f"94{suffix[:8]}",
        "email": f"student_{suffix}@testschool.edu",
        "password": "Password123!",
        "profile": {
            "middle_name": "Alexander",
            "roll_no": f"STU-{suffix}",
            "gender": Gender.MALE,
            "date_of_birth": "2009-11-05",
            "class_name": "Grade 10",
            "section": "A",
            "house": "Vikings",
            "father_first_name": "David",
            "father_last_name": "Brown",
        },
    }
    res = client.post("/api/v1/students", json=student_payload)
    assert res.status_code == 201, res.text
    student_data = res.json()
    student_id = student_data["id"]
    assert student_data["role"] == UserRole.STUDENT
    assert student_data["student_profile"]["middle_name"] == "Alexander"
    assert student_data["student_profile"]["class_name"] == "Grade 10"
    assert student_data["student_profile"]["section"] == "A"
    assert student_data["student_profile"]["house"] == "Vikings"
    print(f"   Student created: ID={student_id}, class={student_data['student_profile']['class_name']}")

    print("5. Testing GET /api/v1/students (List Students)...")
    res = client.get(f"/api/v1/students?search=CharlieStudent")
    assert res.status_code == 200, res.text
    student_list = res.json()
    assert student_list["total"] >= 1
    assert any(s["id"] == student_id for s in student_list["items"])
    for s in student_list["items"]:
        assert s["role"] == UserRole.STUDENT
    print(f"   Student list returned {student_list['total']} items, all verified as Student role")

    print("6. Testing Conflict Handling on Duplicate Mobile / Email...")
    res_conflict = client.post("/api/v1/staff", json=staff_payload)
    assert res_conflict.status_code == 409, res_conflict.text
    print(f"   409 Conflict handled correctly: {res_conflict.json()}")

    print("7. Testing PUT /api/v1/staff/{staff_id}...")
    res = client.put(f"/api/v1/staff/{staff_id}", json={"first_name": "AliceUpdated"})
    assert res.status_code == 200, res.text
    assert res.json()["first_name"] == "AliceUpdated"
    print("   Staff update verified")

    print("8. Testing PUT /api/v1/students/{student_id}...")
    res = client.put(f"/api/v1/students/{student_id}", json={"first_name": "CharlesUpdated"})
    assert res.status_code == 200, res.text
    assert res.json()["first_name"] == "CharlesUpdated"
    print("   Student update verified")

    print("9. Testing PATCH status & DELETE for Staff and Student...")
    res = client.patch(f"/api/v1/staff/{staff_id}/status", json={"is_active": False})
    assert res.status_code == 200, res.text
    assert res.json()["is_active"] is False

    res = client.delete(f"/api/v1/staff/{staff_id}")
    assert res.status_code == 200, res.text

    res = client.delete(f"/api/v1/students/{student_id}")
    assert res.status_code == 200, res.text
    print("   Status toggle and soft delete verified")

    print("\nAll Dedicated Staff & Student API Tests (without school_id) PASSED successfully!")


if __name__ == "__main__":
    test_api()
