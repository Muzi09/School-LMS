from datetime import date
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.school import School
from app.repositories.school_repository import SchoolRepository

client = TestClient(app)

def test_api():
    # Ensure a test school exists
    db = SessionLocal()
    try:
        school_repo = SchoolRepository(db)
        school = school_repo.get_by_code("TEST-SCH-01")
        if not school:
            school = School(
                name="Test International Academy",
                code="TEST-SCH-01",
                email="info@testschool.edu",
                is_active=True,
            )
            school = school_repo.create(school)
        school_id = str(school.id)
    finally:
        db.close()

    suffix = uuid4().hex[:6]

    print("1. Testing Health Endpoint (GET /)...")
    res = client.get("/")
    assert res.status_code == 200, res.text
    print(f"   Health check: {res.json()}")

    print("2. Testing POST /api/v1/users/admin...")
    admin_payload = {
        "first_name": "AdminAlice",
        "last_name": "Smith",
        "email": f"alice_{suffix}@testschool.edu",
        "phone": "1122334455",
        "password": "Password123!",
        "school_id": school_id,
        "profile": {
            "employee_code": f"EMP-ADM-{suffix}",
            "designation": "Director",
            "department": "Executive"
        }
    }
    res = client.post("/api/v1/users/admin", json=admin_payload)
    assert res.status_code == 201, res.text
    admin_data = res.json()
    admin_id = admin_data["id"]
    print(f"   Admin created via HTTP: ID={admin_id}, email={admin_data['email']}")

    print("3. Testing Conflict Exception (Duplicate Email) via HTTP...")
    res_conflict = client.post("/api/v1/users/admin", json=admin_payload)
    assert res_conflict.status_code == 409, res_conflict.text
    print(f"   409 Conflict handled correctly: {res_conflict.json()}")

    print("4. Testing GET /api/v1/users (List & Pagination)...")
    res = client.get(f"/api/v1/users?school_id={school_id}&search=AdminAlice")
    assert res.status_code == 200, res.text
    list_data = res.json()
    assert list_data["total"] >= 1
    assert any(u["id"] == admin_id for u in list_data["items"])
    print(f"   List endpoint returned {list_data['total']} items")

    print("5. Testing GET /api/v1/users/{user_id}...")
    res = client.get(f"/api/v1/users/{admin_id}")
    assert res.status_code == 200, res.text
    assert res.json()["id"] == admin_id
    print(f"   Get single user verified")

    print("6. Testing PUT /api/v1/users/{user_id}...")
    update_payload = {"first_name": "AliceUpdated"}
    res = client.put(f"/api/v1/users/{admin_id}", json=update_payload)
    assert res.status_code == 200, res.text
    assert res.json()["first_name"] == "AliceUpdated"
    print(f"   Update user verified")

    print("7. Testing PATCH /api/v1/users/{user_id}/status...")
    status_payload = {"is_active": False}
    res = client.patch(f"/api/v1/users/{admin_id}/status", json=status_payload)
    assert res.status_code == 200, res.text
    assert res.json()["is_active"] is False
    print(f"   Status change verified")

    print("8. Testing DELETE /api/v1/users/{user_id}...")
    res = client.delete(f"/api/v1/users/{admin_id}")
    assert res.status_code == 200, res.text
    assert "deleted successfully" in res.json()["message"]
    print(f"   Soft delete verified")

    print("\nAll HTTP API End-to-End Tests with N-Tier Architecture PASSED successfully!")

if __name__ == "__main__":
    test_api()
