import os
import time

# We will test schema and endpoint logic directly via python or test script
from app.core.database import SessionLocal
from app.core.security import hash_token
from app.models.enums import UserRole
from app.models.onboarding_token import PrincipalOnboardingToken
from app.models.user import User
from app.models.school import School
from app.models.subject import Subject, ClassSubject
from app.models.wing import Wing, WingClass
from app.models.house import House
from app.schemas.onboarding import SchoolSetupRequest, ClassSectionItem, HouseItem, SubjectItem, WingItem
from app.api.v1.endpoints.onboarding import complete_school_setup
from datetime import datetime, timezone, timedelta
import uuid

def test_full_onboarding_with_subjects_and_wings():
    db = SessionLocal()
    try:
        # Create test principal
        ts = int(time.time())
        p_email = f"principal_test_{ts}@school.com"
        user = User(
            first_name="Test",
            last_name="Principal",
            email=p_email,
            login_mobile=f"98765{ts % 100000:05d}",
            role=UserRole.PRINCIPAL,
            is_active=True,
            school_setup_completed=False,
        )
        db.add(user)
        db.flush()

        raw_token = f"tok_{uuid.uuid4().hex}"
        token_rec = PrincipalOnboardingToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(token_rec)
        db.commit()

        # Build payload with classes, sections, subjects, wings, houses with emblem
        payload = SchoolSetupRequest(
            token=raw_token,
            school_name="Apex Global Academy",
            school_code=f"APX{ts % 10000:04d}",
            school_email=p_email,
            school_phone="9876543210",
            address="123 Knowledge Park, Delhi, PIN - 110001",
            primary_color="#2563EB",
            emblem_url="/uploads/emblems/apex.png",
            classes=[
                ClassSectionItem(name="Nursery", order_index=1, sections=["A", "B"]),
                ClassSectionItem(name="LKG", order_index=2, sections=["A", "B"]),
                ClassSectionItem(name="UKG", order_index=3, sections=["A", "B"]),
                ClassSectionItem(name="Class 1", order_index=4, sections=["A", "B", "C"]),
                ClassSectionItem(name="Class 2", order_index=5, sections=["A", "B"]),
            ],
            subjects=[
                SubjectItem(name="English", order_index=1, assigned_classes=["Nursery", "LKG", "UKG", "Class 1", "Class 2"]),
                SubjectItem(name="Mathematics", order_index=2, assigned_classes=["Class 1", "Class 2"]),
                SubjectItem(name="General Science", order_index=3, assigned_classes=["Class 1", "Class 2"]),
            ],
            wings=[
                WingItem(name="Early Childhood", order_index=1, classes=["Nursery", "LKG", "UKG"]),
                WingItem(name="Primary Wing", order_index=2, classes=["Class 1", "Class 2"]),
            ],
            houses=[
                HouseItem(name="Phoenix", color="#EF4444", emblem_url="/uploads/emblems/phoenix.png"),
                HouseItem(name="Hydra", color="#3B82F6", emblem_url="/uploads/emblems/hydra.png"),
            ],
            password="SecurePassword123!",
            confirm_password="SecurePassword123!",
            pin="1234",
            confirm_pin="1234",
        )

        res = complete_school_setup(payload, db)
        assert res.success is True
        print(f"School setup completed with ID: {res.school_id}")

        # Verify in DB
        school = db.query(School).filter(School.id == res.school_id).first()
        assert school is not None
        assert len(school.classes) == 5
        assert len(school.subjects) == 3
        assert len(school.wings) == 2
        assert len(school.houses) == 2
        assert school.houses[0].emblem_url is not None

        # Verify ClassSubject mappings
        cs_count = db.query(ClassSubject).filter(ClassSubject.school_id == school.id).count()
        assert cs_count == 5 + 2 + 2 # 9 total mappings
        print(f"Verified {cs_count} ClassSubject mappings.")

        # Verify WingClass mappings
        wc_count = db.query(WingClass).filter(WingClass.school_id == school.id).count()
        assert wc_count == 3 + 2 # 5 total mappings
        print(f"Verified {wc_count} WingClass mappings.")

        print("All Subject, Wing, and House Emblem Tests PASSED!")
    finally:
        db.close()

if __name__ == "__main__":
    test_full_onboarding_with_subjects_and_wings()
