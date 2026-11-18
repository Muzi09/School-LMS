"""Erase one approved, soft-deleted student record from the primary database."""

import argparse
import re
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models.enums import UserRole
from app.models.student import StudentProfile
from app.models.student_record_event import StudentRecordEvent
from app.models.user import User


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("school_id", type=UUID)
    parser.add_argument("student_id", type=UUID)
    parser.add_argument("--approval-reference", required=True, help="Opaque approved privacy case ID")
    parser.add_argument("--deleted-before", type=datetime.fromisoformat, required=True)
    parser.add_argument("--apply", action="store_true", help="Irreversibly delete the record from the primary database")
    parser.add_argument("--confirm-no-hold", action="store_true", help="Confirm the approved case has no applicable hold")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", args.approval_reference):
        parser.error("Use an opaque approval reference of at most 100 characters.")
    if args.deleted_before.utcoffset() is None or args.deleted_before >= datetime.now(timezone.utc):
        parser.error("Supply a past cutoff with an explicit timezone.")
    if args.apply and not args.confirm_no_hold:
        parser.error("Confirm that the approved case has no applicable hold before applying it.")

    try:
        with SessionLocal.begin() as db:
            record = db.scalar(select(User).join(StudentProfile).where(
                StudentProfile.school_id == args.school_id,
                User.id == args.student_id,
                User.role == UserRole.STUDENT,
                User.is_active.is_(False),
                User.deleted_at < args.deleted_before,
            ).with_for_update(of=User))
            if record is None:
                raise SystemExit("No matching student meets the deletion cutoff.")
            if not args.apply:
                print("Dry run: the matching student is eligible under the supplied cutoff.")
                return

            db.add(StudentRecordEvent(
                school_id=args.school_id, student_id=args.student_id, action="erased",
                approval_reference=args.approval_reference,
            ))
            db.delete(record)
    except IntegrityError:
        raise SystemExit("Deletion rolled back because the record is still referenced. Review the approved case.") from None
    print("Student record erased from the primary database.")


if __name__ == "__main__":
    main()
