import sys
from sqlalchemy import func
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


def seed_super_admin():
    db = SessionLocal()
    try:
        email = settings.SUPER_ADMIN_DEFAULT_EMAIL.strip().lower()
        existing = (
            db.query(User)
            .filter(
                func.lower(User.email) == email,
                User.deleted_at.is_(None),
            )
            .first()
        )

        if existing:
            print(f"[INFO] Super Admin account already exists: {existing.email} (ID: {existing.id})")
            return existing

        super_admin = User(
            first_name=settings.SUPER_ADMIN_DEFAULT_FIRST_NAME,
            last_name=settings.SUPER_ADMIN_DEFAULT_LAST_NAME,
            email=email,
            login_mobile=settings.SUPER_ADMIN_DEFAULT_MOBILE,
            password_hash=hash_password(settings.SUPER_ADMIN_DEFAULT_PASSWORD),
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            school_setup_completed=True,
        )

        db.add(super_admin)
        db.commit()
        db.refresh(super_admin)

        print("=" * 60)
        print("[SUCCESS] Super Admin account created successfully!")
        print(f"Email:    {super_admin.email}")
        print(f"Password: {settings.SUPER_ADMIN_DEFAULT_PASSWORD}")
        print(f"User ID:  {super_admin.id}")
        print("=" * 60)
        return super_admin

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding Super Admin: {e}", file=sys.stderr)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_super_admin()
