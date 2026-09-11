import sys
import time
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password, decrypt_smtp_password
from app.models.enums import UserRole
from app.models.user import User
from app.models.smtp_configuration import SmtpConfiguration

client = TestClient(app)

def run_smtp_tests():
    print("\n" + "="*80)
    print("STARTING ADMIN SMTP CONFIGURATION & PRINCIPAL RESTRICTION TESTS")
    print("="*80)

    db = SessionLocal()

    # 1. Create a fresh Admin for testing
    ts = int(time.time() * 1000)
    admin_email = f"admin_smtp_{ts}@platform.com"
    admin_pwd = "SuperSecretAdmin123!"

    admin_user = User(
        first_name="SMTP",
        last_name="Tester",
        email=admin_email,
        login_mobile=f"98{str(ts)[-8:]}",
        password_hash=hash_password(admin_pwd),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    # 2. Login as Admin to get Bearer token
    login_res = client.post("/api/v1/auth/login", json={
        "email": admin_email,
        "password": admin_pwd,
    })
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Step 1: Admin logged in successfully with token.")

    # 3. Check initial SMTP config status -> should be is_configured: False
    smtp_get_res = client.get("/api/v1/admin/smtp", headers=headers)
    assert smtp_get_res.status_code == 200, f"Failed GET /smtp: {smtp_get_res.text}"
    smtp_data = smtp_get_res.json()
    assert smtp_data["is_configured"] is False
    assert smtp_data["is_password_set"] is False
    print("[PASS] Step 2: GET /smtp returned is_configured: False as expected.")

    # 4. Attempt to create Principal without SMTP -> MUST FAIL WITH 400
    principal_payload = {
        "first_name": "John",
        "last_name": "BlockedPrincipal",
        "email": f"principal_blocked_{ts}@school.com",
        "login_mobile": f"91{str(ts)[-8:]}",
    }
    block_res = client.post("/api/v1/admin/principals", json=principal_payload, headers=headers)
    assert block_res.status_code == 400, f"Expected 400 Bad Request, got {block_res.status_code}: {block_res.text}"
    assert "SMTP configuration is required before creating a Principal" in block_res.json()["detail"]
    print(f"[PASS] Step 3: Principal creation without SMTP configuration was BLOCKED with 400 Bad Request: {block_res.json()['detail']}")

    # 5. Save SMTP configuration
    smtp_save_payload = {
        "smtp_host": "smtp.mailprovider.com",
        "smtp_port": 587,
        "smtp_username": "smtp_test_user@platform.com",
        "smtp_password": "MySuperSecretSmtpPassword123!",
        "from_email": "notifications@platform.com",
        "from_name": "School LMS Central",
        "security": "TLS",
        "is_active": True,
    }
    save_res = client.post("/api/v1/admin/smtp", json=smtp_save_payload, headers=headers)
    assert save_res.status_code == 200, f"Failed POST /smtp: {save_res.text}"
    saved_smtp = save_res.json()
    assert saved_smtp["is_configured"] is True
    assert saved_smtp["is_password_set"] is True
    assert saved_smtp["smtp_host"] == "smtp.mailprovider.com"
    assert saved_smtp["from_email"] == "notifications@platform.com"
    assert saved_smtp["smtp_password"] == "MySuperSecretSmtpPassword123!"
    assert "smtp_password_encrypted" not in saved_smtp
    print("[PASS] Step 4: SMTP configuration saved successfully. Decrypted password available for display.")

    # 6. Verify password was properly encrypted at rest in database
    db_smtp = db.query(SmtpConfiguration).filter(SmtpConfiguration.admin_id == admin_user.id).first()
    assert db_smtp is not None
    assert db_smtp.smtp_password_encrypted != "MySuperSecretSmtpPassword123!"
    decrypted = decrypt_smtp_password(db_smtp.smtp_password_encrypted)
    assert decrypted == "MySuperSecretSmtpPassword123!"
    print("[PASS] Step 5: Verified password encrypted at rest with Fernet and successfully decryptable.")

    # 6. Test POST /admin/smtp/test endpoint
    test_smtp_res = client.post("/api/v1/admin/smtp/test", json={
        "smtp_host": "smtp.mailprovider.com",
        "smtp_port": 587,
        "smtp_username": "smtp_test_user@platform.com",
        "smtp_password": None, # Should use saved password
        "security": "TLS",
    }, headers=headers)
    assert test_smtp_res.status_code == 200, f"Failed POST /smtp/test: {test_smtp_res.text}"
    test_data = test_smtp_res.json()
    assert "success" in test_data
    print(f"[PASS] Step 6: Tested POST /admin/smtp/test -> Result: success={test_data['success']}, message={test_data['message']}")

    # 7. Create Principal with invalid SMTP -> MUST FAIL WITH 400 & ROLLBACK
    fail_res = client.post("/api/v1/admin/principals", json=principal_payload, headers=headers)
    assert fail_res.status_code == 400, f"Expected 400 Bad Request on SMTP failure, got: {fail_res.text}"
    assert "Failed to send invitation email" in fail_res.json()["detail"]
    # Verify no orphan user record was created in DB
    orphan = db.query(User).filter(User.email == principal_payload["email"]).first()
    assert orphan is None, "Transactional integrity failed! Orphan user was found in DB."
    print(f"[PASS] Step 7: Principal creation failed gracefully on SMTP error with 400 & DB rolled back cleanly: {fail_res.json()['detail']}")

    # 8. Test successful Principal creation with mocked email delivery
    from unittest.mock import patch
    with patch("app.api.v1.endpoints.admin.send_principal_invitation_email", return_value=True):
        success_res = client.post("/api/v1/admin/principals", json=principal_payload, headers=headers)
        assert success_res.status_code == 201, f"Failed creating principal with mocked email: {success_res.text}"
        created_principal = success_res.json()
        assert created_principal["email"] == principal_payload["email"]
        assert "onboarding_url" in created_principal
        print(f"[PASS] Step 8: Principal created successfully when email sent: {created_principal['onboarding_url']}")

    # 9. Update SMTP configuration without changing password
    update_payload = {
        "smtp_host": "smtp.updatedhost.com",
        "smtp_port": 465,
        "smtp_username": "updated_user@platform.com",
        "smtp_password": None,  # leave unchanged
        "from_email": "updates@platform.com",
        "from_name": "School LMS Updated",
        "security": "SSL",
        "is_active": True,
    }
    update_res = client.post("/api/v1/admin/smtp", json=update_payload, headers=headers)
    assert update_res.status_code == 200, f"Failed updating SMTP: {update_res.text}"
    updated_smtp = update_res.json()
    assert updated_smtp["smtp_host"] == "smtp.updatedhost.com"
    assert updated_smtp["is_password_set"] is True

    # Verify previous password is still retained
    db.expire_all()
    db_smtp_updated = db.query(SmtpConfiguration).filter(SmtpConfiguration.admin_id == admin_user.id).first()
    assert decrypt_smtp_password(db_smtp_updated.smtp_password_encrypted) == "MySuperSecretSmtpPassword123!"
    print("[PASS] Step 9: Updated SMTP settings while preserving existing encrypted password.")

    # 10. Verify Admin Isolation: Create a 2nd Admin
    ts2 = int(time.time() * 1000) + 1
    admin_2 = User(
        first_name="Admin",
        last_name="Two",
        email=f"admin_2_{ts2}@platform.com",
        login_mobile=f"97{str(ts2)[-8:]}",
        password_hash=hash_password(admin_pwd),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin_2)
    db.commit()

    login_res2 = client.post("/api/v1/auth/login", json={
        "email": admin_2.email,
        "password": admin_pwd,
    })
    token2 = login_res2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    smtp_get_res2 = client.get("/api/v1/admin/smtp", headers=headers2)
    assert smtp_get_res2.json()["is_configured"] is False
    print("[PASS] Step 10: Admin 2 is isolated and does not inherit Admin 1's SMTP configuration.")

    db.close()
    print("\nALL ADMIN SMTP AND PRINCIPAL RESTRICTION TESTS PASSED!\n")

if __name__ == "__main__":
    run_smtp_tests()

