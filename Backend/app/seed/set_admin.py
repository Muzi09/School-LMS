import sys
from sqlalchemy import func
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


def set_custom_admin(email: str, password: str, first_name: str = "Mubashir", last_name: str = "Khan", mobile: str = "8234971938"):
    db = SessionLocal()
    try:
        clean_email = email.strip().lower()

        # 1. Remove old demo admin account(s) if they exist
        old_admins = db.query(User).filter(
            func.lower(User.email).in_(["admin@platform.com", "amzikhan711@gmail.com"]),
            User.deleted_at.is_(None)
        ).all()
        for old in old_admins:
            db.delete(old)
            print(f"[CLEANUP] Removed old demo admin account: {old.email}")

        # 2. Check if new admin email already exists
        user = db.query(User).filter(
            func.lower(User.email) == clean_email
        ).first()

        if user:
            user.role = UserRole.ADMIN
            user.password_hash = hash_password(password)
            user.is_active = True
            user.deleted_at = None
            db.commit()
            db.refresh(user)
            print(f"[SUCCESS] Updated existing account to Super Admin: {user.email}")
        else:
            user = User(
                first_name=first_name,
                last_name=last_name,
                email=clean_email,
                login_mobile=mobile,
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[SUCCESS] Created new Super Admin account: {user.email}")

        print("=" * 60)
        print(f"Super Admin Email:    {user.email}")
        print(f"Super Admin Status:   Active")
        print(f"Role:                 {user.role.name if hasattr(user.role, 'name') else user.role}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to set admin: {e}", file=sys.stderr)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "mubashirkhan711@gmail.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "Fnrpk9274@d"
    set_custom_admin(email=email, password=password)
