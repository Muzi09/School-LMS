import json
import uuid
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
from app.models.timetable import (
    DayOfWeek,
    Timetable,
    TimetableEntry,
    TimetablePeriod,
    TimetableSetup,
    TimetableSetupAssignment,
)
from app.models.user import User
from app.models.wing import Wing, WingClass
from app.schemas.timetable import (
    BatchSetupAssignmentsRequest,
    BulkSlotAssignRequest,
    ConflictCheckRequest,
    TimetableCreate,
    TimetableEntryCreate,
    TimetableEntryUpdate,
    TimetablePeriodCreate,
    TimetablePeriodUpdate,
    TimetableSetupCreate,
    TimetableSetupUpdate,
    TimetableUpdate,
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
    # TIMETABLE MANAGEMENT (Multi-Timetable, Active Switch, Duplication)
    # =========================================================================

    def _ensure_default_timetable_exists(self, school_id: UUID, user_id: Optional[UUID] = None) -> Timetable:
        """Ensure at least one active timetable with a default setup exists for this school."""
        active_tt = (
            self.db.query(Timetable)
            .filter(
                Timetable.school_id == school_id,
                Timetable.is_active == True,
                Timetable.deleted_at.is_(None),
            )
            .first()
        )
        if active_tt:
            # Ensure it has at least one setup
            setup_count = (
                self.db.query(TimetableSetup)
                .filter(TimetableSetup.timetable_id == active_tt.id, TimetableSetup.deleted_at.is_(None))
                .count()
            )
            if setup_count == 0:
                self._create_default_setup_for_tt(school_id, active_tt.id, user_id)
            return active_tt

        first_tt = (
            self.db.query(Timetable)
            .filter(
                Timetable.school_id == school_id,
                Timetable.deleted_at.is_(None),
            )
            .order_by(Timetable.created_at.desc())
            .first()
        )
        if first_tt:
            first_tt.is_active = True
            self.db.commit()
            self.db.refresh(first_tt)
            return first_tt

        # Create new default timetable
        now = datetime.now(timezone.utc)
        new_tt = Timetable(
            school_id=school_id,
            name="Main Academic Timetable 2026–27",
            description="Default school academic schedule",
            academic_year="2026-27",
            is_active=True,
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(new_tt)
        self.db.flush()

        self._create_default_setup_for_tt(school_id, new_tt.id, user_id)

        self.db.commit()
        self.db.refresh(new_tt)
        return new_tt

    def _create_default_setup_for_tt(self, school_id: UUID, timetable_id: UUID, user_id: Optional[UUID] = None) -> TimetableSetup:
        setup = TimetableSetup(
            school_id=school_id,
            timetable_id=timetable_id,
            name="Setup 1",
            description="Regular Bell Schedule",
            is_default=True,
            applicable_days=json.dumps(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]),
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(setup)
        self.db.flush()

        default_period_specs = [
            (1, "08:30", "09:15", False, "Period 1"),
            (2, "09:15", "10:00", False, "Period 2"),
            (3, "10:00", "10:45", False, "Period 3"),
            (4, "10:45", "11:30", False, "Period 4"),
            (5, "11:30", "11:45", True, "RECESS"),
            (6, "11:45", "12:30", False, "Period 5"),
            (7, "12:30", "13:15", False, "Period 6"),
            (8, "13:15", "14:00", False, "Period 7"),
            (9, "14:00", "14:45", False, "Period 8"),
        ]
        for pnum, st, et, is_brk, lbl in default_period_specs:
            p = TimetablePeriod(
                school_id=school_id,
                timetable_id=timetable_id,
                setup_id=setup.id,
                period_number=pnum,
                start_time=_parse_time(st),
                end_time=_parse_time(et),
                is_break=is_brk,
                label=lbl,
                created_by=user_id,
                updated_by=user_id,
            )
            self.db.add(p)

        self.db.commit()
        self.db.refresh(setup)
        return setup

    def list_timetables(self, school_id: UUID) -> List[Timetable]:
        self._ensure_default_timetable_exists(school_id)
        return (
            self.db.query(Timetable)
            .filter(
                Timetable.school_id == school_id,
                Timetable.deleted_at.is_(None),
            )
            .order_by(Timetable.is_active.desc(), Timetable.created_at.desc())
            .all()
        )

    def get_active_timetable(self, school_id: UUID) -> Timetable:
        return self._ensure_default_timetable_exists(school_id)

    def get_timetable_by_id(self, school_id: UUID, timetable_id: UUID) -> Timetable:
        tt = (
            self.db.query(Timetable)
            .filter(
                Timetable.id == timetable_id,
                Timetable.school_id == school_id,
                Timetable.deleted_at.is_(None),
            )
            .first()
        )
        if not tt:
            raise NotFoundException("Timetable not found.")
        return tt

    def create_timetable(self, school_id: UUID, data: TimetableCreate, user_id: UUID) -> Timetable:
        if data.is_active:
            self.db.query(Timetable).filter(
                Timetable.school_id == school_id,
                Timetable.deleted_at.is_(None),
            ).update({"is_active": False})

        new_tt = Timetable(
            school_id=school_id,
            name=data.name,
            description=data.description,
            academic_year=data.academic_year or "2026-27",
            is_active=bool(data.is_active),
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(new_tt)
        self.db.flush()

        source_tt_id = getattr(data, "source_timetable_id", None)
        start_opt = getattr(data, "start_option", "blank")

        if start_opt in ("duplicate", "copy_bell") and source_tt_id:
            src_setups = (
                self.db.query(TimetableSetup)
                .filter(
                    TimetableSetup.timetable_id == source_tt_id,
                    TimetableSetup.deleted_at.is_(None),
                )
                .all()
            )
            setup_id_map = {}
            period_id_map = {}
            for s in src_setups:
                cloned_s = TimetableSetup(
                    school_id=school_id,
                    timetable_id=new_tt.id,
                    name=s.name,
                    description=s.description,
                    is_default=s.is_default,
                    applicable_days=s.applicable_days,
                    created_by=user_id,
                    updated_by=user_id,
                )
                self.db.add(cloned_s)
                self.db.flush()
                setup_id_map[s.id] = cloned_s.id

                src_periods = (
                    self.db.query(TimetablePeriod)
                    .filter(
                        TimetablePeriod.setup_id == s.id,
                        TimetablePeriod.deleted_at.is_(None),
                    )
                    .order_by(TimetablePeriod.period_number)
                    .all()
                )
                for p in src_periods:
                    cloned_p = TimetablePeriod(
                        school_id=school_id,
                        timetable_id=new_tt.id,
                        setup_id=cloned_s.id,
                        period_number=p.period_number,
                        start_time=p.start_time,
                        end_time=p.end_time,
                        is_break=p.is_break,
                        label=p.label,
                        created_by=user_id,
                        updated_by=user_id,
                    )
                    self.db.add(cloned_p)
                    self.db.flush()
                    period_id_map[p.id] = cloned_p.id

            src_assignments = (
                self.db.query(TimetableSetupAssignment)
                .filter(
                    TimetableSetupAssignment.timetable_id == source_tt_id,
                    TimetableSetupAssignment.deleted_at.is_(None),
                )
                .all()
            )
            for a in src_assignments:
                target_setup_id = setup_id_map.get(a.setup_id)
                if target_setup_id:
                    cloned_a = TimetableSetupAssignment(
                        school_id=school_id,
                        timetable_id=new_tt.id,
                        setup_id=target_setup_id,
                        target_type=a.target_type,
                        target_id=a.target_id,
                        created_by=user_id,
                        updated_by=user_id,
                    )
                    self.db.add(cloned_a)

            if start_opt == "duplicate":
                src_entries = (
                    self.db.query(TimetableEntry)
                    .filter(
                        TimetableEntry.timetable_id == source_tt_id,
                        TimetableEntry.deleted_at.is_(None),
                    )
                    .all()
                )
                for e in src_entries:
                    new_pid = period_id_map.get(e.period_id)
                    if new_pid:
                        cloned_e = TimetableEntry(
                            school_id=school_id,
                            timetable_id=new_tt.id,
                            section_id=e.section_id,
                            subject_id=e.subject_id,
                            teacher_user_id=e.teacher_user_id,
                            period_id=new_pid,
                            day_of_week=e.day_of_week,
                            created_by=user_id,
                            updated_by=user_id,
                        )
                        self.db.add(cloned_e)
        else:
            self._create_default_setup_for_tt(school_id, new_tt.id, user_id)

        self.db.commit()
        self.db.refresh(new_tt)
        return new_tt

    def update_timetable(self, school_id: UUID, timetable_id: UUID, data: TimetableUpdate, user_id: UUID) -> Timetable:
        tt = self.get_timetable_by_id(school_id, timetable_id)
        if data.name is not None:
            tt.name = data.name
        if data.description is not None:
            tt.description = data.description
        if data.academic_year is not None:
            tt.academic_year = data.academic_year
        if data.is_active is not None and data.is_active != tt.is_active:
            if data.is_active:
                self.db.query(Timetable).filter(
                    Timetable.school_id == school_id,
                    Timetable.id != timetable_id,
                    Timetable.deleted_at.is_(None),
                ).update({"is_active": False})
                tt.is_active = True
            else:
                tt.is_active = False

        tt.updated_by = user_id
        tt.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(tt)
        return tt

    def activate_timetable(self, school_id: UUID, timetable_id: UUID, user_id: UUID) -> Timetable:
        tt = self.get_timetable_by_id(school_id, timetable_id)
        self.db.query(Timetable).filter(
            Timetable.school_id == school_id,
            Timetable.id != timetable_id,
            Timetable.deleted_at.is_(None),
        ).update({"is_active": False})
        tt.is_active = True
        tt.updated_by = user_id
        tt.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(tt)
        return tt

    def duplicate_timetable(self, school_id: UUID, timetable_id: UUID, user_id: UUID, new_name: Optional[str] = None) -> Timetable:
        src = self.get_timetable_by_id(school_id, timetable_id)
        clone_data = TimetableCreate(
            name=new_name or f"Copy of {src.name}",
            description=src.description,
            academic_year=src.academic_year,
            is_active=False,
            start_option="duplicate",
            source_timetable_id=src.id,
        )
        return self.create_timetable(school_id, clone_data, user_id)

    def delete_timetable(self, school_id: UUID, timetable_id: UUID, user_id: UUID) -> None:
        tt = self.get_timetable_by_id(school_id, timetable_id)
        total_tt = self.db.query(Timetable).filter(
            Timetable.school_id == school_id,
            Timetable.deleted_at.is_(None),
        ).count()
        if total_tt <= 1:
            raise BadRequestException("Cannot delete the only remaining timetable for this school.")

        now = datetime.now(timezone.utc)
        tt.deleted_at = now
        tt.deleted_by = user_id
        if tt.is_active:
            tt.is_active = False
            other_tt = self.db.query(Timetable).filter(
                Timetable.school_id == school_id,
                Timetable.id != timetable_id,
                Timetable.deleted_at.is_(None),
            ).order_by(Timetable.created_at.desc()).first()
            if other_tt:
                other_tt.is_active = True

        self.db.commit()

    # =========================================================================
    # BELL SCHEDULE SETUPS & APPLICABILITY
    # =========================================================================

    def list_setups(self, school_id: UUID, timetable_id: UUID) -> List[Dict[str, Any]]:
        self.get_timetable_by_id(school_id, timetable_id)
        setups = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.timetable_id == timetable_id,
                TimetableSetup.deleted_at.is_(None),
            )
            .order_by(TimetableSetup.is_default.desc(), TimetableSetup.created_at.asc())
            .all()
        )
        if not setups:
            self._create_default_setup_for_tt(school_id, timetable_id)
            setups = (
                self.db.query(TimetableSetup)
                .filter(
                    TimetableSetup.timetable_id == timetable_id,
                    TimetableSetup.deleted_at.is_(None),
                )
                .order_by(TimetableSetup.is_default.desc(), TimetableSetup.created_at.asc())
                .all()
            )

        assignments = (
            self.db.query(TimetableSetupAssignment)
            .filter(
                TimetableSetupAssignment.timetable_id == timetable_id,
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            .all()
        )
        all_sections = (
            self.db.query(Section)
            .join(SchoolClass, SchoolClass.id == Section.class_id)
            .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
            .all()
        )
        wing_classes = (
            self.db.query(WingClass)
            .filter(WingClass.school_id == school_id, WingClass.deleted_at.is_(None))
            .all()
        )
        class_to_wing = {wc.class_id: wc.wing_id for wc in wing_classes}

        sec_to_setup: Dict[UUID, UUID] = {}
        for a in assignments:
            if a.target_type == "SECTION":
                sec_to_setup[a.target_id] = a.setup_id
            elif a.target_type == "CLASS":
                for s in all_sections:
                    if s.class_id == a.target_id and s.id not in sec_to_setup:
                        sec_to_setup[s.id] = a.setup_id
            elif a.target_type == "WING":
                for s in all_sections:
                    w_id = class_to_wing.get(s.class_id)
                    if w_id == a.target_id and s.id not in sec_to_setup:
                        sec_to_setup[s.id] = a.setup_id

        default_setup = next((s for s in setups if s.is_default), setups[0] if setups else None)
        default_setup_id = default_setup.id if default_setup else None

        result = []
        for s in setups:
            periods = (
                self.db.query(TimetablePeriod)
                .filter(
                    TimetablePeriod.setup_id == s.id,
                    TimetablePeriod.deleted_at.is_(None),
                )
                .order_by(TimetablePeriod.period_number.asc())
                .all()
            )
            applicable_days = []
            if s.applicable_days:
                try:
                    applicable_days = json.loads(s.applicable_days)
                except Exception:
                    applicable_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

            assigned_sec_ids = [
                sec.id
                for sec in all_sections
                if sec_to_setup.get(sec.id, default_setup_id) == s.id
            ]

            schedules = [
                {
                    "id": "regular",
                    "days": [d for d in applicable_days if d != "SATURDAY"],
                    "periods": [
                        {
                            "id": str(p.id),
                            "period_number": p.period_number,
                            "start_time": _format_time(p.start_time),
                            "end_time": _format_time(p.end_time),
                            "is_break": p.is_break,
                            "label": p.label or ("RECESS" if p.is_break else f"Period {p.period_number}"),
                        }
                        for p in periods
                    ],
                }
            ]
            if "SATURDAY" in applicable_days:
                schedules.append({
                    "id": "saturday",
                    "days": ["SATURDAY"],
                    "periods": [
                        {
                            "id": str(p.id),
                            "period_number": p.period_number,
                            "start_time": _format_time(p.start_time),
                            "end_time": _format_time(p.end_time),
                            "is_break": p.is_break,
                            "label": p.label or ("RECESS" if p.is_break else f"Period {p.period_number}"),
                        }
                        for p in periods
                    ],
                })

            result.append({
                "id": s.id,
                "school_id": s.school_id,
                "timetable_id": s.timetable_id,
                "name": s.name,
                "description": s.description,
                "is_default": s.is_default,
                "applicable_days": applicable_days,
                "periods": [
                    {
                        "id": p.id,
                        "school_id": p.school_id,
                        "timetable_id": p.timetable_id,
                        "setup_id": p.setup_id,
                        "period_number": p.period_number,
                        "start_time": _format_time(p.start_time),
                        "end_time": _format_time(p.end_time),
                        "is_break": p.is_break,
                        "label": p.label or ("RECESS" if p.is_break else f"Period {p.period_number}"),
                        "created_at": p.created_at,
                        "updated_at": p.updated_at,
                    }
                    for p in periods
                ],
                "schedules": schedules,
                "assigned_classes_count": len(assigned_sec_ids),
                "assigned_section_ids": assigned_sec_ids,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            })
        return result

    def create_setup(self, school_id: UUID, data: TimetableSetupCreate, user_id: UUID) -> TimetableSetup:
        self.get_timetable_by_id(school_id, data.timetable_id)
        app_days = data.applicable_days or ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        setup = TimetableSetup(
            school_id=school_id,
            timetable_id=data.timetable_id,
            name=data.name,
            description=data.description,
            is_default=data.is_default,
            applicable_days=json.dumps(app_days),
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(setup)
        self.db.flush()

        if data.periods:
            for p_item in data.periods:
                p = TimetablePeriod(
                    school_id=school_id,
                    timetable_id=data.timetable_id,
                    setup_id=setup.id,
                    period_number=p_item.period_number,
                    start_time=_parse_time(p_item.start_time),
                    end_time=_parse_time(p_item.end_time),
                    is_break=p_item.is_break,
                    label=p_item.label,
                    created_by=user_id,
                    updated_by=user_id,
                )
                self.db.add(p)

        self.db.commit()
        self.db.refresh(setup)
        return setup

    def update_setup(self, school_id: UUID, setup_id: UUID, data: TimetableSetupUpdate, user_id: UUID) -> TimetableSetup:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .first()
        )
        if not s:
            raise NotFoundException("Setup not found.")

        if data.name is not None:
            s.name = data.name
        if data.description is not None:
            s.description = data.description
        if data.is_default is not None:
            s.is_default = data.is_default
        if data.applicable_days is not None:
            s.applicable_days = json.dumps(data.applicable_days)

        s.updated_by = user_id
        s.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(s)
        return s

    def duplicate_setup(self, school_id: UUID, setup_id: UUID, user_id: UUID) -> TimetableSetup:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .first()
        )
        if not s:
            raise NotFoundException("Setup not found.")

        dup = TimetableSetup(
            school_id=school_id,
            timetable_id=s.timetable_id,
            name=f"Copy of {s.name}",
            description=s.description,
            is_default=False,
            applicable_days=s.applicable_days,
            created_by=user_id,
            updated_by=user_id,
        )
        self.db.add(dup)
        self.db.flush()

        periods = (
            self.db.query(TimetablePeriod)
            .filter(TimetablePeriod.setup_id == s.id, TimetablePeriod.deleted_at.is_(None))
            .order_by(TimetablePeriod.period_number)
            .all()
        )
        for p in periods:
            cloned_p = TimetablePeriod(
                school_id=school_id,
                timetable_id=s.timetable_id,
                setup_id=dup.id,
                period_number=p.period_number,
                start_time=p.start_time,
                end_time=p.end_time,
                is_break=p.is_break,
                label=p.label,
                created_by=user_id,
                updated_by=user_id,
            )
            self.db.add(cloned_p)

        self.db.commit()
        self.db.refresh(dup)
        return dup

    def delete_setup(self, school_id: UUID, setup_id: UUID, user_id: UUID) -> None:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .first()
        )
        if not s:
            raise NotFoundException("Setup not found.")

        total_setups = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.timetable_id == s.timetable_id, TimetableSetup.deleted_at.is_(None))
            .count()
        )
        if total_setups <= 1:
            raise BadRequestException("Cannot delete the only setup. A timetable must have at least one bell setup.")

        now = datetime.now(timezone.utc)
        s.deleted_at = now
        s.deleted_by = user_id
        def_setup = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.timetable_id == s.timetable_id,
                TimetableSetup.id != s.id,
                TimetableSetup.deleted_at.is_(None),
            )
            .order_by(TimetableSetup.is_default.desc())
            .first()
        )
        if def_setup:
            self.db.query(TimetableSetupAssignment).filter(
                TimetableSetupAssignment.setup_id == s.id,
            ).update({"setup_id": def_setup.id})

        self.db.commit()

    def preview_setups_impact(
        self,
        school_id: UUID,
        timetable_id: UUID,
        data: BatchSetupAssignmentsRequest,
    ) -> Dict[str, Any]:
        """Detect any slot removals or changes that would impact existing assignments."""
        affected_entries = []
        for setup_dict in data.setups:
            s_id_str = setup_dict.get("id")
            if not s_id_str:
                continue
            try:
                s_id = UUID(str(s_id_str))
            except ValueError:
                continue

            existing_periods = (
                self.db.query(TimetablePeriod)
                .filter(TimetablePeriod.setup_id == s_id, TimetablePeriod.deleted_at.is_(None))
                .all()
            )
            new_period_nums = {p.get("period_number") for p in setup_dict.get("periods", [])}
            for ep in existing_periods:
                if ep.period_number not in new_period_nums:
                    entries = (
                        self.db.query(TimetableEntry)
                        .filter(TimetableEntry.period_id == ep.id, TimetableEntry.deleted_at.is_(None))
                        .all()
                    )
                    for e in entries:
                        affected_entries.append({
                            "entry_id": str(e.id),
                            "section_id": str(e.section_id),
                            "day": e.day_of_week,
                            "period_number": ep.period_number,
                            "subject": e.subject.name if e.subject else "",
                        })

        msg = f"{len(affected_entries)} assigned slot(s) will be affected." if affected_entries else "No assigned slots will be affected."
        return {
            "affected_slots_count": len(affected_entries),
            "affected_entries": affected_entries,
            "message": msg,
        }

    def batch_save_setups(
        self,
        school_id: UUID,
        timetable_id: UUID,
        data: BatchSetupAssignmentsRequest,
        user_id: UUID,
    ) -> List[Dict[str, Any]]:
        """
        Save multi-setup bell schedules and applicability tree assignments.
        Enforces zero orphan sections.
        """
        self.get_timetable_by_id(school_id, timetable_id)
        now = datetime.now(timezone.utc)

        setup_id_map = {}

        for idx, s_data in enumerate(data.setups):
            s_id_str = s_data.get("id")
            s_name = s_data.get("name") or f"Setup {idx + 1}"
            s_desc = s_data.get("description")
            is_def = bool(s_data.get("is_default", idx == 0))
            app_days = s_data.get("applicable_days") or ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
            app_days_json = json.dumps(app_days) if isinstance(app_days, list) else str(app_days)

            setup_obj = None
            if s_id_str:
                try:
                    s_id = UUID(str(s_id_str))
                    setup_obj = (
                        self.db.query(TimetableSetup)
                        .filter(TimetableSetup.id == s_id, TimetableSetup.timetable_id == timetable_id)
                        .first()
                    )
                except ValueError:
                    setup_obj = None

            if not setup_obj:
                setup_obj = TimetableSetup(
                    school_id=school_id,
                    timetable_id=timetable_id,
                    name=s_name,
                    description=s_desc,
                    is_default=is_def,
                    applicable_days=app_days_json,
                    created_by=user_id,
                    updated_by=user_id,
                )
                self.db.add(setup_obj)
                self.db.flush()
            else:
                setup_obj.name = s_name
                setup_obj.description = s_desc
                setup_obj.is_default = is_def
                setup_obj.applicable_days = app_days_json
                setup_obj.updated_by = user_id
                setup_obj.updated_at = now

            if s_id_str:
                setup_id_map[str(s_id_str)] = setup_obj.id
            setup_id_map[str(setup_obj.id)] = setup_obj.id

            periods_list = s_data.get("periods") or []
            existing_periods = (
                self.db.query(TimetablePeriod)
                .filter(TimetablePeriod.setup_id == setup_obj.id, TimetablePeriod.deleted_at.is_(None))
                .all()
            )
            existing_periods_map = {p.period_number: p for p in existing_periods}
            new_period_nums = set()

            for p_item in periods_list:
                p_num = int(p_item.get("period_number", 1))
                st = _parse_time(p_item.get("start_time", "08:30"))
                et = _parse_time(p_item.get("end_time", "09:15"))
                is_brk = bool(p_item.get("is_break", False))
                lbl = p_item.get("label") or ("RECESS" if is_brk else f"Period {p_num}")
                new_period_nums.add(p_num)

                if p_num in existing_periods_map:
                    ep = existing_periods_map[p_num]
                    ep.start_time = st
                    ep.end_time = et
                    ep.is_break = is_brk
                    ep.label = lbl
                    ep.updated_by = user_id
                    ep.updated_at = now
                else:
                    new_p = TimetablePeriod(
                        school_id=school_id,
                        timetable_id=timetable_id,
                        setup_id=setup_obj.id,
                        period_number=p_num,
                        start_time=st,
                        end_time=et,
                        is_break=is_brk,
                        label=lbl,
                        created_by=user_id,
                        updated_by=user_id,
                    )
                    self.db.add(new_p)

            for p_num, ep in existing_periods_map.items():
                if p_num not in new_period_nums:
                    ep.deleted_at = now
                    ep.deleted_by = user_id

        # Clear existing assignments for this timetable
        self.db.query(TimetableSetupAssignment).filter(
            TimetableSetupAssignment.timetable_id == timetable_id,
        ).delete()

        # Add new assignments
        for assign_item in data.assignments:
            raw_setup_id = str(assign_item.setup_id)
            target_setup_id = setup_id_map.get(raw_setup_id, assign_item.setup_id)
            tt_assign = TimetableSetupAssignment(
                school_id=school_id,
                timetable_id=timetable_id,
                setup_id=target_setup_id,
                target_type=assign_item.target_type,
                target_id=assign_item.target_id,
                created_by=user_id,
                updated_by=user_id,
            )
            self.db.add(tt_assign)

        self.db.commit()
        return self.list_setups(school_id, timetable_id)

    # =========================================================================
    # CLASS-WISE PERSPECTIVE & MASTER DATA
    # =========================================================================

    def get_class_wise_timetable(
        self,
        school_id: UUID,
        timetable_id: Optional[UUID] = None,
        wing_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Master Class-wise perspective view data:
        - Timetable & all available timetables
        - Wings with classes & sections (filtered if wing_id specified)
        - Bell setups with periods & day schedules
        - Scheduled entries
        - Weekly subject target comparison & unassigned counts
        - Conflict warnings
        - Eligible teachers
        """
        if timetable_id:
            current_tt = self.get_timetable_by_id(school_id, timetable_id)
        else:
            current_tt = self.get_active_timetable(school_id)

        all_timetables = self.list_timetables(school_id)
        setups_data = self.list_setups(school_id, current_tt.id)
        eligible_teachers = self.list_eligible_teachers(school_id)

        wings_query = (
            self.db.query(Wing)
            .filter(Wing.school_id == school_id, Wing.deleted_at.is_(None))
            .order_by(Wing.order_index.asc(), Wing.name.asc())
        )
        if wing_id:
            wings_query = wings_query.filter(Wing.id == wing_id)
        wings = wings_query.all()

        wing_classes = (
            self.db.query(WingClass)
            .filter(WingClass.school_id == school_id, WingClass.deleted_at.is_(None))
            .all()
        )
        wing_to_class_ids: Dict[UUID, List[UUID]] = {}
        class_to_wing_id: Dict[UUID, UUID] = {}
        for wc in wing_classes:
            wing_to_class_ids.setdefault(wc.wing_id, []).append(wc.class_id)
            class_to_wing_id[wc.class_id] = wc.wing_id

        all_classes = (
            self.db.query(SchoolClass)
            .filter(SchoolClass.school_id == school_id, SchoolClass.deleted_at.is_(None))
            .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc())
            .all()
        )
        class_map = {c.id: c for c in all_classes}

        all_sections = (
            self.db.query(Section)
            .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
            .order_by(Section.name.asc())
            .all()
        )
        class_to_sections: Dict[UUID, List[Section]] = {}
        for s in all_sections:
            class_to_sections.setdefault(s.class_id, []).append(s)

        sec_to_setup_id: Dict[UUID, UUID] = {}
        for s_item in setups_data:
            for s_id in s_item["assigned_section_ids"]:
                sec_to_setup_id[s_id] = s_item["id"]

        entries = (
            self.db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.subject).joinedload(Subject.parent),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                or_(
                    TimetableEntry.timetable_id == current_tt.id,
                    TimetableEntry.timetable_id.is_(None),
                ),
                TimetableEntry.deleted_at.is_(None),
            )
            .all()
        )

        entries_by_section: Dict[UUID, List[TimetableEntry]] = {}
        for e in entries:
            entries_by_section.setdefault(e.section_id, []).append(e)

        class_subjects = (
            self.db.query(ClassSubject)
            .options(joinedload(ClassSubject.subject))
            .filter(ClassSubject.school_id == school_id, ClassSubject.deleted_at.is_(None))
            .all()
        )
        cs_by_class_and_sec: Dict[Tuple[UUID, Optional[UUID]], List[ClassSubject]] = {}
        for cs in class_subjects:
            cs_by_class_and_sec.setdefault((cs.class_id, cs.section_id), []).append(cs)

        wings_summary = []
        total_classes_count = 0
        total_sections_count = 0
        total_assigned_slots = len(entries)
        total_unassigned_slots = 0

        for w in wings:
            c_ids = wing_to_class_ids.get(w.id, [])
            if not c_ids:
                w_lower = w.name.lower()
                for c in all_classes:
                    if c.id not in class_to_wing_id:
                        cl_lower = c.name.lower()
                        if "pre" in w_lower and any(k in cl_lower for k in ["nur", "lkg", "ukg", "kg"]):
                            c_ids.append(c.id)
                        elif "primary" in w_lower and "pre" not in w_lower and any(f"class {n}" in cl_lower or f"grade {n}" in cl_lower for n in ["1", "2", "3", "4", "5"]):
                            c_ids.append(c.id)
                        elif "middle" in w_lower and any(f"class {n}" in cl_lower or f"grade {n}" in cl_lower for n in ["6", "7", "8"]):
                            c_ids.append(c.id)
                        elif "secondary" in w_lower and "senior" not in w_lower and any(f"class {n}" in cl_lower or f"grade {n}" in cl_lower for n in ["9", "10"]):
                            c_ids.append(c.id)
                        elif "senior" in w_lower and any(f"class {n}" in cl_lower or f"grade {n}" in cl_lower for n in ["11", "12"]):
                            c_ids.append(c.id)

            classes_in_wing = [class_map[cid] for cid in c_ids if cid in class_map]
            classes_summary = []
            wing_sections_count = 0

            for c in classes_in_wing:
                secs = class_to_sections.get(c.id, [])
                wing_sections_count += len(secs)
                total_sections_count += len(secs)
                sections_summary = []

                for s in secs:
                    sec_entries = entries_by_section.get(s.id, [])
                    sec_setup_id = sec_to_setup_id.get(s.id)
                    setup_obj = next((st for st in setups_data if st["id"] == sec_setup_id), setups_data[0] if setups_data else None)

                    setup_periods = setup_obj.get("periods", []) if setup_obj else []
                    teaching_periods = [p for p in setup_periods if not p.get("is_break")]
                    num_days = len(setup_obj.get("applicable_days", ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"])) if setup_obj else 5
                    total_expected_slots = len(teaching_periods) * num_days

                    sub_counts: Dict[UUID, int] = {}
                    for e in sec_entries:
                        sub_counts[e.subject_id] = sub_counts.get(e.subject_id, 0) + 1

                    cs_list = cs_by_class_and_sec.get((c.id, s.id), []) + cs_by_class_and_sec.get((c.id, None), [])
                    seen_subs = set()
                    subject_stats = []

                    for cs in cs_list:
                        sub = cs.subject
                        if not sub or sub.id in seen_subs:
                            continue
                        seen_subs.add(sub.id)
                        assigned_cnt = sub_counts.get(sub.id, 0)
                        target_cnt = 6 if sub.is_academic else 3
                        subject_stats.append({
                            "subject_id": sub.id,
                            "name": sub.name,
                            "code": sub.code,
                            "category": sub.category,
                            "is_academic": sub.is_academic,
                            "assigned": assigned_cnt,
                            "target": target_cnt,
                            "status": "normal" if assigned_cnt == target_cnt else ("under" if assigned_cnt < target_cnt else "over"),
                        })

                    for sub_id, cnt in sub_counts.items():
                        if sub_id not in seen_subs:
                            e_match = next((e for e in sec_entries if e.subject_id == sub_id), None)
                            if e_match and e_match.subject:
                                subject_stats.append({
                                    "subject_id": sub_id,
                                    "name": e_match.subject.name,
                                    "code": e_match.subject.code,
                                    "category": e_match.subject.category,
                                    "is_academic": e_match.subject.is_academic,
                                    "assigned": cnt,
                                    "target": 6 if e_match.subject.is_academic else 3,
                                    "status": "normal" if cnt == 6 else ("under" if cnt < 6 else "over"),
                                })

                    unassigned_count = max(0, total_expected_slots - len(sec_entries))
                    total_unassigned_slots += unassigned_count

                    sections_summary.append({
                        "id": s.id,
                        "name": s.name,
                        "class_id": c.id,
                        "class_name": c.name,
                        "setup_id": setup_obj["id"] if setup_obj else None,
                        "assigned_slots": len(sec_entries),
                        "total_slots": total_expected_slots,
                        "unassigned_slots": unassigned_count,
                        "subject_stats": subject_stats,
                    })

                total_classes_count += 1
                classes_summary.append({
                    "id": c.id,
                    "name": c.name,
                    "wing_id": w.id,
                    "wing_name": w.name,
                    "sections": sections_summary,
                })

            wings_summary.append({
                "id": w.id,
                "name": w.name,
                "order_index": w.order_index,
                "classes": classes_summary,
                "total_classes": len(classes_in_wing),
                "total_sections": wing_sections_count,
            })

        conflicts_count = 0
        teacher_day_entries: Dict[Tuple[UUID, str], List[TimetableEntry]] = {}
        for e in entries:
            if e.teacher_user_id:
                teacher_day_entries.setdefault((e.teacher_user_id, e.day_of_week), []).append(e)

        for (t_id, day), t_entries in teacher_day_entries.items():
            if len(t_entries) > 1:
                for i in range(len(t_entries)):
                    for j in range(i + 1, len(t_entries)):
                        e1 = t_entries[i]
                        e2 = t_entries[j]
                        if e1.period and e2.period:
                            if max(e1.period.start_time, e2.period.start_time) < min(e1.period.end_time, e2.period.end_time):
                                conflicts_count += 1

        entries_read = []
        for e in entries:
            t = e.teacher
            sp = t.staff_profile if t else None
            entries_read.append({
                "id": e.id,
                "school_id": e.school_id,
                "timetable_id": e.timetable_id,
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
                },
                "teacher": {
                    "id": t.id,
                    "name": f"{t.first_name} {t.last_name}".strip(),
                    "first_name": t.first_name,
                    "last_name": t.last_name,
                    "email": t.email,
                    "roll_no": sp.roll_no if sp else None,
                    "department": sp.department if sp else None,
                    "designation": sp.designation if sp else None,
                } if t else None,
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            })

        return {
            "timetable": {
                "id": current_tt.id,
                "school_id": current_tt.school_id,
                "name": current_tt.name,
                "description": current_tt.description,
                "academic_year": current_tt.academic_year,
                "is_active": current_tt.is_active,
                "created_at": current_tt.created_at,
                "updated_at": current_tt.updated_at,
            },
            "timetables": [
                {
                    "id": t.id,
                    "school_id": t.school_id,
                    "name": t.name,
                    "description": t.description,
                    "academic_year": t.academic_year,
                    "is_active": t.is_active,
                    "created_at": t.created_at,
                    "updated_at": t.updated_at,
                }
                for t in all_timetables
            ],
            "wings": wings_summary,
            "setups": setups_data,
            "entries": entries_read,
            "eligible_teachers": eligible_teachers,
            "stats": {
                "total_classes": total_classes_count,
                "total_sections": total_sections_count,
                "assigned_slots": total_assigned_slots,
                "unassigned_slots": total_unassigned_slots,
                "conflicts_count": conflicts_count,
            },
        }

    def check_slot_conflict(
        self,
        school_id: UUID,
        data: ConflictCheckRequest,
    ) -> Dict[str, Any]:
        """Real-time check whether a teacher is double-booked across overlapping time ranges."""
        teacher = (
            self.db.query(User)
            .filter(User.id == data.teacher_user_id, User.deleted_at.is_(None))
            .first()
        )
        if not teacher:
            return {"has_conflict": False, "message": None, "conflicting_entry": None}

        target_start = None
        target_end = None
        if data.start_time and data.end_time:
            target_start = _parse_time(data.start_time)
            target_end = _parse_time(data.end_time)
        elif data.period_id:
            p = self.db.query(TimetablePeriod).filter(TimetablePeriod.id == data.period_id).first()
            if p:
                target_start = p.start_time
                target_end = p.end_time

        if not target_start or not target_end:
            return {"has_conflict": False, "message": None, "conflicting_entry": None}

        q = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.subject),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.teacher_user_id == data.teacher_user_id,
                TimetableEntry.day_of_week == data.day_of_week.upper(),
                or_(
                    TimetableEntry.timetable_id == data.timetable_id,
                    TimetableEntry.timetable_id.is_(None),
                ),
                TimetableEntry.deleted_at.is_(None),
            )
        )
        if data.exclude_entry_id:
            q = q.filter(TimetableEntry.id != data.exclude_entry_id)

        entries = q.all()
        for e in entries:
            ep = e.period
            if ep and max(target_start, ep.start_time) < min(target_end, ep.end_time):
                cls_name = e.section.school_class.name if e.section and e.section.school_class else ""
                sec_name = e.section.name if e.section else ""
                sub_name = e.subject.name if e.subject else "a subject"
                t_name = f"{teacher.first_name} {teacher.last_name}".strip()
                return {
                    "has_conflict": True,
                    "message": f"{t_name} is already teaching {sub_name} in {cls_name}-{sec_name} at this time ({_format_time(ep.start_time)} - {_format_time(ep.end_time)}).",
                    "conflicting_entry": {
                        "id": str(e.id),
                        "class_name": cls_name,
                        "section_name": sec_name,
                        "subject_name": sub_name,
                        "start_time": _format_time(ep.start_time),
                        "end_time": _format_time(ep.end_time),
                    },
                }

        return {"has_conflict": False, "message": None, "conflicting_entry": None}

    def bulk_assign_slot(
        self,
        school_id: UUID,
        data: BulkSlotAssignRequest,
        user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Assign or unassign slot according to scope:
        - SLOT: single cell
        - WEEKDAYS: same period on Monday through Friday
        - CLASS_SECTIONS: same period and day for all sections of this class
        - FILL_TARGET: fills unassigned slots up to weekly target
        """
        now = datetime.now(timezone.utc)
        target_section = (
            self.db.query(Section)
            .filter(Section.id == data.section_id, Section.school_id == school_id)
            .first()
        )
        if not target_section:
            raise NotFoundException("Section not found.")

        target_period = (
            self.db.query(TimetablePeriod)
            .filter(TimetablePeriod.id == data.period_id)
            .first()
        )
        if not target_period:
            raise NotFoundException("Period not found.")

        sections_to_apply = [target_section]
        days_to_apply = [data.day_of_week.upper()]

        if data.scope == "WEEKDAYS":
            days_to_apply = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
        elif data.scope == "CLASS_SECTIONS":
            sections_to_apply = (
                self.db.query(Section)
                .filter(Section.class_id == target_section.class_id, Section.deleted_at.is_(None))
                .all()
            )

        updated_count = 0
        cleared_count = 0

        for sec in sections_to_apply:
            for day in days_to_apply:
                existing = (
                    self.db.query(TimetableEntry)
                    .filter(
                        TimetableEntry.school_id == school_id,
                        TimetableEntry.section_id == sec.id,
                        TimetableEntry.day_of_week == day,
                        TimetableEntry.period_id == target_period.id,
                        or_(
                            TimetableEntry.timetable_id == data.timetable_id,
                            TimetableEntry.timetable_id.is_(None),
                        ),
                        TimetableEntry.deleted_at.is_(None),
                    )
                    .first()
                )

                if data.subject_id is None:
                    if existing:
                        existing.deleted_at = now
                        existing.deleted_by = user_id
                        cleared_count += 1
                else:
                    assigned_teacher_id = data.teacher_user_id
                    if not assigned_teacher_id:
                        cs = (
                            self.db.query(ClassSubject)
                            .filter(
                                ClassSubject.school_id == school_id,
                                ClassSubject.class_id == sec.class_id,
                                ClassSubject.subject_id == data.subject_id,
                                ClassSubject.deleted_at.is_(None),
                            )
                            .first()
                        )
                        if cs and cs.teacher_id:
                            assigned_teacher_id = cs.teacher_id

                    if existing:
                        existing.subject_id = data.subject_id
                        existing.teacher_user_id = assigned_teacher_id
                        existing.timetable_id = data.timetable_id
                        existing.updated_by = user_id
                        existing.updated_at = now
                        updated_count += 1
                    else:
                        new_e = TimetableEntry(
                            school_id=school_id,
                            timetable_id=data.timetable_id,
                            section_id=sec.id,
                            subject_id=data.subject_id,
                            teacher_user_id=assigned_teacher_id,
                            period_id=target_period.id,
                            day_of_week=day,
                            created_by=user_id,
                            updated_by=user_id,
                        )
                        self.db.add(new_e)
                        updated_count += 1

        self.db.commit()
        return {
            "success": True,
            "updated_count": updated_count,
            "cleared_count": cleared_count,
            "message": f"Successfully applied changes ({updated_count} updated, {cleared_count} cleared).",
        }


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
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
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
            .order_by(TimetablePeriod.period_number.asc(), TimetableEntry.created_at.asc())
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

        if getattr(period, "is_break", False):
            raise BadRequestException(f"Cannot schedule a subject during break/recess '{period.label or 'Break'}'.")

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

        tt_id = getattr(data, "timetable_id", None)
        if not tt_id:
            active_tt = self.get_active_timetable(school_id)
            tt_id = active_tt.id if active_tt else None

        entry = TimetableEntry(
            school_id=school_id,
            timetable_id=tt_id,
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

    # =========================================================================
    # MULTI-VIEW & INSIGHTS SERVICES
    # =========================================================================

    def get_teacher_schedule(self, school_id: UUID, teacher_user_id: UUID) -> Dict[str, Any]:
        """
        Fetch weekly timetable schedule for a specific teacher across all classes and sections.
        Ensures school isolation and active staff eligibility.
        """
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
            raise NotFoundException("Teacher not found or not an active staff member of this school.")

        sp = teacher.staff_profile
        teacher_data = {
            "id": teacher.id,
            "name": f"{teacher.first_name} {teacher.last_name}".strip(),
            "first_name": teacher.first_name,
            "last_name": teacher.last_name,
            "email": teacher.email,
            "roll_no": sp.roll_no if sp else None,
            "department": sp.department if sp else None,
            "designation": sp.designation if sp else None,
        }

        periods = self.list_periods(school_id)
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

        entries = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .join(Section, Section.id == TimetableEntry.section_id)
            .outerjoin(SchoolClass, SchoolClass.id == Section.class_id)
            .options(
                joinedload(TimetableEntry.subject).joinedload(Subject.parent),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.teacher_user_id == teacher_user_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc(), TimetableEntry.created_at.asc())
            .all()
        )

        entries_data = []
        for e in entries:
            sec = e.section
            cls_name = sec.school_class.name if sec and sec.school_class else ""
            sec_name = sec.name if sec else ""
            p = e.period
            entries_data.append({
                "id": e.id,
                "school_id": e.school_id,
                "section_id": e.section_id,
                "class_id": sec.class_id if sec else None,
                "class_name": cls_name,
                "section_name": sec_name,
                "period_id": e.period_id,
                "period_number": p.period_number if p else 0,
                "day_of_week": e.day_of_week,
                "start_time": _format_time(p.start_time) if p else "",
                "end_time": _format_time(p.end_time) if p else "",
                "subject": {
                    "id": e.subject.id,
                    "name": e.subject.name,
                    "code": e.subject.code,
                    "category": e.subject.category,
                    "is_academic": e.subject.is_academic,
                    "parent_id": getattr(e.subject, "parent_id", None),
                    "parent_name": e.subject.parent.name if getattr(e.subject, "parent", None) else None,
                } if e.subject else None,
            })

        return {
            "teacher": teacher_data,
            "periods": periods_data,
            "entries": entries_data,
            "total_teaching_periods": len(entries_data),
        }

    def get_free_teachers(self, school_id: UUID, day_of_week: Optional[str] = None) -> Dict[str, Any]:
        """
        Scan and calculate teacher availability across all actual time intervals / periods.
        Avoids N+1 queries by fetching all teachers, periods, and entries in single queries.
        """
        periods = self.list_periods(school_id)
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

        all_teachers = self.list_eligible_teachers(school_id)

        valid_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        if day_of_week and day_of_week.upper() in valid_days:
            target_days = [day_of_week.upper()]
        else:
            target_days = valid_days

        entries_query = (
            self.db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.subject),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.deleted_at.is_(None),
                TimetableEntry.teacher_user_id.isnot(None),
                TimetableEntry.day_of_week.in_(target_days),
            )
        )
        entries = entries_query.all()

        # Map: (day, period_id) -> list of occupied teacher info
        occupied_by_slot: Dict[Tuple[str, UUID], List[Dict[str, Any]]] = {}
        for e in entries:
            key = (e.day_of_week, e.period_id)
            if key not in occupied_by_slot:
                occupied_by_slot[key] = []

            t = e.teacher
            sp = t.staff_profile if t else None
            sec = e.section
            cls_name = sec.school_class.name if sec and sec.school_class else ""

            occupied_by_slot[key].append({
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
                "section": {
                    "id": sec.id if sec else e.section_id,
                    "class_id": sec.class_id if sec else None,
                    "class_name": cls_name,
                    "section_name": sec.name if sec else "",
                },
                "subject": {
                    "id": e.subject.id,
                    "name": e.subject.name,
                    "code": e.subject.code,
                    "category": e.subject.category,
                    "is_academic": e.subject.is_academic,
                } if e.subject else None,
            })

        days_data = []
        for day in target_days:
            slot_infos = []
            for p in periods:
                key = (day, p.id)
                occ_list = occupied_by_slot.get(key, [])
                occ_teacher_ids = {item["teacher"]["id"] for item in occ_list if item.get("teacher")}

                free_teachers = [t for t in all_teachers if t["id"] not in occ_teacher_ids]

                slot_infos.append({
                    "period_id": p.id,
                    "period_number": p.period_number,
                    "start_time": _format_time(p.start_time),
                    "end_time": _format_time(p.end_time),
                    "free_teachers": free_teachers,
                    "occupied_teachers": occ_list,
                    "free_count": len(free_teachers),
                    "occupied_count": len(occ_list),
                })
            days_data.append({
                "day_of_week": day,
                "periods": slot_infos,
            })

        return {
            "periods": periods_data,
            "days": days_data,
            "total_teachers": len(all_teachers),
        }

    def get_master_timetable(self, school_id: UUID) -> Dict[str, Any]:
        """
        Fetch master schedule with all classes, sections, periods, and entries in single batch queries.
        Optimized for school-wide monitoring.
        """
        periods = self.list_periods(school_id)
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

        sections = (
            self.db.query(Section)
            .join(SchoolClass, SchoolClass.id == Section.class_id)
            .options(joinedload(Section.school_class))
            .filter(
                Section.school_id == school_id,
                Section.deleted_at.is_(None),
                SchoolClass.deleted_at.is_(None),
            )
            .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc(), Section.name.asc())
            .all()
        )

        sections_data = [
            {
                "id": s.id,
                "class_id": s.class_id,
                "class_name": s.school_class.name if s.school_class else "",
                "section_name": s.name,
                "display_name": f"{s.school_class.name} - {s.name}" if s.school_class else s.name,
            }
            for s in sections
        ]

        entries = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(
                joinedload(TimetableEntry.subject).joinedload(Subject.parent),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc(), TimetableEntry.created_at.asc())
            .all()
        )

        entries_data = []
        for e in entries:
            t = e.teacher
            sp = t.staff_profile if t else None
            p = e.period
            entries_data.append({
                "id": e.id,
                "school_id": e.school_id,
                "section_id": e.section_id,
                "period_id": e.period_id,
                "period_number": p.period_number if p else 0,
                "day_of_week": e.day_of_week,
                "start_time": _format_time(p.start_time) if p else "",
                "end_time": _format_time(p.end_time) if p else "",
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
                    "name": f"{t.first_name} {t.last_name}".strip(),
                    "first_name": t.first_name,
                    "last_name": t.last_name,
                    "email": t.email,
                    "roll_no": sp.roll_no if sp else None,
                    "department": sp.department if sp else None,
                    "designation": sp.designation if sp else None,
                } if t else None,
            })

        return {
            "periods": periods_data,
            "sections": sections_data,
            "entries": entries_data,
        }

    def get_insights(self, school_id: UUID) -> Dict[str, Any]:
        """
        Calculate complete timetable status & insights grid metrics:
        - Total scheduled periods
        - Assignment completion percentage & unassigned slots (with 'Not configured' state handling)
        - Teacher utilization
        - Currently free teachers
        - Scheduling conflicts scan
        - Coverage summary across classes/sections
        """
        periods = self.list_periods(school_id)
        sections = (
            self.db.query(Section)
            .join(SchoolClass, SchoolClass.id == Section.class_id)
            .options(joinedload(Section.school_class))
            .filter(
                Section.school_id == school_id,
                Section.deleted_at.is_(None),
                SchoolClass.deleted_at.is_(None),
            )
            .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc(), Section.name.asc())
            .all()
        )
        teachers = self.list_eligible_teachers(school_id)

        entries = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(
                joinedload(TimetableEntry.subject),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.period),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .all()
        )

        num_periods = len(periods)
        num_sections = len(sections)
        num_teachers = len(teachers)
        working_days = 6  # Monday to Saturday
        is_configured = num_periods > 0 and num_sections > 0

        total_scheduled = len(entries)

        if is_configured:
            total_expected_slots = num_sections * num_periods * working_days
            assignment_completion_pct = (
                round((total_scheduled / total_expected_slots) * 100, 1)
                if total_expected_slots > 0 else 0.0
            )
            unassigned_slots = max(0, total_expected_slots - total_scheduled)
        else:
            total_expected_slots = None
            assignment_completion_pct = None
            unassigned_slots = None

        # Teacher capacity & utilization
        total_teacher_capacity = num_teachers * num_periods * working_days
        if total_teacher_capacity > 0 and num_teachers > 0:
            assigned_teacher_entries = sum(1 for e in entries if e.teacher_user_id is not None)
            teacher_utilization_pct = round((assigned_teacher_entries / total_teacher_capacity) * 100, 1)
        else:
            teacher_utilization_pct = None

        # Conflicts scan
        section_slot_map: Dict[Tuple[UUID, str, UUID], List[TimetableEntry]] = {}
        teacher_slot_map: Dict[Tuple[UUID, str, UUID], List[TimetableEntry]] = {}

        for e in entries:
            sec_key = (e.section_id, e.day_of_week, e.period_id)
            if sec_key not in section_slot_map:
                section_slot_map[sec_key] = []
            section_slot_map[sec_key].append(e)

            if e.teacher_user_id:
                tch_key = (e.teacher_user_id, e.day_of_week, e.period_id)
                if tch_key not in teacher_slot_map:
                    teacher_slot_map[tch_key] = []
                teacher_slot_map[tch_key].append(e)

        conflicts = []
        for (sec_id, day, period_id), slot_entries in section_slot_map.items():
            if len(slot_entries) > 1:
                first = slot_entries[0]
                p = first.period
                sec = first.section
                cls_name = sec.school_class.name if sec and sec.school_class else ""
                sec_name = sec.name if sec else ""
                conflicts.append({
                    "type": "SECTION_CONFLICT",
                    "day_of_week": day,
                    "period_number": p.period_number if p else 0,
                    "start_time": _format_time(p.start_time) if p else "",
                    "end_time": _format_time(p.end_time) if p else "",
                    "description": f"Multiple lessons scheduled for {cls_name}-{sec_name} on {day} Period {p.period_number if p else ''}",
                    "section_id": sec_id,
                    "class_name": cls_name,
                    "section_name": sec_name,
                    "teacher_id": None,
                    "teacher_name": None,
                    "entry_ids": [se.id for se in slot_entries],
                })

        for (tch_id, day, period_id), slot_entries in teacher_slot_map.items():
            if len(slot_entries) > 1:
                first = slot_entries[0]
                p = first.period
                t = first.teacher
                tch_name = f"{t.first_name} {t.last_name}".strip() if t else "Teacher"
                conflicts.append({
                    "type": "TEACHER_CONFLICT",
                    "day_of_week": day,
                    "period_number": p.period_number if p else 0,
                    "start_time": _format_time(p.start_time) if p else "",
                    "end_time": _format_time(p.end_time) if p else "",
                    "description": f"{tch_name} is double-booked across {len(slot_entries)} classes on {day} Period {p.period_number if p else ''}",
                    "section_id": None,
                    "class_name": None,
                    "section_name": None,
                    "teacher_id": tch_id,
                    "teacher_name": tch_name,
                    "entry_ids": [se.id for se in slot_entries],
                })

        # Coverage summary per section
        entries_by_section: Dict[UUID, int] = {}
        for e in entries:
            entries_by_section[e.section_id] = entries_by_section.get(e.section_id, 0) + 1

        expected_per_sec = num_periods * working_days if num_periods > 0 else 0
        section_coverage_list = []
        complete_count = 0
        partial_count = 0
        missing_count = 0

        for s in sections:
            cnt = entries_by_section.get(s.id, 0)
            cls_name = s.school_class.name if s.school_class else ""
            if not is_configured or expected_per_sec == 0:
                status_str = "MISSING" if cnt == 0 else "PARTIAL"
                pct = 0.0
            elif cnt >= expected_per_sec:
                status_str = "COMPLETE"
                pct = 100.0
            elif cnt == 0:
                status_str = "MISSING"
                pct = 0.0
            else:
                status_str = "PARTIAL"
                pct = round((cnt / expected_per_sec) * 100, 1)

            if status_str == "COMPLETE":
                complete_count += 1
            elif status_str == "PARTIAL":
                partial_count += 1
            else:
                missing_count += 1

            section_coverage_list.append({
                "section_id": s.id,
                "class_id": s.class_id,
                "class_name": cls_name,
                "section_name": s.name,
                "scheduled_periods": cnt,
                "expected_periods": expected_per_sec,
                "completion_percentage": pct,
                "status": status_str,
            })

        # Calculate currently free teachers
        now = datetime.now()
        now_time = now.time()
        weekday_idx = now.weekday()  # 0=Monday, 5=Saturday, 6=Sunday
        days_names = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        free_teachers_now = num_teachers

        if weekday_idx < 6 and num_periods > 0 and num_teachers > 0:
            today_day = days_names[weekday_idx]
            current_period = next(
                (p for p in periods if p.start_time <= now_time <= p.end_time),
                None,
            )
            if current_period:
                occupied_now = {
                    e.teacher_user_id
                    for e in entries
                    if e.day_of_week == today_day
                    and e.period_id == current_period.id
                    and e.teacher_user_id is not None
                }
                free_teachers_now = max(0, num_teachers - len(occupied_now))

        return {
            "is_configured": is_configured,
            "total_scheduled_periods": total_scheduled,
            "total_expected_slots": total_expected_slots,
            "assignment_completion_percentage": assignment_completion_pct,
            "unassigned_slots": unassigned_slots,
            "total_teachers": num_teachers,
            "teacher_utilization_percentage": teacher_utilization_pct,
            "free_teachers_now_count": free_teachers_now if num_teachers > 0 else 0,
            "conflict_count": len(conflicts),
            "conflicts": conflicts,
            "coverage_summary": {
                "complete_count": complete_count,
                "partial_count": partial_count,
                "missing_count": missing_count,
                "sections": section_coverage_list,
            },
        }
