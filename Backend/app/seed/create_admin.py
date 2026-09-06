import sys
from sqlalchemy import func
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


def seed_admin():
    db = SessionLocal()
    try:
        email = settings.ADMIN_DEFAULT_EMAIL.strip().lower()
        existing = (
            db.query(User)
            .filter(
                func.lower(User.email) == email,
                User.deleted_at.is_(None),
            )
            .first()
        )

        if existing:
            # Ensure role and password are set to current defaults
            existing.role = UserRole.ADMIN
            existing.password_hash = hash_password(settings.ADMIN_DEFAULT_PASSWORD)
            db.commit()
            db.refresh(existing)
            print(f"[INFO] Admin account already exists and updated: {existing.email} (ID: {existing.id})")
            return existing

        admin = User(
            first_name=settings.ADMIN_DEFAULT_FIRST_NAME,
            last_name=settings.ADMIN_DEFAULT_LAST_NAME,
            email=email,
            login_mobile=settings.ADMIN_DEFAULT_MOBILE,
            password_hash=hash_password(settings.ADMIN_DEFAULT_PASSWORD),
            role=UserRole.ADMIN,
            is_active=True,
            school_setup_completed=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print("=" * 60)
        print("[SUCCESS] Admin account created successfully!")
        print(f"Email:    {admin.email}")
        print(f"Password: {settings.ADMIN_DEFAULT_PASSWORD}")
        print(f"User ID:  {admin.id}")
        print("=" * 60)
        return admin

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding Admin: {e}", file=sys.stderr)
        raise e
    finally:
        db.close()


# Backward compatibility alias
seed_super_admin = seed_admin

if __name__ == "__main__":
    seed_admin()
