from fastapi.testclient import TestClient
from sqlalchemy import func

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password, hash_pin, generate_onboarding_token
from app.main import app
from app.models.enums import UserRole
from app.models.house import House
from app.models.onboarding_token import PrincipalOnboardingToken
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.smtp_configuration import SmtpConfiguration
from app.models.user import User

client = TestClient(app)


def test_complete_onboarding_and_auth_flow():
    db = SessionLocal()
    try:
        # 1. Ensure Admin exists
        admin = db.query(User).filter(
            func.lower(User.email) == settings.ADMIN_DEFAULT_EMAIL.lower(),
            User.deleted_at.is_(None),
        ).first()
        if not admin:
            admin = User(
                first_name="Admin",
                last_name="User",
                email=settings.ADMIN_DEFAULT_EMAIL.lower(),
                login_mobile="9999999999",
                password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                role=UserRole.ADMIN,
                is_active=True,
                school_setup_completed=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            admin.password_hash = hash_password(settings.ADMIN_DEFAULT_PASSWORD)
            admin.role = UserRole.ADMIN
            db.commit()
            db.refresh(admin)

        # 2. Test Admin Login
        login_res = client.post(
            "/api/v1/auth/login",
            json={
                "email": settings.ADMIN_DEFAULT_EMAIL,
                "password": settings.ADMIN_DEFAULT_PASSWORD,
            },
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        admin_token = login_res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {admin_token}"}

        # Ensure Admin has SMTP configured for principal invites
        client.post(
            "/api/v1/admin/smtp",
            headers=auth_headers,
            json={
                "smtp_host": "smtp.platform-test.com",
                "smtp_port": 587,
                "smtp_username": "smtp_test@platform.com",
                "smtp_password": "TestPassword123!",
                "from_email": "admin@platform.com",
                "from_name": "School LMS Platform",
                "security": "TLS",
                "is_active": True,
            }
        )

        # 3. Admin Dashboard Stats
        dash_res = client.get("/api/v1/admin/dashboard", headers=auth_headers)
        assert dash_res.status_code == 200
        stats = dash_res.json()
        assert "total_schools" in stats
        assert "total_principals" in stats

        # 4. Admin Creates Principal
        from unittest.mock import patch
        test_email = f"principal_test_{int(datetime_now_ts())}@school.com"
        test_mobile = f"98{int(datetime_now_ts()) % 100000000:08d}"
        with patch("app.api.v1.endpoints.admin.send_principal_invitation_email", return_value=True):
            create_p_res = client.post(
                "/api/v1/admin/principals",
                headers=auth_headers,
                json={
                    "first_name": "Arthur",
                    "last_name": "Pendelton",
                    "email": test_email,
                    "login_mobile": test_mobile,
                },
            )
        assert create_p_res.status_code == 201, f"Create principal failed: {create_p_res.text}"
        p_data = create_p_res.json()
        assert p_data["email"] == test_email
        assert p_data["school_setup_completed"] is False
        assert p_data["onboarding_url"] is not None

        # Extract token from onboarding URL
        onboarding_url = p_data["onboarding_url"]
        raw_token = onboarding_url.split("token=")[-1]

        # 5. Validate Onboarding Token
        val_res = client.get(f"/api/v1/principal/onboarding/validate?token={raw_token}")
        assert val_res.status_code == 200
        assert val_res.json()["is_valid"] is True
        assert val_res.json()["email"] == test_email

        # 6. Complete School Setup Wizard
        school_code = f"SCH{int(datetime_now_ts()) % 100000:05d}"
        complete_res = client.post(
            "/api/v1/principal/onboarding/complete",
            json={
                "token": raw_token,
                "school_name": "Greenwood International Academy",
                "school_code": school_code,
                "school_email": f"info@{school_code.lower()}.edu",
                "school_phone": "9876543210",
                "address": "42 Knowledge Park, Tech City",
                "classes": [
                    {"name": "Class 1", "order_index": 1, "sections": ["A", "B"]},
                    {"name": "Class 2", "order_index": 2, "sections": ["A", "B", "C"]},
                    {"name": "Class 3", "order_index": 3, "sections": ["A"]},
                ],
                "houses": [
                    {"name": "Red House", "color": "#ef4444"},
                    {"name": "Blue House", "color": "#3b82f6"},
                    {"name": "Green House", "color": "#10b981"},
                ],
                "password": "PrincipalPassword@123",
                "confirm_password": "PrincipalPassword@123",
                "pin": "1234",
                "confirm_pin": "1234",
            },
        )
        assert complete_res.status_code == 200, f"Setup complete failed: {complete_res.text}"
        setup_data = complete_res.json()
        assert setup_data["success"] is True

        # 7. Verify Onboarding Token cannot be reused
        val_reuse = client.get(f"/api/v1/principal/onboarding/validate?token={raw_token}")
        assert val_reuse.status_code == 400

        # 8. Principal General Login (Email + Password)
        p_login_res = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_email,
                "password": "PrincipalPassword@123",
            },
        )
        assert p_login_res.status_code == 200
        p_token = p_login_res.json()["access_token"]
        p_headers = {"Authorization": f"Bearer {p_token}"}
        p_user = p_login_res.json()["user"]
        assert p_user["school_setup_completed"] is True
        assert p_user["school_name"] == "Greenwood International Academy"

        # 9. Principal Quick Login (Email + PIN)
        p_quick_res = client.post(
            "/api/v1/auth/quick-login",
            json={
                "email": test_email,
                "pin": "1234",
            },
        )
        assert p_quick_res.status_code == 200
        assert p_quick_res.json()["user"]["role"] == UserRole.PRINCIPAL

        # 10. Query Configured Classes, Sections, Houses with Tenant Isolation
        classes_res = client.get("/api/v1/school/classes", headers=p_headers)
        assert classes_res.status_code == 200
        c_list = classes_res.json()
        assert len(c_list) == 3
        assert c_list[0]["name"] == "Class 1"
        assert len(c_list[0]["sections"]) == 2

        houses_res = client.get("/api/v1/school/houses", headers=p_headers)
        assert houses_res.status_code == 200
        h_list = houses_res.json()
        assert len(h_list) == 3
        assert set(h["name"] for h in h_list) == {"Red House", "Blue House", "Green House"}

        print("\nAll Backend Onboarding and Authentication Tests PASSED successfully!")

    finally:
        db.close()


def datetime_now_ts():
    import time
    return int(time.time() * 1000)


if __name__ == "__main__":
    test_complete_onboarding_and_auth_flow()
