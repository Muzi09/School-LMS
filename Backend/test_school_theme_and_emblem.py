import io
import time
import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password, hash_token
from app.models.enums import UserRole
from app.models.user import User
from app.models.school import School
from app.models.onboarding_token import PrincipalOnboardingToken

client = TestClient(app)

def run_theme_and_emblem_tests():
    print("\n" + "="*80)
    print("STARTING DYNAMIC SCHOOL THEME COLOR & EMBLEM TESTS")
    print("="*80)

    db = SessionLocal()
    ts = int(time.time() * 1000)

    # 1. Create Principal User and Onboarding Token for School A (Custom Theme + Emblem)
    raw_token_a = f"test_token_a_{uuid.uuid4().hex}"
    principal_a = User(
        first_name="Arthur",
        last_name="Pendelton",
        email=f"principal_a_{ts}@schoola.edu",
        login_mobile=f"98{str(ts)[-8:]}",
        role=UserRole.PRINCIPAL,
        is_active=True,
        school_setup_completed=False,
    )
    db.add(principal_a)
    db.commit()
    db.refresh(principal_a)

    token_rec_a = PrincipalOnboardingToken(
        user_id=principal_a.id,
        token_hash=hash_token(raw_token_a),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(token_rec_a)
    db.commit()
    print("[PASS] Step 1: Created Principal A and valid onboarding token.")

    # 2. Test Emblem Upload Endpoint
    fake_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("school_logo.png", io.BytesIO(fake_png_bytes), "image/png")}
    data = {"token": raw_token_a}

    upload_res = client.post("/api/v1/principal/onboarding/upload-emblem", data=data, files=files)
    assert upload_res.status_code == 200, f"Emblem upload failed: {upload_res.text}"
    upload_json = upload_res.json()
    assert upload_json["success"] is True
    assert upload_json["emblem_url"].startswith("/uploads/emblems/emblem_")
    emblem_url_a = upload_json["emblem_url"]
    print(f"[PASS] Step 2: School emblem uploaded successfully -> {emblem_url_a}")

    # 3. Test Invalid Color Rejection in Complete School Setup
    invalid_payload = {
        "token": raw_token_a,
        "school_name": f"Apex Academy {ts}",
        "school_code": f"APEX_{str(ts)[-4:]}",
        "school_email": f"info_{ts}@apex.edu",
        "school_phone": "9988776655",
        "address": "123 Academic Blvd",
        "primary_color": "invalid_color_code",  # Malformed
        "emblem_url": emblem_url_a,
        "classes": [{"name": "Grade 1", "order_index": 1, "sections": ["A", "B"]}],
        "houses": [{"name": "Phoenix", "color": "#ef4444"}],
        "password": "PrincipalPassword123!",
        "confirm_password": "PrincipalPassword123!",
        "pin": "1234",
        "confirm_pin": "1234",
    }
    invalid_res = client.post("/api/v1/principal/onboarding/complete", json=invalid_payload)
    assert invalid_res.status_code in (400, 422), f"Expected validation error, got {invalid_res.status_code}: {invalid_res.text}"
    print("[PASS] Step 3: Rejected malformed primary color format as expected.")

    # 4. Complete School Setup for School A with Custom HEX Color (#2563EB) & Emblem
    valid_payload_a = {
        **invalid_payload,
        "primary_color": "#2563EB",
    }
    complete_res_a = client.post("/api/v1/principal/onboarding/complete", json=valid_payload_a)
    assert complete_res_a.status_code == 200, f"Complete setup failed: {complete_res_a.text}"
    school_id_a = complete_res_a.json()["school_id"]
    print(f"[PASS] Step 4: School A setup completed with primary_color=#2563EB and emblem_url={emblem_url_a}")

    # 5. Verify Principal A Login & /auth/me returns school customization
    login_res_a = client.post("/api/v1/auth/login", json={
        "email": principal_a.email,
        "password": "PrincipalPassword123!",
    })
    assert login_res_a.status_code == 200
    auth_data_a = login_res_a.json()
    assert auth_data_a["user"]["school_primary_color"] == "#2563EB"
    assert auth_data_a["user"]["school_emblem_url"] == emblem_url_a
    token_jwt_a = auth_data_a["access_token"]

    me_res_a = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token_jwt_a}"})
    assert me_res_a.status_code == 200
    assert me_res_a.json()["school_primary_color"] == "#2563EB"
    assert me_res_a.json()["school_emblem_url"] == emblem_url_a
    print("[PASS] Step 5: Principal A received dynamic primary_color (#2563EB) and emblem_url on login and /auth/me.")

    # 6. Create School B with Default/NULL Theme & Emblem (Testing Optional Fallbacks)
    ts_b = ts + 100
    raw_token_b = f"test_token_b_{uuid.uuid4().hex}"
    principal_b = User(
        first_name="Beatrice",
        last_name="Holloway",
        email=f"principal_b_{ts_b}@schoolb.edu",
        login_mobile=f"97{str(ts_b)[-8:]}",
        role=UserRole.PRINCIPAL,
        is_active=True,
        school_setup_completed=False,
    )
    db.add(principal_b)
    db.commit()
    db.refresh(principal_b)

    token_rec_b = PrincipalOnboardingToken(
        user_id=principal_b.id,
        token_hash=hash_token(raw_token_b),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(token_rec_b)
    db.commit()

    valid_payload_b = {
        "token": raw_token_b,
        "school_name": f"Beacon High {ts_b}",
        "school_code": f"BCN_{str(ts_b)[-4:]}",
        "school_email": f"info_{ts_b}@beacon.edu",
        "school_phone": "9988771122",
        "address": "456 Beacon Way",
        "primary_color": None,  # Default
        "emblem_url": None,     # Default Sparkle
        "classes": [{"name": "Class 1", "order_index": 1, "sections": ["A"]}],
        "houses": [],
        "password": "PrincipalPassword123!",
        "confirm_password": "PrincipalPassword123!",
        "pin": "5678",
        "confirm_pin": "5678",
    }
    complete_res_b = client.post("/api/v1/principal/onboarding/complete", json=valid_payload_b)
    assert complete_res_b.status_code == 200

    login_res_b = client.post("/api/v1/auth/login", json={
        "email": principal_b.email,
        "password": "PrincipalPassword123!",
    })
    auth_data_b = login_res_b.json()
    assert auth_data_b["user"]["school_primary_color"] is None
    assert auth_data_b["user"]["school_emblem_url"] is None
    print("[PASS] Step 6: School B setup completed with NULL color and emblem (graceful defaults).")

    # 7. Multi-Tenant Isolation Verification
    # Principal A cannot see School B's theme and vice versa
    assert auth_data_a["user"]["school_primary_color"] == "#2563EB"
    assert auth_data_b["user"]["school_primary_color"] is None
    assert auth_data_a["user"]["school_id"] != auth_data_b["user"]["school_id"]
    print("[PASS] Step 7: Multi-tenant tenant isolation verified successfully.")

    db.close()
    print("\nALL DYNAMIC THEME COLOR & EMBLEM BACKEND TESTS PASSED!\n")

if __name__ == "__main__":
    run_theme_and_emblem_tests()
