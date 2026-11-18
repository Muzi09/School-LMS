import argparse
from getpass import getpass

from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlalchemy import select, text

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User
from app.models.enums import UserRole


class AdminIdentity(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    mobile: str = Field(pattern=r"^\+?[0-9]{8,18}$")


def prompt_password() -> str:
    password = getpass("New admin password: ")
    if password != getpass("Confirm password: "):
        raise ValueError("Passwords must match.")
    if len(password) < 12 or len(password.encode("utf-8")) > 72:
        raise ValueError("Use at least 12 characters and at most 72 UTF-8 bytes.")
    return password


def seed_admin(identity: AdminIdentity, password: str) -> None:
    with SessionLocal.begin() as db:
        db.execute(text("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE"))
        if db.scalar(select(User.id).where(User.role == UserRole.ADMIN, User.deleted_at.is_(None)).limit(1)):
            raise ValueError("A platform administrator already exists.")
        db.add(User(
            first_name=identity.first_name,
            last_name=identity.last_name,
            email=identity.email.lower(),
            login_mobile=identity.mobile,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
        ))


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first platform administrator.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    parser.add_argument("--mobile", required=True)
    args = parser.parse_args()
    try:
        identity = AdminIdentity.model_validate(vars(args))
        seed_admin(identity, prompt_password())
    except (ValidationError, ValueError) as exc:
        parser.exit(1, f"{exc}\n")
    print("Platform administrator created.")


if __name__ == "__main__":
    main()
