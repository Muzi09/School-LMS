import argparse

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User
from app.models.enums import UserRole
from app.seed.create_admin import prompt_password


def rotate_admin_password(email: str, password: str) -> None:
    with SessionLocal.begin() as db:
        admin = db.scalar(select(User).where(
            func.lower(User.email) == email.strip().lower(),
            User.role == UserRole.ADMIN,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        ).with_for_update())
        if admin is None:
            raise ValueError("No active administrator was found for that email.")
        admin.password_hash = hash_password(password)


def main() -> None:
    parser = argparse.ArgumentParser(description="Rotate the password of an existing platform administrator.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    try:
        rotate_admin_password(args.email, prompt_password())
    except ValueError as exc:
        parser.exit(1, f"{exc}\n")
    print("Administrator password rotated.")


if __name__ == "__main__":
    main()
