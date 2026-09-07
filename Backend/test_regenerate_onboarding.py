import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.models.onboarding_token import PrincipalOnboardingToken
from app.models.smtp_configuration import SmtpConfiguration

client = TestClient(app)

def run_tests():
    print("\n" + "="*80)
    print("STARTING ONBOARDING LINK REGENERATION TESTS")
    print("="*80)

    db = SessionLocal()

    ts = int(time.time() * 1000)
    admin_email = f"admin_regen_{ts}@platform.com"
    admin_pwd = "SuperSecretAdmin123!"

    # 1. Create Admin
    admin_user = User(
        first_name="Regen",
        last_name="Admin",
        email=admin_email,
        login_mobile=f"97{str(ts)[-8:]}",
        password_hash=hash_password(admin_pwd),
        role=UserRole.ADMIN,
        is_active=True,
        school_setup_completed=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    # 2. Login as Admin
    login_res = client.post("/api/v1/auth/login", json={
        "email": admin_email,
        "password": admin_pwd,
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Step 1: Admin created and authenticated.")

    # 3. Configure SMTP
    smtp_payload = {
        "smtp_host": "smtp.mailprovider.com",
        "smtp_port": 587,
        "smtp_username": f"smtp_{ts}@platform.com",
        "smtp_password": "FakeSecretPassword123!",
        "from_email": f"smtp_{ts}@platform.com",
        "from_name": "Test Platform LMS",
        "security": "TLS",
        "is_active": True,
    }
    smtp_res = client.post("/api/v1/admin/smtp", json=smtp_payload, headers=headers)
    assert smtp_res.status_code == 200, f"SMTP save failed: {smtp_res.text}"
    print("[PASS] Step 2: Admin SMTP configured successfully.")

    # 4. Create Principal with mocked email delivery
    principal_email = f"principal_regen_{ts}@school.com"
    with patch("app.api.v1.endpoints.admin.send_principal_invitation_email", return_value=True):
        p_res = client.post("/api/v1/admin/principals", json={
            "first_name": "Sarah",
            "last_name": "Connor",
            "email": principal_email,
            "login_mobile": f"96{str(ts)[-8:]}",
        }, headers=headers)
    assert p_res.status_code == 201, f"Principal create failed: {p_res.text}"
    p_data = p_res.json()
    p_id = p_data["id"]
    assert p_data["onboarding_link_expired"] is False
    assert p_data["can_regenerate_onboarding"] is False
    print(f"[PASS] Step 3: Principal {principal_email} invited. Link active.")

    # 5. Check GET /admin/principals
    list_res = client.get("/api/v1/admin/principals", headers=headers)
    assert list_res.status_code == 200
    listed_p = next(x for x in list_res.json() if x["id"] == p_id)
    assert listed_p["onboarding_link_expired"] is False
    assert listed_p["can_regenerate_onboarding"] is False
    print("[PASS] Step 4: GET /admin/principals confirmed active link status.")

    # 6. Attempt to regenerate active unexpired link -> MUST FAIL WITH 400
    with patch("app.api.v1.endpoints.admin.send_principal_invitation_email", return_value=True):
        regen_fail_res = client.post(f"/api/v1/admin/principals/{p_id}/regenerate-onboarding", headers=headers)
    assert regen_fail_res.status_code == 400, f"Expected 400, got {regen_fail_res.status_code}: {regen_fail_res.text}"
    assert "still valid and has not expired yet" in regen_fail_res.json()["detail"]
    print(f"[PASS] Step 5: Early regeneration blocked with 400: {regen_fail_res.json()['detail']}")

    # 7. Manually expire token in database
    token_record = db.query(PrincipalOnboardingToken).filter(PrincipalOnboardingToken.user_id == p_id).first()
    assert token_record is not None
    token_record.expires_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db.commit()
    print("[INFO] Manually expired onboarding token in database.")

    # 8. Check GET /admin/principals -> MUST SHOW EXPIRED
    list_res2 = client.get("/api/v1/admin/principals", headers=headers)
    assert list_res2.status_code == 200
    listed_p2 = next(x for x in list_res2.json() if x["id"] == p_id)
    assert listed_p2["onboarding_link_expired"] is True
    assert listed_p2["can_regenerate_onboarding"] is True
    print("[PASS] Step 6: GET /admin/principals shows onboarding_link_expired: True, can_regenerate_onboarding: True.")

    # 9. Regenerate onboarding link -> MUST SUCCEED (200)
    with patch("app.api.v1.endpoints.admin.send_principal_invitation_email", return_value=True):
        regen_success_res = client.post(f"/api/v1/admin/principals/{p_id}/regenerate-onboarding", headers=headers)
    assert regen_success_res.status_code == 200, f"Regen failed: {regen_success_res.text}"
    regen_data = regen_success_res.json()
    assert regen_data["onboarding_url"] is not None
    assert regen_data["onboarding_link_expired"] is False
    assert regen_data["can_regenerate_onboarding"] is False
    print(f"[PASS] Step 7: Onboarding link successfully regenerated: {regen_data['onboarding_url']}")

    # 10. Check GET /admin/principals -> MUST SHOW ACTIVE AGAIN
    list_res3 = client.get("/api/v1/admin/principals", headers=headers)
    assert list_res3.status_code == 200
    listed_p3 = next(x for x in list_res3.json() if x["id"] == p_id)
    assert listed_p3["onboarding_link_expired"] is False
    assert listed_p3["can_regenerate_onboarding"] is False
    print("[PASS] Step 8: GET /admin/principals reflects renewed active token.")

    # 11. Mark setup completed in DB and attempt regen -> MUST FAIL WITH 400
    p_user = db.query(User).filter(User.id == p_id).first()
    p_user.school_setup_completed = True
    db.commit()

    with patch("app.api.v1.endpoints.admin.send_principal_invitation_email", return_value=True):
        completed_regen_res = client.post(f"/api/v1/admin/principals/{p_id}/regenerate-onboarding", headers=headers)
    assert completed_regen_res.status_code == 400
    assert "already completed school onboarding" in completed_regen_res.json()["detail"]
    print(f"[PASS] Step 9: Regeneration for already onboarded principal blocked with 400: {completed_regen_res.json()['detail']}")

    print("\n" + "="*80)
    print("ALL ONBOARDING REGENERATION TESTS PASSED SUCCESSFULLY!")
    print("="*80 + "\n")

if __name__ == "__main__":
    run_tests()
