from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
    ScheduleConflictException,
)
from app.models.enums import UserRole
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.subject import ClassSubject, Subject
from app.models.timetable import DayOfWeek, TimetableEntry, TimetablePeriod
from app.models.user import User
from app.schemas.timetable import (
    TimetableEntryCreate,
    TimetableEntryUpdate,
    TimetablePeriodCreate,
    TimetablePeriodUpdate,
)


def _parse_time(time_str: str) -> time:
    parts = [int(p) for p in time_str.strip().split(":")]
    return time(hour=parts[0], minute=parts[1], second=parts[2] if len(parts) == 3 else 0)


def _format_time(t: time) -> str:
    return t.strftime("%H:%M")


def _format_day_display(day_enum: str) -> str:
    return day_enum.capitalize()


class TimetableService:
    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # PERIOD MANAGEMENT
    # =========================================================================

    def list_periods(self, school_id: UUID) -> List[TimetablePeriod]:
        """List active periods for a school, sorted by period_number asc."""
        return (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.school_id == school_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc())
            .all()
        )

    def get_period(self, school_id: UUID, period_id: UUID) -> TimetablePeriod:
        """Get single period, ensuring school isolation."""
        period = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.id == period_id,
                TimetablePeriod.school_id == school_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .first()
        )
        if not period:
            raise NotFoundException("Period not found or has been removed.")
        return period

    def create_period(
        self,
        school_id: UUID,
        data: TimetablePeriodCreate,
        user_id: UUID,
    ) -> TimetablePeriod:
        """Create new period with uniqueness and overlap validation."""
        start = _parse_time(data.start_time)
        end = _parse_time(data.end_time)

        if start >= end:
            raise BadRequestException("Period start time must be earlier than end time.")

        # Check unique period_number
        existing_num = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.school_id == school_id,
                TimetablePeriod.period_number == data.period_number,
                TimetablePeriod.deleted_at.is_(None),
            )
            .first()
        )
        if existing_num:
            raise BadRequestException(f"Period number {data.period_number} already exists for this school.")

        # Check overlapping periods
        existing_periods = self.list_periods(school_id)
        for ep in existing_periods:
            if max(start, ep.start_time) < min(end, ep.end_time):
                raise BadRequestException(
                    f"Period timings ({_format_time(start)} - {_format_time(end)}) overlap with existing "
                    f"Period {ep.period_number} ({_format_time(ep.start_time)} - {_format_time(ep.end_time)})."
                )

        period = TimetablePeriod(
            school_id=school_id,
            period_number=data.period_number,
            start_time=start,
            end_time=end,
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(period)
        self.db.commit()
        self.db.refresh(period)
        return period

    def update_period(
        self,
        school_id: UUID,
        period_id: UUID,
        data: TimetablePeriodUpdate,
        user_id: UUID,
    ) -> TimetablePeriod:
        """Update existing period with validation."""
        period = self.get_period(school_id, period_id)

        target_period_number = data.period_number if data.period_number is not None else period.period_number
        target_start = _parse_time(data.start_time) if data.start_time else period.start_time
        target_end = _parse_time(data.end_time) if data.end_time else period.end_time

        if target_start >= target_end:
            raise BadRequestException("Period start time must be earlier than end time.")

        # Check uniqueness of period_number among other periods
        if target_period_number != period.period_number:
            existing_num = (
                self.db.query(TimetablePeriod)
                .filter(
                    TimetablePeriod.school_id == school_id,
                    TimetablePeriod.period_number == target_period_number,
                    TimetablePeriod.id != period.id,
                    TimetablePeriod.deleted_at.is_(None),
                )
                .first()
            )
            if existing_num:
                raise BadRequestException(f"Period number {target_period_number} is already in use by another period.")

        # Check overlap against other periods
        other_periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.school_id == school_id,
                TimetablePeriod.id != period.id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .all()
        )
        for ep in other_periods:
            if max(target_start, ep.start_time) < min(target_end, ep.end_time):
                raise BadRequestException(
                    f"Period timings ({_format_time(target_start)} - {_format_time(target_end)}) overlap with "
                    f"Period {ep.period_number} ({_format_time(ep.start_time)} - {_format_time(ep.end_time)})."
                )

        period.period_number = target_period_number
        period.start_time = target_start
        period.end_time = target_end
        period.updated_by = user_id
        period.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(period)
        return period

    def delete_period(self, school_id: UUID, period_id: UUID, user_id: UUID) -> None:
        """Soft delete period if not in use by timetable entries."""
        period = self.get_period(school_id, period_id)

        # Check active timetable entries referencing this period
        active_entries_count = (
            self.db.query(TimetableEntry)
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.period_id == period.id,
                TimetableEntry.deleted_at.is_(None),
            )
            .count()
        )
        if active_entries_count > 0:
            raise BadRequestException(
                f"Cannot delete Period {period.period_number} because it has {active_entries_count} active scheduled "
                f"entry/entries. Please delete or reassign them first."
            )

        now = datetime.now(timezone.utc)
        period.deleted_at = now
        period.deleted_by = user_id
        self.db.commit()

    # =========================================================================
    # ELIGIBLE TEACHERS & SECTION SUBJECTS
    # =========================================================================

    def list_eligible_teachers(self, school_id: UUID) -> List[Dict[str, Any]]:
        """List active teaching staff for the school."""
        users = (
            self.db.query(User)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .options(joinedload(User.staff_profile))
            .filter(
                StaffProfile.school_id == school_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                User.role == UserRole.STAFF,
            )
            .order_by(User.first_name.asc(), User.last_name.asc())
            .all()
        )

        teachers = []
        for u in users:
            sp = u.staff_profile
            teachers.append({
                "id": u.id,
                "name": f"{u.first_name} {u.last_name}".strip(),
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "roll_no": sp.roll_no if sp else None,
                "department": sp.department if sp else None,
                "designation": sp.designation if sp else None,
            })
        return teachers

    def list_section_subjects(self, school_id: UUID, section_id: UUID) -> List[Subject]:
        """
        List subjects assigned to this section via ClassSubject.
        Matches both section-specific subjects and class-wide shared subjects.
        """
        section = (
            self.db.query(Section)
            .filter(
                Section.id == section_id,
                Section.school_id == school_id,
                Section.deleted_at.is_(None),
            )
            .first()
        )
        if not section:
            raise NotFoundException("Section not found.")

        class_subjects = (
            self.db.query(ClassSubject)
            .options(
                joinedload(ClassSubject.subject).selectinload(Subject.child_subjects),
                joinedload(ClassSubject.subject).joinedload(Subject.parent),
            )
            .filter(
                ClassSubject.school_id == school_id,
                ClassSubject.class_id == section.class_id,
                ClassSubject.deleted_at.is_(None),
                or_(
                    ClassSubject.section_id == section.id,
                    ClassSubject.section_id.is_(None),
                ),
            )
            .all()
        )

        seen_subject_ids = set()
        subjects = []
        for cs in class_subjects:
            sub = cs.subject
            if not sub or sub.deleted_at is not None:
                continue
            if getattr(sub, "is_split", False) and getattr(sub, "child_subjects", None):
                for child in sub.child_subjects:
                    if child.deleted_at is None and child.id not in seen_subject_ids:
                        seen_subject_ids.add(child.id)
                        subjects.append(child)
            elif sub.id not in seen_subject_ids:
                seen_subject_ids.add(sub.id)
                subjects.append(sub)

        # Sort: academic first, then order_index, then name
        subjects.sort(key=lambda s: (0 if s.is_academic else 1, s.order_index, s.name.lower()))
        return subjects

    # =========================================================================
    # TIMETABLE GRID GET
    # =========================================================================

    def get_timetable_grid(self, school_id: UUID, section_id: UUID) -> Dict[str, Any]:
        """
        Fetch complete weekly timetable for a section including:
        - section metadata
        - all active school periods
        - all active timetable entries with joined subject & teacher info
        - available subjects for this section
        """
        section = (
            self.db.query(Section)
            .options(joinedload(Section.school_class))
            .filter(
                Section.id == section_id,
                Section.school_id == school_id,
                Section.deleted_at.is_(None),
            )
            .first()
        )
        if not section:
            raise NotFoundException("Section not found in this school.")

        periods = self.list_periods(school_id)
        subjects = self.list_section_subjects(school_id, section_id)

        entries = (
            self.db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject).joinedload(Subject.parent),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.section_id == section_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .all()
        )

        # Build response payload
        periods_data = [
            {
                "id": p.id,
                "school_id": p.school_id,
                "period_number": p.period_number,
                "start_time": _format_time(p.start_time),
                "end_time": _format_time(p.end_time),
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
            for p in periods
        ]

        # Fetch ClassSubjects for this section to include assigned teacher from Manage School
        class_subjects = (
            self.db.query(ClassSubject)
            .options(
                joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
            )
            .filter(
                ClassSubject.school_id == school_id,
                ClassSubject.class_id == section.class_id,
                ClassSubject.deleted_at.is_(None),
                or_(
                    ClassSubject.section_id == section.id,
                    ClassSubject.section_id.is_(None),
                ),
            )
            .all()
        )
        subject_teacher_map = {}
        for cs in class_subjects:
            if cs.section_id == section.id:
                subject_teacher_map[cs.subject_id] = cs.teacher
            elif cs.subject_id not in subject_teacher_map:
                subject_teacher_map[cs.subject_id] = cs.teacher

        subjects_data = []
        for s in subjects:
            tch = subject_teacher_map.get(s.id)
            sp = tch.staff_profile if tch else None
            subjects_data.append({
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "category": s.category,
                "is_academic": s.is_academic,
                "parent_id": getattr(s, "parent_id", None),
                "parent_name": s.parent.name if getattr(s, "parent", None) else None,
                "teacher_id": tch.id if tch else None,
                "teacher": {
                    "id": tch.id,
                    "name": f"{tch.first_name} {tch.last_name}".strip(),
                    "first_name": tch.first_name,
                    "last_name": tch.last_name,
                    "email": tch.email,
                    "roll_no": sp.roll_no if sp else None,
                    "department": sp.department if sp else None,
                    "designation": sp.designation if sp else None,
                } if tch else None,
            })

        entries_data = []
        for e in entries:
            t = e.teacher
            sp = t.staff_profile if t else None
            entries_data.append({
                "id": e.id,
                "school_id": e.school_id,
                "section_id": e.section_id,
                "period_id": e.period_id,
                "period_number": e.period.period_number if e.period else 0,
                "day_of_week": e.day_of_week,
                "subject": {
                    "id": e.subject.id,
                    "name": e.subject.name,
                    "code": e.subject.code,
                    "category": e.subject.category,
                    "is_academic": e.subject.is_academic,
                    "parent_id": getattr(e.subject, "parent_id", None),
                    "parent_name": e.subject.parent.name if getattr(e.subject, "parent", None) else None,
                } if e.subject else None,
                "teacher": {
                    "id": t.id,
                    "name": f"{t.first_name} {t.last_name}".strip() if t else "Unknown",
                    "first_name": t.first_name if t else "",
                    "last_name": t.last_name if t else "",
                    "email": t.email if t else None,
                    "roll_no": sp.roll_no if sp else None,
                    "department": sp.department if sp else None,
                    "designation": sp.designation if sp else None,
                } if t else None,
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            })

        class_name = section.school_class.name if section.school_class else ""

        return {
            "section": {
                "id": section.id,
                "class_id": section.class_id,
                "class_name": class_name,
                "section_name": section.name,
            },
            "periods": periods_data,
            "entries": entries_data,
            "subjects": subjects_data,
        }

    # =========================================================================
    # TIMETABLE ENTRY VALIDATION & CONFLICT DETECTION
    # =========================================================================

    def _validate_and_check_conflicts(
        self,
        school_id: UUID,
        section_id: UUID,
        subject_id: UUID,
        teacher_user_id: UUID,
        period_id: UUID,
        day_of_week: str,
        exclude_entry_id: Optional[UUID] = None,
    ) -> Tuple[Section, Subject, User, TimetablePeriod]:
        """
        Validate all relationships and check for schedule conflicts.
        Raises ScheduleConflictException with structured error on conflict.
        """
        day_val = day_of_week.strip().upper()
        valid_days = {d.value for d in DayOfWeek}
        if day_val not in valid_days:
            raise BadRequestException(f"Invalid day_of_week '{day_of_week}'. Must be one of: {sorted(valid_days)}")

        # 1. Section exists in this school
        section = (
            self.db.query(Section)
            .options(joinedload(Section.school_class))
            .filter(
                Section.id == section_id,
                Section.school_id == school_id,
                Section.deleted_at.is_(None),
            )
            .first()
        )
        if not section:
            raise NotFoundException("Section not found in this school.")

        # 2. Period exists in this school
        period = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.id == period_id,
                TimetablePeriod.school_id == school_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .first()
        )
        if not period:
            raise NotFoundException("Period not found in this school.")

        # 3. Subject exists in this school
        subject = (
            self.db.query(Subject)
            .filter(
                Subject.id == subject_id,
                Subject.school_id == school_id,
                Subject.deleted_at.is_(None),
            )
            .first()
        )
        if not subject:
            raise NotFoundException("Subject not found in this school.")

        # 4. Teacher exists in this school and is active teaching staff (if assigned)
        teacher = None
        if teacher_user_id:
            teacher = (
                self.db.query(User)
                .join(StaffProfile, StaffProfile.user_id == User.id)
                .options(joinedload(User.staff_profile))
                .filter(
                    User.id == teacher_user_id,
                    StaffProfile.school_id == school_id,
                    User.is_active.is_(True),
                    User.deleted_at.is_(None),
                    User.role == UserRole.STAFF,
                )
                .first()
            )
            if not teacher:
                raise BadRequestException("Selected teacher is not an active teaching staff member of this school.")

        # 5. Subject assigned to section via ClassSubject
        is_assigned = (
            self.db.query(ClassSubject)
            .filter(
                ClassSubject.school_id == school_id,
                ClassSubject.class_id == section.class_id,
                ClassSubject.subject_id == subject_id,
                ClassSubject.deleted_at.is_(None),
                or_(
                    ClassSubject.section_id == section_id,
                    ClassSubject.section_id.is_(None),
                ),
            )
            .first()
        )
        if not is_assigned:
            class_name = section.school_class.name if section.school_class else ""
            raise BadRequestException(
                f"Subject '{subject.name}' is not assigned to Class {class_name} Section {section.name}."
            )

        class_name = section.school_class.name if section.school_class else ""
        section_name = section.name
        teacher_name = f"{teacher.first_name} {teacher.last_name}".strip() if teacher else "Unassigned"
        day_display = _format_day_display(day_val)

        # 6. Check Section Conflict:
        # A section cannot have two entries at the same period + day
        section_conflict_query = (
            self.db.query(TimetableEntry)
            .options(joinedload(TimetableEntry.subject))
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.section_id == section_id,
                TimetableEntry.day_of_week == day_val,
                TimetableEntry.period_id == period_id,
                TimetableEntry.deleted_at.is_(None),
            )
        )
        if exclude_entry_id:
            section_conflict_query = section_conflict_query.filter(TimetableEntry.id != exclude_entry_id)

        sec_conflict = section_conflict_query.first()
        if sec_conflict:
            existing_sub = sec_conflict.subject.name if sec_conflict.subject else "another subject"
            raise ScheduleConflictException(
                code="SECTION_SCHEDULE_CONFLICT",
                message=f"Class {class_name}-{section_name} already has {existing_sub} scheduled during {day_display} Period {period.period_number}.",
                details={
                    "class_name": class_name,
                    "section_name": section_name,
                    "subject_name": existing_sub,
                    "day": day_val,
                    "period": period.period_number,
                    "existing_entry_id": str(sec_conflict.id),
                },
            )

        # 7. Check Teacher Conflict (only if a teacher is assigned):
        # A teacher cannot teach two sections during the same period + day
        if teacher_user_id:
            teacher_conflict_query = (
                self.db.query(TimetableEntry)
                .options(
                    joinedload(TimetableEntry.section).joinedload(Section.school_class),
                    joinedload(TimetableEntry.subject),
                )
                .filter(
                    TimetableEntry.school_id == school_id,
                    TimetableEntry.teacher_user_id == teacher_user_id,
                    TimetableEntry.day_of_week == day_val,
                    TimetableEntry.period_id == period_id,
                    TimetableEntry.deleted_at.is_(None),
                )
            )
            if exclude_entry_id:
                teacher_conflict_query = teacher_conflict_query.filter(TimetableEntry.id != exclude_entry_id)

            tch_conflict = teacher_conflict_query.first()
            if tch_conflict:
                conf_sec = tch_conflict.section
                conf_class_name = conf_sec.school_class.name if conf_sec and conf_sec.school_class else ""
                conf_sec_name = conf_sec.name if conf_sec else ""
                conf_sub_name = tch_conflict.subject.name if tch_conflict.subject else "a class"

                raise ScheduleConflictException(
                    code="TEACHER_SCHEDULE_CONFLICT",
                    message=f"{teacher_name} is already assigned to Class {conf_class_name}-{conf_sec_name} ({conf_sub_name}) during {day_display} Period {period.period_number}.",
                    details={
                        "teacher_name": teacher_name,
                        "class_name": conf_class_name,
                        "section_name": conf_sec_name,
                        "day": day_val,
                        "period": period.period_number,
                        "subject_name": conf_sub_name,
                        "existing_entry_id": str(tch_conflict.id),
                    },
                )

        return section, subject, teacher, period

    # =========================================================================
    # TIMETABLE ENTRY CRUD
    # =========================================================================

    def create_entry(
        self,
        school_id: UUID,
        data: TimetableEntryCreate,
        user_id: UUID,
    ) -> TimetableEntry:
        """Create new timetable entry after validation and conflict checks, or overwrite if requested."""
        # Auto-resolve teacher from ClassSubject if not explicitly provided
        if not data.teacher_user_id:
            sec = self.db.query(Section).filter(Section.id == data.section_id, Section.school_id == school_id).first()
            if sec:
                cs = (
                    self.db.query(ClassSubject)
                    .filter(
                        ClassSubject.school_id == school_id,
                        ClassSubject.class_id == sec.class_id,
                        ClassSubject.subject_id == data.subject_id,
                        ClassSubject.deleted_at.is_(None),
                        or_(
                            ClassSubject.section_id == data.section_id,
                            ClassSubject.section_id.is_(None),
                        ),
                    )
                    .order_by(ClassSubject.section_id.desc().nullslast())
                    .first()
                )
                if cs and cs.teacher_id:
                    data.teacher_user_id = cs.teacher_id

        existing_slot = (
            self.db.query(TimetableEntry)
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.section_id == data.section_id,
                TimetableEntry.day_of_week == data.day_of_week.value,
                TimetableEntry.period_id == data.period_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .first()
        )

        if existing_slot and getattr(data, "overwrite", False):
            # Validate excluding the current slot to allow overwrite
            self._validate_and_check_conflicts(
                school_id=school_id,
                section_id=data.section_id,
                subject_id=data.subject_id,
                teacher_user_id=data.teacher_user_id,
                period_id=data.period_id,
                day_of_week=data.day_of_week.value,
                exclude_entry_id=existing_slot.id,
            )
            existing_slot.subject_id = data.subject_id
            existing_slot.teacher_user_id = data.teacher_user_id
            existing_slot.updated_by = user_id
            existing_slot.updated_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(existing_slot)
            return existing_slot

        self._validate_and_check_conflicts(
            school_id=school_id,
            section_id=data.section_id,
            subject_id=data.subject_id,
            teacher_user_id=data.teacher_user_id,
            period_id=data.period_id,
            day_of_week=data.day_of_week.value,
        )

        entry = TimetableEntry(
            school_id=school_id,
            section_id=data.section_id,
            subject_id=data.subject_id,
            teacher_user_id=data.teacher_user_id,
            period_id=data.period_id,
            day_of_week=data.day_of_week.value,
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def update_entry(
        self,
        school_id: UUID,
        entry_id: UUID,
        data: TimetableEntryUpdate,
        user_id: UUID,
    ) -> TimetableEntry:
        """Update existing timetable entry."""
        entry = (
            self.db.query(TimetableEntry)
            .filter(
                TimetableEntry.id == entry_id,
                TimetableEntry.school_id == school_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .first()
        )
        if not entry:
            raise NotFoundException("Timetable entry not found.")

        target_subject_id = data.subject_id if data.subject_id is not None else entry.subject_id
        target_teacher_id = data.teacher_user_id
        if target_teacher_id is None:
            if data.subject_id is not None:
                sec = entry.section or self.db.query(Section).filter(Section.id == entry.section_id, Section.school_id == school_id).first()
                if sec:
                    cs = (
                        self.db.query(ClassSubject)
                        .filter(
                            ClassSubject.school_id == school_id,
                            ClassSubject.class_id == sec.class_id,
                            ClassSubject.subject_id == target_subject_id,
                            ClassSubject.deleted_at.is_(None),
                            or_(
                                ClassSubject.section_id == entry.section_id,
                                ClassSubject.section_id.is_(None),
                            ),
                        )
                        .order_by(ClassSubject.section_id.desc().nullslast())
                        .first()
                    )
                    target_teacher_id = cs.teacher_id if cs else None
            else:
                target_teacher_id = entry.teacher_user_id

        target_period_id = data.period_id if data.period_id is not None else entry.period_id
        target_day = data.day_of_week.value if data.day_of_week is not None else entry.day_of_week

        self._validate_and_check_conflicts(
            school_id=school_id,
            section_id=entry.section_id,
            subject_id=target_subject_id,
            teacher_user_id=target_teacher_id,
            period_id=target_period_id,
            day_of_week=target_day,
            exclude_entry_id=entry.id,
        )

        entry.subject_id = target_subject_id
        entry.teacher_user_id = target_teacher_id
        entry.period_id = target_period_id
        entry.day_of_week = target_day
        entry.updated_by = user_id
        entry.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete_entry(self, school_id: UUID, entry_id: UUID, user_id: UUID) -> None:
        """Soft delete timetable entry."""
        entry = (
            self.db.query(TimetableEntry)
            .filter(
                TimetableEntry.id == entry_id,
                TimetableEntry.school_id == school_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .first()
        )
        if not entry:
            raise NotFoundException("Timetable entry not found.")

        now = datetime.now(timezone.utc)
        entry.deleted_at = now
        entry.deleted_by = user_id
        self.db.commit()
