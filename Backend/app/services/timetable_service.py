import json
import re
import uuid
from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.exceptions import (
    AppException,
    BadRequestException,
    ConflictException,
    NotFoundException,
    ScheduleConflictException,
    UnprocessableEntityException,
)
from app.services.bell_timing_validator import (
    validate_period_sequence,
    validate_setup_day_invariants,
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
    AffectedTeacherDiff,
    BatchSetupAssignmentsRequest,
    BulkSlotAssignRequest,
    ConflictCheckRequest,
    TeacherSlotDiff,
    TimetableCreate,
    TimetableEntryCreate,
    TimetableEntryUpdate,
    TimetablePeriodCreate,
    TimetablePeriodUpdate,
    TimetablePublishDiffResponse,
    TimetablePublishResponse,
    TimetableSetupCreate,
    TimetableSetupUpdate,
    TimetableUpdate,
)


def _parse_time(time_str: str) -> time:
    parts = [int(p) for p in time_str.strip().split(":")]
    return time(hour=parts[0], minute=parts[1], second=parts[2] if len(parts) == 3 else 0)


def _format_time(t: time) -> str:
    return t.strftime("%H:%M")


def _format_time_12h(t: time) -> str:
    if not t:
        return ""
    return t.strftime("%I:%M %p")


def _format_day_display(day_enum: str) -> str:
    return day_enum.capitalize()


def _format_class_section_name(class_name: Optional[str], section_name: Optional[str]) -> str:
    raw_class = (class_name or "").strip()
    raw_sec = (section_name or "").strip()

    if not raw_class and not raw_sec:
        return "another section"

    def format_cls(cls_str: str) -> str:
        if not cls_str:
            return ""
        m = re.match(r"^(?:class|grade)\s+(\d+)$", cls_str, re.IGNORECASE)
        if m:
            num = int(m.group(1))
            rem100 = num % 100
            if 11 <= rem100 <= 13:
                suffix = "th"
            else:
                suffix = {1: "st", 2: "nd", 3: "rd"}.get(num % 10, "th")
            return f"{num}{suffix}"
        return cls_str

    clean_sec = re.sub(r"^section\s+", "", raw_sec, flags=re.IGNORECASE).strip()
    formatted_cls = format_cls(raw_class)

    if not formatted_cls:
        return clean_sec or "another section"
    if not clean_sec:
        return formatted_cls

    return f"{formatted_cls} {clean_sec}".strip()


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
            name="Timetable 2026 - 2027",
            description="Default school academic schedule",
            academic_year="2026-2027",
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

    def _compute_completion_percentage(
        self,
        school_id: UUID,
        timetable_id: UUID,
        total_sections: Optional[int] = None,
        precomputed_entry_count: Optional[int] = None,
    ) -> float:
        if precomputed_entry_count is not None:
            entry_count = precomputed_entry_count
        else:
            entry_count = (
                self.db.query(TimetableEntry)
                .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
                .filter(
                    TimetableEntry.timetable_id == timetable_id,
                    TimetableEntry.deleted_at.is_(None),
                    TimetablePeriod.deleted_at.is_(None),
                    TimetablePeriod.is_break == False,
                )
                .count()
            )
        if entry_count == 0:
            return 0.0

        setups = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.timetable_id == timetable_id,
                TimetableSetup.deleted_at.is_(None),
            )
            .all()
        )
        if not setups:
            return 0.0

        default_setup = next((s for s in setups if s.is_default), setups[0])
        all_sections = (
            self.db.query(Section)
            .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
            .all()
        )
        if not all_sections:
            return 0.0

        assignments = (
            self.db.query(TimetableSetupAssignment)
            .filter(
                TimetableSetupAssignment.timetable_id == timetable_id,
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            .all()
        )
        sec_to_setup = {a.target_id: a.setup_id for a in assignments if a.target_type == "SECTION"}

        all_periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.timetable_id == timetable_id,
                TimetablePeriod.deleted_at.is_(None),
                TimetablePeriod.is_break == False,
            )
            .all()
        )
        periods_by_setup: Dict[UUID, List[TimetablePeriod]] = {}
        for p in all_periods:
            periods_by_setup.setdefault(p.setup_id, []).append(p)

        total_expected = 0
        for s in setups:
            periods = periods_by_setup.get(s.id, [])
            app_days = []
            if s.applicable_days:
                try:
                    app_days = json.loads(s.applicable_days)
                except Exception:
                    app_days = []
            num_days = len(app_days) if app_days else 6
            sec_count = sum(
                1 for sec in all_sections if sec_to_setup.get(sec.id, default_setup.id) == s.id
            )
            total_expected += len(periods) * num_days * sec_count

        if total_expected > 0 and entry_count > 0:
            return min(100.0, round((entry_count / total_expected) * 100, 1))
        return 0.0

    def list_timetables(self, school_id: UUID) -> List[Timetable]:
        self._ensure_default_timetable_exists(school_id)
        tts = (
            self.db.query(Timetable)
            .filter(
                Timetable.school_id == school_id,
                Timetable.deleted_at.is_(None),
            )
            .order_by(Timetable.is_active.desc(), Timetable.created_at.desc())
            .all()
        )
        if not tts:
            return []

        tt_ids = [tt.id for tt in tts]
        entry_counts = dict(
            self.db.query(TimetableEntry.timetable_id, func.count(TimetableEntry.id))
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .filter(
                TimetableEntry.timetable_id.in_(tt_ids),
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.is_(None),
                TimetablePeriod.is_break == False,
            )
            .group_by(TimetableEntry.timetable_id)
            .all()
        )

        total_sections = (
            self.db.query(Section)
            .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
            .count()
        )
        for tt in tts:
            cnt = entry_counts.get(tt.id, 0)
            if cnt == 0:
                tt.completion_percentage = 0.0
            else:
                tt.completion_percentage = self._compute_completion_percentage(
                    school_id, tt.id, total_sections, precomputed_entry_count=cnt
                )
        return tts

    def get_active_timetable(self, school_id: UUID) -> Timetable:
        tt = self._ensure_default_timetable_exists(school_id)
        tt.completion_percentage = self._compute_completion_percentage(school_id, tt.id)
        return tt

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
        tt.completion_percentage = self._compute_completion_percentage(school_id, tt.id)
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
                    schedules_json=s.schedules_json,
                    order_index=s.order_index,
                    version=1,
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
                        period_type=p.period_type,
                        schedule_id=p.schedule_id,
                        label=p.label,
                        created_by=user_id,
                        updated_by=user_id,
                    )
                    self.db.add(cloned_p)
                    self.db.flush()
                    period_id_map[p.id] = cloned_p.id

                # Remap period IDs inside schedules_json if present
                if s.schedules_json:
                    try:
                        schedules_data = json.loads(s.schedules_json)
                        for sch in schedules_data:
                            for sch_p in sch.get("periods", []):
                                old_pid_str = str(sch_p.get("id"))
                                for old_pid, new_pid in period_id_map.items():
                                    if str(old_pid) == old_pid_str:
                                        sch_p["id"] = str(new_pid)
                                        break
                        cloned_s.schedules_json = json.dumps(schedules_data, default=str)
                    except Exception:
                        pass

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

    def validate_timetable_conflicts(
        self, school_id: UUID, timetable_id: UUID
    ) -> Tuple[bool, int, List[str]]:
        """
        Scan all active entries in a timetable and identify any teacher double-bookings
        or overlapping time intervals.
        Returns: (has_conflicts, conflict_incident_count, conflict_descriptions)
        """
        self._sync_timetable_entries_with_setups(school_id, timetable_id)
        self.db.commit()

        entries = (
            self.db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.period),
                joinedload(TimetableEntry.teacher),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.subject),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.timetable_id == timetable_id,
                TimetableEntry.deleted_at.is_(None),
                TimetableEntry.teacher_user_id.is_not(None),
            )
            .all()
        )

        teacher_day_map: Dict[Tuple[UUID, str], List[TimetableEntry]] = {}
        for e in entries:
            if not e.teacher_user_id or not e.period:
                continue
            k = (e.teacher_user_id, e.day_of_week)
            if k not in teacher_day_map:
                teacher_day_map[k] = []
            teacher_day_map[k].append(e)

        conflict_incidents = 0
        conflict_messages: List[str] = []

        for (teacher_id, day), t_entries in teacher_day_map.items():
            if len(t_entries) < 2:
                continue

            adj: Dict[UUID, List[TimetableEntry]] = {e.id: [] for e in t_entries}
            for i in range(len(t_entries)):
                for j in range(i + 1, len(t_entries)):
                    e1 = t_entries[i]
                    e2 = t_entries[j]
                    p1 = e1.period
                    p2 = e2.period
                    if p1 and p2 and p1.start_time and p1.end_time and p2.start_time and p2.end_time:
                        if p1.start_time < p2.end_time and p2.start_time < p1.end_time:
                            adj[e1.id].append(e2)
                            adj[e2.id].append(e1)

            visited = set()
            for e in t_entries:
                if e.id not in visited and adj[e.id]:
                    cluster = []
                    queue = [e]
                    visited.add(e.id)
                    while queue:
                        curr = queue.pop(0)
                        cluster.append(curr)
                        for neighbor in adj[curr.id]:
                            if neighbor.id not in visited:
                                visited.add(neighbor.id)
                                queue.append(neighbor)

                    if len(cluster) > 1:
                        conflict_incidents += 1
                        t_name = f"{cluster[0].teacher.first_name} {cluster[0].teacher.last_name}".strip() if cluster[0].teacher else "Teacher"
                        sec_names = [
                            f"{ce.section.school_class.name if ce.section and ce.section.school_class else ''} {ce.section.name if ce.section else ''}".strip()
                            for ce in cluster
                        ]
                        conflict_messages.append(
                            f"{t_name} is double-booked on {day} across {', '.join(sec_names)}"
                        )

        return (conflict_incidents > 0, conflict_incidents, conflict_messages)

    def get_publish_diff(
        self, school_id: UUID, timetable_id: UUID
    ) -> TimetablePublishDiffResponse:
        tt = self.get_timetable_by_id(school_id, timetable_id)
        has_conflicts, conflict_count, conflict_msgs = self.validate_timetable_conflicts(school_id, timetable_id)

        entries = (
            self.db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.period),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.subject),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.timetable_id == timetable_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .all()
        )

        current_teacher_map: Dict[str, Dict[str, Any]] = {}
        for e in entries:
            if not e.teacher_user_id or not e.teacher:
                continue
            tid = str(e.teacher_user_id)
            if tid not in current_teacher_map:
                t = e.teacher
                sp = getattr(t, "staff_profile", None)
                dept = sp.department or sp.designation if sp else None
                current_teacher_map[tid] = {
                    "teacher_id": e.teacher_user_id,
                    "teacher_name": f"{t.first_name} {t.last_name}".strip() or t.email,
                    "teacher_email": t.email,
                    "department": dept,
                    "slots": {},
                }

            start_str = _format_time(e.period.start_time) if e.period and e.period.start_time else ""
            end_str = _format_time(e.period.end_time) if e.period and e.period.end_time else ""
            cls_name = e.section.school_class.name if e.section and e.section.school_class else ""
            sec_name = e.section.name if e.section else ""
            sub_name = e.subject.name if e.subject else ""

            slot_key = f"{e.day_of_week}_{start_str}_{end_str}_{e.section_id}"
            current_teacher_map[tid]["slots"][slot_key] = TeacherSlotDiff(
                day_of_week=e.day_of_week,
                period_number=e.period.period_number if e.period else None,
                start_time=start_str,
                end_time=end_str,
                class_name=cls_name,
                section_name=sec_name,
                subject_name=sub_name,
            )

        prev_snapshot: Optional[Dict[str, Any]] = None
        if tt.last_published_entries_json:
            try:
                prev_snapshot = json.loads(tt.last_published_entries_json)
            except Exception:
                prev_snapshot = None

        is_first_publish = prev_snapshot is None
        affected_teachers: List[AffectedTeacherDiff] = []

        if is_first_publish:
            for tid, tdata in current_teacher_map.items():
                added = list(tdata["slots"].values())
                affected_teachers.append(
                    AffectedTeacherDiff(
                        teacher_id=tdata["teacher_id"],
                        teacher_name=tdata["teacher_name"],
                        teacher_email=tdata["teacher_email"],
                        department=tdata["department"],
                        added_slots=added,
                        removed_slots=[],
                        modified_slots=[],
                        total_changes=len(added),
                    )
                )
        else:
            prev_teacher_map = prev_snapshot.get("teachers", {})
            all_teacher_ids = set(current_teacher_map.keys()) | set(prev_teacher_map.keys())

            for tid in all_teacher_ids:
                curr = current_teacher_map.get(tid)
                prev = prev_teacher_map.get(tid)

                added_slots: List[TeacherSlotDiff] = []
                removed_slots: List[TeacherSlotDiff] = []
                modified_slots: List[TeacherSlotDiff] = []

                if curr and not prev:
                    added_slots = list(curr["slots"].values())
                    t_name = curr["teacher_name"]
                    t_email = curr["teacher_email"]
                    t_dept = curr["department"]
                    teacher_uuid = curr["teacher_id"]
                elif prev and not curr:
                    for s_data in prev.get("slots", {}).values():
                        removed_slots.append(TeacherSlotDiff(**s_data))
                    t_name = prev.get("teacher_name", "Teacher")
                    t_email = prev.get("teacher_email")
                    t_dept = prev.get("department")
                    teacher_uuid = UUID(tid)
                else:
                    t_name = curr["teacher_name"]
                    t_email = curr["teacher_email"]
                    t_dept = curr["department"]
                    teacher_uuid = curr["teacher_id"]

                    curr_slots = curr["slots"]
                    prev_slots_raw = prev.get("slots", {})

                    for sk, c_slot in curr_slots.items():
                        if sk not in prev_slots_raw:
                            added_slots.append(c_slot)
                        else:
                            p_slot = TeacherSlotDiff(**prev_slots_raw[sk])
                            if (
                                p_slot.subject_name != c_slot.subject_name
                                or p_slot.section_name != c_slot.section_name
                            ):
                                modified_slots.append(c_slot)

                    for sk, p_raw in prev_slots_raw.items():
                        if sk not in curr_slots:
                            removed_slots.append(TeacherSlotDiff(**p_raw))

                total_changes = len(added_slots) + len(removed_slots) + len(modified_slots)
                if total_changes > 0:
                    affected_teachers.append(
                        AffectedTeacherDiff(
                            teacher_id=teacher_uuid,
                            teacher_name=t_name,
                            teacher_email=t_email,
                            department=t_dept,
                            added_slots=added_slots,
                            removed_slots=removed_slots,
                            modified_slots=modified_slots,
                            total_changes=total_changes,
                        )
                    )

        affected_teachers.sort(key=lambda t: t.teacher_name.lower())
        next_ver = (tt.version or 1) + (0 if is_first_publish and tt.status == "DRAFT" else 1)

        return TimetablePublishDiffResponse(
            timetable_id=tt.id,
            current_version=tt.version or 1,
            next_version=next_ver,
            status=tt.status or "DRAFT",
            can_publish=(conflict_count == 0),
            conflict_count=conflict_count,
            conflicts_summary=conflict_msgs,
            is_first_publish=is_first_publish,
            affected_teachers_count=len(affected_teachers),
            affected_teachers=affected_teachers,
            total_entries=len(entries),
        )

    def publish_timetable(
        self, school_id: UUID, timetable_id: UUID, user_id: UUID
    ) -> TimetablePublishResponse:
        tt = self.get_timetable_by_id(school_id, timetable_id)
        diff = self.get_publish_diff(school_id, timetable_id)

        if not diff.can_publish:
            raise BadRequestException(
                f"Cannot publish timetable: {diff.conflict_count} schedule conflict(s) detected. Please resolve them first."
            )

        entries = (
            self.db.query(TimetableEntry)
            .options(
                joinedload(TimetableEntry.period),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
                joinedload(TimetableEntry.subject),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.timetable_id == timetable_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .all()
        )

        teacher_snapshot: Dict[str, Any] = {}
        for e in entries:
            if not e.teacher_user_id or not e.teacher:
                continue
            tid = str(e.teacher_user_id)
            if tid not in teacher_snapshot:
                t = e.teacher
                sp = getattr(t, "staff_profile", None)
                dept = sp.department or sp.designation if sp else None
                teacher_snapshot[tid] = {
                    "teacher_id": tid,
                    "teacher_name": f"{t.first_name} {t.last_name}".strip() or t.email,
                    "teacher_email": t.email,
                    "department": dept,
                    "slots": {},
                }

            start_str = _format_time(e.period.start_time) if e.period and e.period.start_time else ""
            end_str = _format_time(e.period.end_time) if e.period and e.period.end_time else ""
            cls_name = e.section.school_class.name if e.section and e.section.school_class else ""
            sec_name = e.section.name if e.section else ""
            sub_name = e.subject.name if e.subject else ""
            slot_key = f"{e.day_of_week}_{start_str}_{end_str}_{e.section_id}"

            teacher_snapshot[tid]["slots"][slot_key] = {
                "day_of_week": e.day_of_week,
                "period_number": e.period.period_number if e.period else None,
                "start_time": start_str,
                "end_time": end_str,
                "class_name": cls_name,
                "section_name": sec_name,
                "subject_name": sub_name,
            }

        snapshot_payload = {
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": str(user_id),
            "version": diff.next_version,
            "teachers": teacher_snapshot,
        }

        now = datetime.now(timezone.utc)
        tt.status = "PUBLISHED"
        tt.version = diff.next_version
        tt.published_at = now
        tt.published_by = user_id
        tt.last_published_entries_json = json.dumps(snapshot_payload)
        tt.updated_at = now
        tt.updated_by = user_id

        self.db.commit()
        self.db.refresh(tt)

        return TimetablePublishResponse(
            message=f"Timetable published successfully as Version {tt.version}. Notifications prepared for {diff.affected_teachers_count} affected teachers.",
            timetable_id=tt.id,
            version=tt.version,
            status=tt.status,
            published_at=tt.published_at,
            affected_teachers_count=diff.affected_teachers_count,
            affected_teachers=diff.affected_teachers,
        )

    def activate_timetable(self, school_id: UUID, timetable_id: UUID, user_id: UUID) -> Timetable:
        tt = self.get_timetable_by_id(school_id, timetable_id)
        has_conflicts, conflict_count, conflict_msgs = self.validate_timetable_conflicts(school_id, timetable_id)
        if has_conflicts:
            raise BadRequestException(
                f"Cannot activate timetable: {conflict_count} schedule conflict(s) detected. Please resolve all conflicts on the Timetable page first."
            )

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
            .order_by(TimetableSetup.order_index.asc(), TimetableSetup.is_default.desc(), TimetableSetup.created_at.asc())
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
                .order_by(TimetableSetup.order_index.asc(), TimetableSetup.is_default.desc(), TimetableSetup.created_at.asc())
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

        sections_by_class: Dict[UUID, List[Section]] = {}
        sections_by_wing: Dict[UUID, List[Section]] = {}
        for s in all_sections:
            sections_by_class.setdefault(s.class_id, []).append(s)
            w_id = class_to_wing.get(s.class_id)
            if w_id:
                sections_by_wing.setdefault(w_id, []).append(s)

        sec_to_setup: Dict[UUID, UUID] = {}
        for a in assignments:
            if a.target_type == "SECTION":
                sec_to_setup[a.target_id] = a.setup_id
            elif a.target_type == "CLASS":
                for s in sections_by_class.get(a.target_id, []):
                    if s.id not in sec_to_setup:
                        sec_to_setup[s.id] = a.setup_id
            elif a.target_type == "WING":
                for s in sections_by_wing.get(a.target_id, []):
                    if s.id not in sec_to_setup:
                        sec_to_setup[s.id] = a.setup_id

        default_setup = next((s for s in setups if s.is_default), setups[0] if setups else None)
        default_setup_id = default_setup.id if default_setup else None

        all_periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.timetable_id == timetable_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc())
            .all()
        )
        periods_by_setup: Dict[UUID, List[TimetablePeriod]] = {}
        for p in all_periods:
            periods_by_setup.setdefault(p.setup_id, []).append(p)

        result = []
        for s in setups:
            periods = periods_by_setup.get(s.id, [])
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

            # Group canonical DB periods by schedule_id
            periods_by_sch = {}
            for p in periods:
                sch_k = p.schedule_id or "regular"
                periods_by_sch.setdefault(sch_k, []).append({
                    "id": str(p.id),
                    "school_id": p.school_id,
                    "timetable_id": p.timetable_id,
                    "setup_id": p.setup_id,
                    "schedule_id": p.schedule_id,
                    "period_number": p.period_number,
                    "start_time": _format_time(p.start_time),
                    "end_time": _format_time(p.end_time),
                    "is_break": p.is_break,
                    "period_type": p.period_type,
                    "label": p.label or ("RECESS" if p.is_break else f"P{p.period_number}"),
                    "created_at": p.created_at,
                    "updated_at": p.updated_at,
                })

            schedules = []
            if s.schedules_json:
                try:
                    raw_schedules = json.loads(s.schedules_json)
                    for raw_sch in raw_schedules:
                        sch_id = raw_sch.get("id") or "regular"
                        sch_days = raw_sch.get("days") or []
                        # Canonical periods derived directly from TimetablePeriod DB rows
                        sch_periods = periods_by_sch.get(sch_id)
                        if sch_periods is None:
                            if len(raw_schedules) == 1 and len(periods_by_sch) == 1:
                                sch_periods = list(periods_by_sch.values())[0]
                            else:
                                sch_periods = []
                        schedules.append({
                            "id": sch_id,
                            "days": sch_days,
                            "periods": sch_periods,
                        })
                except Exception:
                    schedules = []

            if not schedules:
                # Synthesize default schedule directly from canonical database periods
                reg_periods = periods_by_sch.get("regular") or [
                    {
                        "id": str(p.id),
                        "school_id": p.school_id,
                        "timetable_id": p.timetable_id,
                        "setup_id": p.setup_id,
                        "schedule_id": p.schedule_id or "regular",
                        "period_number": p.period_number,
                        "start_time": _format_time(p.start_time),
                        "end_time": _format_time(p.end_time),
                        "is_break": p.is_break,
                        "period_type": p.period_type,
                        "label": p.label or ("RECESS" if p.is_break else f"P{p.period_number}"),
                        "created_at": p.created_at,
                        "updated_at": p.updated_at,
                    }
                    for p in periods
                ]
                schedules = [
                    {
                        "id": "regular",
                        "days": [d for d in applicable_days if d != "SATURDAY"],
                        "periods": reg_periods,
                    }
                ]
                if "SATURDAY" in applicable_days:
                    sat_periods = periods_by_sch.get("saturday") or [
                        {
                            "id": str(p.id),
                            "school_id": p.school_id,
                            "timetable_id": p.timetable_id,
                            "setup_id": p.setup_id,
                            "schedule_id": p.schedule_id or "saturday",
                            "period_number": p.period_number,
                            "start_time": _format_time(p.start_time),
                            "end_time": _format_time(p.end_time),
                            "is_break": p.is_break,
                            "period_type": p.period_type,
                            "label": p.label or ("RECESS" if p.is_break else f"P{p.period_number}"),
                            "created_at": p.created_at,
                            "updated_at": p.updated_at,
                        }
                        for p in periods
                    ]
                    schedules.append({
                        "id": "saturday",
                        "days": ["SATURDAY"],
                        "periods": sat_periods,
                    })

            result.append({
                "id": s.id,
                "school_id": s.school_id,
                "timetable_id": s.timetable_id,
                "name": s.name,
                "description": s.description,
                "is_default": s.is_default,
                "order_index": s.order_index,
                "version": s.version,
                "applicable_days": applicable_days,
                "schedules": schedules,
                "assigned_classes_count": len(assigned_sec_ids),
                "assigned_section_ids": assigned_sec_ids,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
            })
        return result

    def get_setup_read(self, school_id: UUID, setup_id: UUID) -> Dict[str, Any]:
        """
        Targeted, high-performance reader for a single setup.
        Avoids the 6-query full school scan of list_setups.
        """
        setup = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.id == setup_id,
                TimetableSetup.school_id == school_id,
                TimetableSetup.deleted_at.is_(None),
            )
            .first()
        )
        if not setup:
            raise NotFoundException("Setup not found.")

        # Read periods for this setup
        periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.setup_id == setup_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc())
            .all()
        )

        # Read assignments for this setup
        assigned_section_ids = [
            a[0]
            for a in self.db.query(TimetableSetupAssignment.target_id)
            .filter(
                TimetableSetupAssignment.setup_id == setup_id,
                TimetableSetupAssignment.target_type == "SECTION",
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            .all()
        ]

        # Applicable days
        applicable_days = []
        if setup.applicable_days:
            try:
                applicable_days = json.loads(setup.applicable_days)
            except Exception:
                applicable_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

        # Build schedules from canonical database periods
        periods_by_sch = {}
        for p in periods:
            sch_k = p.schedule_id or "regular"
            periods_by_sch.setdefault(sch_k, []).append({
                "id": str(p.id),
                "school_id": p.school_id,
                "timetable_id": p.timetable_id,
                "setup_id": p.setup_id,
                "schedule_id": p.schedule_id,
                "period_number": p.period_number,
                "start_time": _format_time(p.start_time),
                "end_time": _format_time(p.end_time),
                "is_break": p.is_break,
                "period_type": p.period_type,
                "label": p.label or ("RECESS" if p.is_break else f"P{p.period_number}"),
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            })

        schedules = []
        if setup.schedules_json:
            try:
                raw_schedules = json.loads(setup.schedules_json)
                for raw_sch in raw_schedules:
                    sch_id = raw_sch.get("id") or "regular"
                    sch_days = raw_sch.get("days") or []
                    sch_periods = periods_by_sch.get(sch_id)
                    if sch_periods is None:
                        if len(raw_schedules) == 1 and len(periods_by_sch) == 1:
                            sch_periods = list(periods_by_sch.values())[0]
                        else:
                            sch_periods = []
                    schedules.append({
                        "id": sch_id,
                        "days": sch_days,
                        "periods": sch_periods,
                    })
            except Exception:
                schedules = []

        if not schedules:
            schedules = [
                {
                    "id": "regular",
                    "days": [d for d in applicable_days if d != "SATURDAY"],
                    "periods": periods_by_sch.get("regular") or [
                        {
                            "id": str(p.id),
                            "school_id": p.school_id,
                            "timetable_id": p.timetable_id,
                            "setup_id": p.setup_id,
                            "schedule_id": p.schedule_id or "regular",
                            "period_number": p.period_number,
                            "start_time": _format_time(p.start_time),
                            "end_time": _format_time(p.end_time),
                            "is_break": p.is_break,
                            "period_type": p.period_type,
                            "label": p.label or ("RECESS" if p.is_break else f"P{p.period_number}"),
                            "created_at": p.created_at,
                            "updated_at": p.updated_at,
                        }
                        for p in periods
                    ],
                }
            ]
            if "SATURDAY" in applicable_days:
                schedules.append({
                    "id": "saturday",
                    "days": ["SATURDAY"],
                    "periods": periods_by_sch.get("saturday") or [
                        {
                            "id": str(p.id),
                            "school_id": p.school_id,
                            "timetable_id": p.timetable_id,
                            "setup_id": p.setup_id,
                            "schedule_id": p.schedule_id or "saturday",
                            "period_number": p.period_number,
                            "start_time": _format_time(p.start_time),
                            "end_time": _format_time(p.end_time),
                            "is_break": p.is_break,
                            "period_type": p.period_type,
                            "label": p.label or ("RECESS" if p.is_break else f"P{p.period_number}"),
                            "created_at": p.created_at,
                            "updated_at": p.updated_at,
                        }
                        for p in periods
                    ],
                })

        return {
            "id": setup.id,
            "school_id": setup.school_id,
            "timetable_id": setup.timetable_id,
            "name": setup.name,
            "description": setup.description,
            "is_default": setup.is_default,
            "order_index": setup.order_index,
            "version": setup.version,
            "applicable_days": applicable_days,
            "schedules": schedules,
            "assigned_classes_count": len(assigned_section_ids),
            "assigned_section_ids": assigned_section_ids,
            "created_at": setup.created_at,
            "updated_at": setup.updated_at,
        }

    def _touch_timetable(
        self,
        school_id: UUID,
        timetable_id: UUID,
        user_id: UUID,
        now: Optional[datetime] = None,
    ) -> Optional[Timetable]:
        """
        Locks the root aggregate Timetable row with FOR UPDATE and atomically increments
        its version counter and updated_at timestamp. Guarantees aggregate-level consistency
        across concurrent mutations.
        """
        now = now or datetime.now(timezone.utc)
        tt = (
            self.db.query(Timetable)
            .filter(
                Timetable.id == timetable_id,
                Timetable.school_id == school_id,
                Timetable.deleted_at.is_(None),
            )
            .with_for_update()
            .first()
        )
        if tt:
            tt.version = (tt.version or 1) + 1
            tt.updated_at = now
            tt.updated_by = user_id
        return tt

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

        self._touch_timetable(school_id, data.timetable_id, user_id)
        self.db.commit()
        self.db.refresh(setup)
        return setup

    def update_setup(self, school_id: UUID, setup_id: UUID, data: TimetableSetupUpdate, user_id: UUID) -> TimetableSetup:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .with_for_update()
            .first()
        )
        if not s:
            raise NotFoundException("Setup not found.")

        if data.version is not None and (s.version or 1) != int(data.version):
            raise ConflictException(f"Setup '{s.name}' has been modified by another user. Please reload.")

        if data.name is not None:
            s.name = data.name
        if data.description is not None:
            s.description = data.description
        if data.is_default is not None:
            s.is_default = data.is_default
        if data.order_index is not None:
            s.order_index = data.order_index
        if data.applicable_days is not None:
            s.applicable_days = json.dumps(data.applicable_days)

        if data.schedules is not None:
            all_errors = []
            for sch in data.schedules:
                errs, _ = validate_period_sequence([p.model_dump(mode="json") for p in sch.periods], sch.id or "Schedule")
                all_errors.extend(errs)
            day_errs = validate_setup_day_invariants({"name": s.name, "schedules": [sch.model_dump(mode="json") for sch in data.schedules]})
            all_errors.extend(day_errs)
            if all_errors:
                raise UnprocessableEntityException("Schedule validation failed", errors=all_errors)
            s.schedules_json = json.dumps([sch.model_dump(mode="json") for sch in data.schedules], default=str)

        s.version = (s.version or 1) + 1
        s.updated_by = user_id
        s.updated_at = datetime.now(timezone.utc)
        self._touch_timetable(school_id, s.timetable_id, user_id)
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

        max_order = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.timetable_id == s.timetable_id, TimetableSetup.deleted_at.is_(None))
            .count()
        )

        dup = TimetableSetup(
            school_id=school_id,
            timetable_id=s.timetable_id,
            name=f"Copy of {s.name}",
            description=s.description,
            is_default=False,
            order_index=max_order,
            version=1,
            applicable_days=s.applicable_days,
            schedules_json=s.schedules_json,
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
                schedule_id=p.schedule_id,
                period_type=p.period_type,
                period_number=p.period_number,
                start_time=p.start_time,
                end_time=p.end_time,
                is_break=p.is_break,
                label=p.label,
                created_by=user_id,
                updated_by=user_id,
            )
            self.db.add(cloned_p)

        self._touch_timetable(school_id, s.timetable_id, user_id)
        self.db.commit()
        self._touch_timetable(school_id, s.timetable_id, user_id)
        self.db.commit()
        self.db.refresh(dup)
        return dup

    def delete_setup(self, school_id: UUID, setup_id: UUID, user_id: UUID) -> None:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .with_for_update()
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

        assigned_count = (
            self.db.query(TimetableSetupAssignment)
            .filter(
                TimetableSetupAssignment.setup_id == setup_id,
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            .count()
        )
        if assigned_count > 0:
            raise BadRequestException("Cannot delete a setup that has assigned classes. Please move classes to another setup first.")

        now = datetime.now(timezone.utc)
        s.deleted_at = now
        s.deleted_by = user_id

        # Also soft-delete all periods belonging to this setup
        periods = self.db.query(TimetablePeriod).filter(
            TimetablePeriod.setup_id == setup_id,
            TimetablePeriod.deleted_at.is_(None),
        ).all()
        period_ids = [p.id for p in periods]
        for p in periods:
            p.deleted_at = now
            p.deleted_by = user_id

        # Also soft-delete any timetable entries associated with these periods
        if period_ids:
            self.db.query(TimetableEntry).filter(
                TimetableEntry.period_id.in_(period_ids),
                TimetableEntry.deleted_at.is_(None),
            ).update(
                {"deleted_at": now, "deleted_by": user_id},
                synchronize_session=False,
            )

        self._touch_timetable(school_id, s.timetable_id, user_id, now)
        self.db.commit()

    def split_days(self, school_id: UUID, data: Any, user_id: UUID) -> TimetableSetup:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == data.setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .with_for_update()
            .first()
        )
        if not s:
            raise NotFoundException("Setup not found.")

        schedules = json.loads(s.schedules_json) if s.schedules_json else []
        source_sched = next((sch for sch in schedules if sch.get("id") == data.schedule_id), None)
        if not source_sched:
            raise NotFoundException("Source schedule not found.")

        if len(source_sched.get("days", [])) <= len(data.days):
            raise BadRequestException("Cannot split all days from schedule. At least one day must remain.")

        remaining_days = [d for d in source_sched["days"] if d not in data.days]
        source_sched["days"] = remaining_days

        new_sched_id = f"sched-{int(datetime.now().timestamp() * 1000)}"
        new_sched = {
            "id": new_sched_id,
            "days": data.days,
            "periods": [dict(p) for p in source_sched.get("periods", [])],
        }
        schedules.append(new_sched)

        now = datetime.now(timezone.utc)
        s.schedules_json = json.dumps(schedules, default=str)
        s.version = (s.version or 1) + 1
        s.updated_by = user_id
        s.updated_at = now
        self._touch_timetable(school_id, s.timetable_id, user_id, now)
        self.db.commit()
        self.db.refresh(s)
        return s

    def merge_days(self, school_id: UUID, data: Any, user_id: UUID) -> TimetableSetup:
        s = (
            self.db.query(TimetableSetup)
            .filter(TimetableSetup.id == data.setup_id, TimetableSetup.school_id == school_id, TimetableSetup.deleted_at.is_(None))
            .with_for_update()
            .first()
        )
        if not s:
            raise NotFoundException("Setup not found.")

        schedules = json.loads(s.schedules_json) if s.schedules_json else []
        source_sched = next((sch for sch in schedules if sch.get("id") == data.source_schedule_id), None)
        target_sched = next((sch for sch in schedules if sch.get("id") == data.target_schedule_id), None)
        if not source_sched or not target_sched:
            raise NotFoundException("Schedule not found.")

        target_sched["days"] = list(dict.fromkeys(target_sched.get("days", []) + source_sched.get("days", [])))
        schedules = [sch for sch in schedules if sch.get("id") != data.source_schedule_id]

        now = datetime.now(timezone.utc)
        s.schedules_json = json.dumps(schedules, default=str)
        s.version = (s.version or 1) + 1
        s.updated_by = user_id
        s.updated_at = now
        self._touch_timetable(school_id, s.timetable_id, user_id, now)
        self.db.commit()
        self.db.refresh(s)
        return s

    def move_classes(self, school_id: UUID, data: Any, user_id: UUID) -> Dict[str, Any]:
        self.get_timetable_by_id(school_id, data.timetable_id)
        target_setup = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.id == data.target_setup_id,
                TimetableSetup.timetable_id == data.timetable_id,
                TimetableSetup.deleted_at.is_(None),
            )
            .with_for_update()
            .first()
        )
        if not target_setup:
            raise NotFoundException("Target setup not found.")

        now = datetime.now(timezone.utc)
        for sec_id in data.section_ids:
            existing = (
                self.db.query(TimetableSetupAssignment)
                .filter(
                    TimetableSetupAssignment.timetable_id == data.timetable_id,
                    TimetableSetupAssignment.target_type == "SECTION",
                    TimetableSetupAssignment.target_id == sec_id,
                )
                .first()
            )
            if existing:
                existing.setup_id = target_setup.id
                existing.updated_by = user_id
                existing.updated_at = now
            else:
                new_assign = TimetableSetupAssignment(
                    school_id=school_id,
                    timetable_id=data.timetable_id,
                    setup_id=target_setup.id,
                    target_type="SECTION",
                    target_id=sec_id,
                    created_by=user_id,
                    updated_by=user_id,
                )
                self.db.add(new_assign)

        # Clear existing timetable entries for the moved sections so user starts fresh under new bell timings
        if data.section_ids:
            self.db.query(TimetableEntry).filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.timetable_id == data.timetable_id,
                TimetableEntry.section_id.in_(data.section_ids),
                TimetableEntry.deleted_at.is_(None),
            ).update(
                {"deleted_at": now, "deleted_by": user_id},
                synchronize_session=False,
            )

        self._touch_timetable(school_id, data.timetable_id, user_id, now)
        self.db.commit()
        return {"message": f"Moved {len(data.section_ids)} class(es) to {target_setup.name} and cleared old lecture slots for reassignment."}

    def preview_setups_impact(
        self,
        school_id: UUID,
        timetable_id: UUID,
        data: BatchSetupAssignmentsRequest,
    ) -> Dict[str, Any]:
        """Detect any slot removals or changes that would impact existing assignments."""
        affected_entries = []
        setups_data = [
            s.model_dump(mode="json") if hasattr(s, "model_dump") else (dict(s) if isinstance(s, dict) else s)
            for s in data.setups
        ]
        for setup_dict in setups_data:
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
            periods_list = setup_dict.get("periods") or []
            if not periods_list and setup_dict.get("schedules"):
                for sch in setup_dict.get("schedules"):
                    periods_list.extend(sch.get("periods", []))
            new_period_nums = {p.get("period_number") for p in periods_list}
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
        Enforces zero orphan sections and complete schedule invariants.
        """
        now = datetime.now(timezone.utc)
        root_tt = self._touch_timetable(school_id, timetable_id, user_id, now)
        if not root_tt:
            raise NotFoundException("Timetable not found.")

        setups_data = [
            s.model_dump(mode="json") if hasattr(s, "model_dump") else (dict(s) if isinstance(s, dict) else s)
            for s in data.setups
        ]

        # 1. Optimistic concurrency check: lock existing setups and verify versions
        existing_db_setups = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.timetable_id == timetable_id,
                TimetableSetup.deleted_at.is_(None),
            )
            .with_for_update()
            .all()
        )
        existing_setups_by_id = {s.id: s for s in existing_db_setups}

        for s_data in setups_data:
            s_id_str = s_data.get("id")
            s_version = s_data.get("version")
            if s_id_str:
                try:
                    s_id = UUID(str(s_id_str))
                    existing = existing_setups_by_id.get(s_id)
                    if existing:
                        if s_version is not None and (existing.version or 1) != int(s_version):
                            raise ConflictException(
                                f"Setup '{existing.name}' has been modified by another user (expected version {s_version}, current {existing.version}). Please reload."
                            )
                except ValueError:
                    pass

        # 2. Validation across all setups and schedules
        all_validation_errors = []
        for s_data in setups_data:
            s_name = s_data.get("name") or "Setup"
            schedules = s_data.get("schedules")
            if schedules:
                for sch in schedules:
                    sch_id = sch.get("id") or "Schedule"
                    errs, _ = validate_period_sequence(sch.get("periods") or [], f"{s_name} - {sch_id}")
                    all_validation_errors.extend(errs)
                day_errs = validate_setup_day_invariants({"name": s_name, "schedules": schedules})
                all_validation_errors.extend(day_errs)
            elif s_data.get("periods"):
                errs, _ = validate_period_sequence(s_data.get("periods") or [], s_name)
                all_validation_errors.extend(errs)

        if all_validation_errors:
            raise UnprocessableEntityException("Validation error in bell schedule", errors=all_validation_errors)

        # 3. Check orphan sections
        all_sections = (
            self.db.query(Section)
            .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
            .all()
        )
        assigned_sec_ids = {a.target_id for a in data.assignments if a.target_type == "SECTION"}
        if len(all_sections) > 0 and len(assigned_sec_ids) < len(all_sections):
            # Check if any section was missed
            missing_secs = [s.id for s in all_sections if s.id not in assigned_sec_ids]
            if missing_secs:
                raise UnprocessableEntityException("Every class section must be assigned to a bell setup.")

        # Preload all active periods for this timetable in a single batched query
        all_existing_periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.timetable_id == timetable_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .all()
        )
        existing_periods_by_setup: Dict[UUID, List[TimetablePeriod]] = {}
        for p in all_existing_periods:
            existing_periods_by_setup.setdefault(p.setup_id, []).append(p)

        # 4. Save setups and sync periods
        setup_id_map = {}

        for idx, s_data in enumerate(setups_data):
            s_id_str = s_data.get("id")
            s_name = s_data.get("name") or f"Setup {idx + 1}"
            s_desc = s_data.get("description")
            is_def = bool(s_data.get("is_default", idx == 0))
            app_days = s_data.get("applicable_days") or ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
            app_days_json = json.dumps(app_days, default=str) if isinstance(app_days, list) else str(app_days)
            schedules_list = s_data.get("schedules")
            schedules_json = json.dumps(schedules_list, default=str) if schedules_list else None

            setup_obj = None
            if s_id_str:
                try:
                    s_id = UUID(str(s_id_str))
                    setup_obj = existing_setups_by_id.get(s_id)
                except ValueError:
                    setup_obj = None

            if not setup_obj:
                new_setup_kwargs = {
                    "school_id": school_id,
                    "timetable_id": timetable_id,
                    "name": s_name,
                    "description": s_desc,
                    "is_default": is_def,
                    "order_index": idx,
                    "version": 1,
                    "applicable_days": app_days_json,
                    "schedules_json": schedules_json,
                    "created_by": user_id,
                    "updated_by": user_id,
                }
                if s_id_str:
                    try:
                        new_setup_kwargs["id"] = UUID(str(s_id_str))
                    except ValueError:
                        pass
                setup_obj = TimetableSetup(**new_setup_kwargs)
                self.db.add(setup_obj)
                self.db.flush()
            else:
                setup_obj.name = s_name
                setup_obj.description = s_desc
                setup_obj.is_default = is_def
                setup_obj.order_index = idx
                setup_obj.version = (setup_obj.version or 1) + 1
                setup_obj.applicable_days = app_days_json
                if schedules_json:
                    setup_obj.schedules_json = schedules_json
                setup_obj.updated_by = user_id
                setup_obj.updated_at = now

            if s_id_str:
                setup_id_map[str(s_id_str)] = setup_obj.id
            setup_id_map[str(setup_obj.id)] = setup_obj.id

            # Flatten periods from schedules if available, else from s_data.get("periods")
            periods_list = []
            if schedules_list:
                for sch in schedules_list:
                    sch_id = sch.get("id") or "default"
                    for p in sch.get("periods", []):
                        p_copy = dict(p)
                        p_copy["schedule_id"] = sch_id
                        periods_list.append(p_copy)
            elif s_data.get("periods"):
                periods_list = s_data.get("periods")

            existing_periods = existing_periods_by_setup.get(setup_obj.id, []) if setup_obj else []
            existing_by_id = {str(p.id): p for p in existing_periods}
            existing_by_key = {(p.schedule_id or "default", p.period_number): p for p in existing_periods}
            used_period_ids = set()
            period_id_by_key = {}

            for p_item in periods_list:
                p_num = int(p_item.get("period_number", 1))
                sch_id = p_item.get("schedule_id") or "default"
                raw_pid = str(p_item.get("id")) if p_item.get("id") else None
                st = _parse_time(p_item.get("start_time", "08:30"))
                et = _parse_time(p_item.get("end_time", "09:15"))
                is_brk = bool(p_item.get("is_break", False))
                p_type = p_item.get("type") or ("RECESS" if is_brk else "CLASS")
                lbl = p_item.get("label") or ("RECESS" if is_brk else f"P{p_num}")
                key = (sch_id, p_num)

                ep = None
                if raw_pid and raw_pid in existing_by_id and raw_pid not in used_period_ids:
                    ep = existing_by_id[raw_pid]
                elif key in existing_by_key and str(existing_by_key[key].id) not in used_period_ids:
                    ep = existing_by_key[key]
                else:
                    # Fallback: match by period_number if schedule changed (e.g. 'default' -> 'regular')
                    for p_cand in existing_periods:
                        if p_cand.period_number == p_num and str(p_cand.id) not in used_period_ids:
                            ep = p_cand
                            break

                if ep:
                    used_period_ids.add(str(ep.id))
                    ep.schedule_id = sch_id
                    ep.period_number = p_num
                    ep.start_time = st
                    ep.end_time = et
                    ep.is_break = is_brk
                    ep.period_type = p_type
                    ep.label = lbl
                    ep.updated_by = user_id
                    ep.updated_at = now
                    period_id_by_key[key] = ep.id
                else:
                    new_p = TimetablePeriod(
                        school_id=school_id,
                        timetable_id=timetable_id,
                        setup_id=setup_obj.id,
                        schedule_id=sch_id,
                        period_number=p_num,
                        start_time=st,
                        end_time=et,
                        is_break=is_brk,
                        period_type=p_type,
                        label=lbl,
                        created_by=user_id,
                        updated_by=user_id,
                    )
                    self.db.add(new_p)
                    self.db.flush()
                    period_id_by_key[key] = new_p.id

            # For any existing period that was not reused:
            # Soft-delete it and safely migrate or soft-delete its active timetable entries
            for ep in existing_periods:
                if str(ep.id) not in used_period_ids:
                    ep.deleted_at = now
                    ep.deleted_by = user_id

                    active_entries = (
                        self.db.query(TimetableEntry)
                        .filter(
                            TimetableEntry.period_id == ep.id,
                            TimetableEntry.deleted_at.is_(None),
                        )
                        .all()
                    )
                    for ae in active_entries:
                        day_upper = ae.day_of_week.upper()
                        replacement_id = None
                        # Check schedule matching day first
                        for k, r_id in period_id_by_key.items():
                            k_sch, k_num = k
                            if k_num == ep.period_number:
                                if day_upper == "SATURDAY" and "saturday" in str(k_sch).lower():
                                    replacement_id = r_id
                                    break
                                elif day_upper != "SATURDAY" and "saturday" not in str(k_sch).lower():
                                    replacement_id = r_id
                                    break
                        if not replacement_id:
                            for k, r_id in period_id_by_key.items():
                                if k[1] == ep.period_number:
                                    replacement_id = r_id
                                    break

                        if replacement_id:
                            ae.period_id = replacement_id
                            ae.updated_at = now
                            ae.updated_by = user_id
                        else:
                            ae.deleted_at = now
                            ae.deleted_by = user_id

            # Sync real UUIDs back into schedules_list and persist to setup_obj.schedules_json
            if schedules_list:
                for sch in schedules_list:
                    sch_id = sch.get("id") or "default"
                    for p in sch.get("periods", []):
                        p_num = int(p.get("period_number", 1))
                        real_p_id = period_id_by_key.get((sch_id, p_num))
                        if real_p_id:
                            p["id"] = str(real_p_id)
                setup_obj.schedules_json = json.dumps(schedules_list, default=str)

        # Soft-delete removed setups
        saved_setup_ids = set(setup_id_map.values())
        for old_s in existing_db_setups:
            if old_s.id not in saved_setup_ids:
                old_s.deleted_at = now
                old_s.deleted_by = user_id

        # Identify sections whose setup has changed to clear their old entries
        old_assignments = (
            self.db.query(TimetableSetupAssignment)
            .filter(
                TimetableSetupAssignment.timetable_id == timetable_id,
                TimetableSetupAssignment.target_type == "SECTION",
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            .all()
        )
        old_section_setup_map = {a.target_id: a.setup_id for a in old_assignments}
        sections_with_changed_setups = []

        # 5. Clear and insert assignments atomically
        self.db.query(TimetableSetupAssignment).filter(
            TimetableSetupAssignment.timetable_id == timetable_id,
        ).delete(synchronize_session=False)

        for assign_item in data.assignments:
            raw_setup_id = str(assign_item.setup_id)
            target_setup_id = setup_id_map.get(raw_setup_id, assign_item.setup_id)
            if isinstance(target_setup_id, str):
                try:
                    target_setup_id = UUID(target_setup_id)
                except ValueError:
                    continue
            if not target_setup_id:
                continue
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

            if assign_item.target_type == "SECTION":
                old_setup = old_section_setup_map.get(assign_item.target_id)
                if old_setup and old_setup != target_setup_id:
                    sections_with_changed_setups.append(assign_item.target_id)

        # Clear existing entries for sections whose setup changed so user reassigns cleanly
        if sections_with_changed_setups:
            self.db.query(TimetableEntry).filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.timetable_id == timetable_id,
                TimetableEntry.section_id.in_(sections_with_changed_setups),
                TimetableEntry.deleted_at.is_(None),
            ).update(
                {"deleted_at": now, "deleted_by": user_id},
                synchronize_session=False,
            )

        self.db.flush()
        self._sync_timetable_entries_with_setups(school_id, timetable_id, user_id, all_sections=all_sections)
        self.db.commit()
        return self.list_setups(school_id, timetable_id)

    def _sync_timetable_entries_with_setups(
        self,
        school_id: UUID,
        timetable_id: UUID,
        user_id: Optional[UUID] = None,
        all_sections: Optional[List[Section]] = None,
    ) -> int:
        """
        Synchronize timetable entries' period_id foreign keys so they always point
        to the exact period of the section's active bell setup and applicable day schedule.
        This ensures that when setups are assigned to sections or bell timings change,
        all timetable entries operate at their true, updated start/end times.
        """
        now = datetime.now(timezone.utc)
        setups = (
            self.db.query(TimetableSetup)
            .filter(
                TimetableSetup.timetable_id == timetable_id,
                TimetableSetup.deleted_at.is_(None),
            )
            .all()
        )
        if not setups:
            return 0

        default_setup = next((s for s in setups if s.is_default), setups[0])
        default_setup_id = default_setup.id

        assignments = (
            self.db.query(TimetableSetupAssignment)
            .filter(
                TimetableSetupAssignment.timetable_id == timetable_id,
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            .all()
        )
        if all_sections is None:
            all_sections = (
                self.db.query(Section)
                .filter(Section.school_id == school_id, Section.deleted_at.is_(None))
                .all()
            )
        wing_classes = (
            self.db.query(WingClass)
            .filter(WingClass.school_id == school_id, WingClass.deleted_at.is_(None))
            .all()
        )
        class_to_wing = {wc.class_id: wc.wing_id for wc in wing_classes}

        sections_by_class: Dict[UUID, List[Section]] = {}
        sections_by_wing: Dict[UUID, List[Section]] = {}
        for s in all_sections:
            sections_by_class.setdefault(s.class_id, []).append(s)
            w_id = class_to_wing.get(s.class_id)
            if w_id:
                sections_by_wing.setdefault(w_id, []).append(s)

        sec_to_setup: Dict[UUID, UUID] = {}
        for a in assignments:
            if a.target_type == "SECTION":
                sec_to_setup[a.target_id] = a.setup_id
            elif a.target_type == "CLASS":
                for s in sections_by_class.get(a.target_id, []):
                    if s.id not in sec_to_setup:
                        sec_to_setup[s.id] = a.setup_id
            elif a.target_type == "WING":
                for s in sections_by_wing.get(a.target_id, []):
                    if s.id not in sec_to_setup:
                        sec_to_setup[s.id] = a.setup_id

        # Preload all active periods for all setups in this timetable
        all_periods = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.timetable_id == timetable_id,
                TimetablePeriod.deleted_at.is_(None),
            )
            .all()
        )

        # Build lookup table: (setup_id, day_upper, period_number) -> TimetablePeriod
        # and fallback (setup_id, period_number) -> TimetablePeriod
        setup_period_map: Dict[Tuple[UUID, str, int], TimetablePeriod] = {}
        setup_period_fallback: Dict[Tuple[UUID, int], TimetablePeriod] = {}

        periods_by_setup: Dict[UUID, List[TimetablePeriod]] = {}
        for p in all_periods:
            periods_by_setup.setdefault(p.setup_id, []).append(p)

        for s in setups:
            s_periods = periods_by_setup.get(s.id, [])
            periods_by_id = {str(p.id): p for p in s_periods}
            periods_by_num = {p.period_number: p for p in s_periods}

            # If setup has schedules_json, parse schedule days
            if s.schedules_json:
                try:
                    schedules = json.loads(s.schedules_json)
                    for sch in schedules:
                        days = [d.upper() for d in sch.get("days", [])]
                        for p_data in sch.get("periods", []):
                            p_num = int(p_data.get("period_number", 1))
                            pid_str = str(p_data.get("id"))
                            matched_p = periods_by_id.get(pid_str) or periods_by_num.get(p_num)
                            if matched_p:
                                for d in days:
                                    setup_period_map[(s.id, d, p_num)] = matched_p
                                if (s.id, p_num) not in setup_period_fallback:
                                    setup_period_fallback[(s.id, p_num)] = matched_p
                except Exception:
                    pass

            # Fallback for periods in setup
            for p in s_periods:
                if (s.id, p.period_number) not in setup_period_fallback:
                    setup_period_fallback[(s.id, p.period_number)] = p

        # Query all active entries for this timetable
        entries = (
            self.db.query(TimetableEntry)
            .outerjoin(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(joinedload(TimetableEntry.period))
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.timetable_id == timetable_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .all()
        )

        synced = 0
        existing_slot_keys = {
            (e.timetable_id, e.section_id, (e.day_of_week or "").upper(), e.period_id)
            for e in entries
        }

        for e in entries:
            expected_setup_id = sec_to_setup.get(e.section_id, default_setup_id)
            day_upper = (e.day_of_week or "").upper()
            p_num = e.period.period_number if e.period else None
            if p_num is None:
                continue

            matching_p = setup_period_map.get((expected_setup_id, day_upper, p_num)) or setup_period_fallback.get((expected_setup_id, p_num))
            if matching_p and e.period_id != matching_p.id:
                new_slot_key = (timetable_id, e.section_id, day_upper, matching_p.id)
                if new_slot_key in existing_slot_keys:
                    # Slot already occupied in this timetable; skip remapping this entry to avoid unique constraint conflict
                    continue
                old_slot_key = (timetable_id, e.section_id, day_upper, e.period_id)
                existing_slot_keys.discard(old_slot_key)
                existing_slot_keys.add(new_slot_key)
                e.period_id = matching_p.id
                e.period = matching_p
                e.updated_at = now
                if user_id:
                    e.updated_by = user_id
                synced += 1

        if synced > 0:
            self.db.flush()
        return synced

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
        all_timetables = self.list_timetables(school_id)
        if timetable_id:
            current_tt = next((tt for tt in all_timetables if tt.id == timetable_id), None)
            if not current_tt:
                current_tt = self.get_timetable_by_id(school_id, timetable_id)
        else:
            current_tt = next((tt for tt in all_timetables if tt.is_active), None)
            if not current_tt:
                current_tt = self.get_active_timetable(school_id)

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
            .options(joinedload(Section.class_teacher).joinedload(User.staff_profile))
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

        active_setup_ids = {s_item["id"] for s_item in setups_data}

        entries = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(
                joinedload(TimetableEntry.subject).joinedload(Subject.parent),
                joinedload(TimetableEntry.teacher).joinedload(User.staff_profile),
                joinedload(TimetableEntry.period),
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                or_(
                    TimetableEntry.timetable_id == current_tt.id,
                    TimetableEntry.timetable_id.is_(None),
                ),
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.is_(None),
                or_(
                    TimetablePeriod.setup_id.in_(active_setup_ids),
                    TimetablePeriod.setup_id.is_(None),
                ) if active_setup_ids else True,
            )
            .all()
        )

        entries_by_section: Dict[UUID, List[TimetableEntry]] = {}
        for e in entries:
            entries_by_section.setdefault(e.section_id, []).append(e)

        class_subjects = (
            self.db.query(ClassSubject)
            .options(
                joinedload(ClassSubject.subject),
                joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
            )
            .filter(ClassSubject.school_id == school_id, ClassSubject.deleted_at.is_(None))
            .all()
        )
        cs_by_class_and_sec: Dict[Tuple[UUID, Optional[UUID]], List[ClassSubject]] = {}
        for cs in class_subjects:
            cs_by_class_and_sec.setdefault((cs.class_id, cs.section_id), []).append(cs)

        # Build lookup for assigned subject teacher per section (section-specific first, then class-level fallback)
        sec_sub_teacher_map: Dict[Tuple[UUID, UUID], Any] = {}
        for cs in class_subjects:
            if cs.teacher and not cs.teacher.deleted_at and cs.subject_id and cs.section_id:
                sec_sub_teacher_map[(cs.section_id, cs.subject_id)] = cs.teacher

        for s in all_sections:
            for cs in cs_by_class_and_sec.get((s.class_id, None), []):
                if cs.teacher and not cs.teacher.deleted_at and cs.subject_id:
                    if (s.id, cs.subject_id) not in sec_sub_teacher_map:
                        sec_sub_teacher_map[(s.id, cs.subject_id)] = cs.teacher

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

                    setup_periods = []
                    if setup_obj:
                        obj_scheds = setup_obj.get("schedules") or []
                        if obj_scheds and obj_scheds[0].get("periods"):
                            setup_periods = obj_scheds[0]["periods"]
                        else:
                            setup_periods = setup_obj.get("periods", [])
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
                        tch = sec_sub_teacher_map.get((s.id, sub.id))
                        if tch and getattr(tch, "deleted_at", None):
                            tch = None
                        sp = tch.staff_profile if tch else None
                        subject_stats.append({
                            "subject_id": sub.id,
                            "name": sub.name,
                            "code": sub.code,
                            "category": sub.category,
                            "is_academic": sub.is_academic,
                            "assigned": assigned_cnt,
                            "target": target_cnt,
                            "status": "normal" if assigned_cnt == target_cnt else ("under" if assigned_cnt < target_cnt else "over"),
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

                    for sub_id, cnt in sub_counts.items():
                        if sub_id not in seen_subs:
                            e_match = next((e for e in sec_entries if e.subject_id == sub_id), None)
                            if e_match and e_match.subject:
                                tch = sec_sub_teacher_map.get((s.id, sub_id)) or e_match.teacher
                                if tch and getattr(tch, "deleted_at", None):
                                    tch = None
                                sp = tch.staff_profile if tch else None
                                subject_stats.append({
                                    "subject_id": sub_id,
                                    "name": e_match.subject.name,
                                    "code": e_match.subject.code,
                                    "category": e_match.subject.category,
                                    "is_academic": e_match.subject.is_academic,
                                    "assigned": cnt,
                                    "target": 6 if e_match.subject.is_academic else 3,
                                    "status": "normal" if cnt == 6 else ("under" if cnt < 6 else "over"),
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

                    unassigned_count = max(0, total_expected_slots - len(sec_entries))
                    total_unassigned_slots += unassigned_count

                    ct_user = getattr(s, "class_teacher", None)
                    ct_name = f"{ct_user.first_name} {ct_user.last_name}".strip() if ct_user else None

                    sections_summary.append({
                        "id": s.id,
                        "name": s.name,
                        "class_id": c.id,
                        "class_name": c.name,
                        "class_teacher_id": s.class_teacher_id,
                        "class_teacher_name": ct_name,
                        "class_teacher": {
                            "id": ct_user.id,
                            "name": ct_name,
                            "first_name": ct_user.first_name,
                            "last_name": ct_user.last_name,
                            "email": ct_user.email,
                        } if ct_user else None,
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
            t = e.teacher or sec_sub_teacher_map.get((e.section_id, e.subject_id))
            if t and not getattr(t, "deleted_at", None):
                teacher_day_entries.setdefault((t.id, e.day_of_week), []).append(e)

        for (t_id, day), t_entries in teacher_day_entries.items():
            if len(t_entries) > 1:
                adj: Dict[UUID, List[TimetableEntry]] = {e.id: [] for e in t_entries}
                for i in range(len(t_entries)):
                    for j in range(i + 1, len(t_entries)):
                        e1 = t_entries[i]
                        e2 = t_entries[j]
                        p1 = e1.period
                        p2 = e2.period
                        if p1 and p2 and p1.start_time and p1.end_time and p2.start_time and p2.end_time:
                            if max(p1.start_time, p2.start_time) < min(p1.end_time, p2.end_time):
                                adj[e1.id].append(e2)
                                adj[e2.id].append(e1)

                visited = set()
                for e in t_entries:
                    if e.id not in visited and adj[e.id]:
                        cluster = []
                        queue = [e]
                        visited.add(e.id)
                        while queue:
                            curr = queue.pop(0)
                            cluster.append(curr)
                            for neighbor in adj[curr.id]:
                                if neighbor.id not in visited:
                                    visited.add(neighbor.id)
                                    queue.append(neighbor)
                        if len(cluster) > 1:
                            conflicts_count += 1

        entries_read = []
        for e in entries:
            t = e.teacher or sec_sub_teacher_map.get((e.section_id, e.subject_id))
            if t and getattr(t, "deleted_at", None):
                t = None
            sp = t.staff_profile if t else None
            entries_read.append({
                "id": e.id,
                "school_id": e.school_id,
                "timetable_id": e.timetable_id,
                "section_id": e.section_id,
                "period_id": e.period_id,
                "period_number": e.period.period_number if e.period else 0,
                "day_of_week": e.day_of_week,
                "subject_id": e.subject_id,
                "teacher_user_id": t.id if t else None,
                "period": {
                    "id": e.period.id,
                    "period_number": e.period.period_number,
                    "start_time": _format_time(e.period.start_time),
                    "end_time": _format_time(e.period.end_time),
                    "label": e.period.label,
                    "is_break": e.period.is_break,
                    "period_type": e.period.period_type,
                } if e.period else None,
                "section": {
                    "id": e.section.id,
                    "name": e.section.name,
                    "class_id": e.section.class_id,
                    "class_name": e.section.school_class.name if e.section and e.section.school_class else "",
                } if e.section else None,
                "subject": {
                    "id": e.subject.id,
                    "name": e.subject.name,
                    "code": e.subject.code,
                    "category": e.subject.category,
                    "is_academic": e.subject.is_academic,
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
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            })

        # Map sections where each teacher is assigned as class teacher
        teacher_ct_map: Dict[UUID, List[Dict[str, Any]]] = {}
        for s in all_sections:
            if s.class_teacher_id:
                c_obj = class_map.get(s.class_id)
                c_name = c_obj.name if c_obj else "Class"
                s_name = s.name or ""
                label = f"{c_name} {s_name}".strip()
                teacher_ct_map.setdefault(s.class_teacher_id, []).append({
                    "section_id": s.id,
                    "section_name": s_name,
                    "class_id": s.class_id,
                    "class_name": c_name,
                    "label": label,
                })

        enriched_eligible_teachers = []
        for t_dict in eligible_teachers:
            t_copy = dict(t_dict)
            t_id = t_copy.get("id")
            t_copy["class_teacher_of"] = teacher_ct_map.get(t_id, [])
            enriched_eligible_teachers.append(t_copy)

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
                    "completion_percentage": getattr(t, "completion_percentage", 0.0),
                    "created_at": t.created_at,
                    "updated_at": t.updated_at,
                }
                for t in all_timetables
            ],
            "wings": wings_summary,
            "setups": setups_data,
            "entries": entries_read,
            "eligible_teachers": enriched_eligible_teachers,
            "stats": {
                "total_classes": total_classes_count,
                "total_sections": total_sections_count,
                "assigned_slots": total_assigned_slots,
                "unassigned_slots": total_unassigned_slots,
                "conflicts_count": conflicts_count,
            },
        }

    def _resolve_period(
        self,
        period_id_input: Any,
        school_id: Optional[UUID] = None,
        section_id: Optional[UUID] = None,
        timetable_id: Optional[UUID] = None,
        section: Optional[Section] = None,
    ) -> Optional[TimetablePeriod]:
        """
        Resolves a period input (which may be a valid UUID, a UUID string, or a legacy/temporary
        client identifier like 'p-3-1794130451420') into a persistent TimetablePeriod database record.
        """
        if not period_id_input:
            return None

        # 1. If it's already a UUID or can be parsed as a valid UUID
        period_uuid = None
        if isinstance(period_id_input, UUID):
            period_uuid = period_id_input
        elif isinstance(period_id_input, str):
            try:
                period_uuid = UUID(period_id_input)
            except (ValueError, AttributeError):
                period_uuid = None

        if period_uuid:
            p = (
                self.db.query(TimetablePeriod)
                .filter(TimetablePeriod.id == period_uuid, TimetablePeriod.deleted_at.is_(None))
                .first()
            )
            if p:
                effective_tt_id = timetable_id or p.timetable_id
                sec = section
                if not sec and section_id:
                    sec = self.db.query(Section).filter(Section.id == section_id, Section.deleted_at.is_(None)).first()
                if sec:
                    assign_q = self.db.query(TimetableSetupAssignment).filter(
                        TimetableSetupAssignment.target_type == "SECTION",
                        TimetableSetupAssignment.target_id == sec.id,
                        TimetableSetupAssignment.deleted_at.is_(None),
                    )
                    if effective_tt_id:
                        assign_q = assign_q.filter(TimetableSetupAssignment.timetable_id == effective_tt_id)
                    assign = assign_q.first()

                    if not assign and sec.class_id:
                        assign_class_q = self.db.query(TimetableSetupAssignment).filter(
                            TimetableSetupAssignment.target_type == "CLASS",
                            TimetableSetupAssignment.target_id == sec.class_id,
                            TimetableSetupAssignment.deleted_at.is_(None),
                        )
                        if effective_tt_id:
                            assign_class_q = assign_class_q.filter(TimetableSetupAssignment.timetable_id == effective_tt_id)
                        assign = assign_class_q.first()

                    if assign and assign.setup_id != p.setup_id:
                        matched_p = (
                            self.db.query(TimetablePeriod)
                            .filter(
                                TimetablePeriod.setup_id == assign.setup_id,
                                TimetablePeriod.period_number == p.period_number,
                                TimetablePeriod.deleted_at.is_(None),
                            )
                            .first()
                        )
                        if matched_p:
                            return matched_p
                return p

        # 2. String ID resolution (e.g. 'p-3-1794130451420')
        raw_str = str(period_id_input).strip()

        # Determine target section
        sec = section
        if not sec and section_id:
            sec = self.db.query(Section).filter(Section.id == section_id, Section.deleted_at.is_(None)).first()

        # Find target setup
        setup_id = None
        if sec:
            assign_q = self.db.query(TimetableSetupAssignment).filter(
                TimetableSetupAssignment.target_type == "SECTION",
                TimetableSetupAssignment.target_id == sec.id,
                TimetableSetupAssignment.deleted_at.is_(None),
            )
            if timetable_id:
                assign_q = assign_q.filter(TimetableSetupAssignment.timetable_id == timetable_id)
            assign = assign_q.first()

            if not assign and sec.class_id:
                assign_class_q = self.db.query(TimetableSetupAssignment).filter(
                    TimetableSetupAssignment.target_type == "CLASS",
                    TimetableSetupAssignment.target_id == sec.class_id,
                    TimetableSetupAssignment.deleted_at.is_(None),
                )
                if timetable_id:
                    assign_class_q = assign_class_q.filter(TimetableSetupAssignment.timetable_id == timetable_id)
                assign = assign_class_q.first()

            if assign:
                setup_id = assign.setup_id

        # Look in setups for period_id in schedules_json
        setups_query = self.db.query(TimetableSetup).filter(TimetableSetup.deleted_at.is_(None))
        if timetable_id:
            setups_query = setups_query.filter(TimetableSetup.timetable_id == timetable_id)
        elif school_id:
            setups_query = setups_query.filter(TimetableSetup.school_id == school_id)

        all_setups = setups_query.all()
        matched_period_info = None
        matched_setup = None

        for st in all_setups:
            if st.schedules_json:
                try:
                    s_list = json.loads(st.schedules_json)
                    for sch in s_list:
                        for p_data in sch.get("periods", []):
                            if str(p_data.get("id")) == raw_str:
                                matched_period_info = dict(p_data)
                                matched_period_info["schedule_id"] = sch.get("id")
                                matched_setup = st
                                break
                        if matched_period_info:
                            break
                except Exception:
                    pass
            if matched_period_info:
                break

        if matched_setup and not setup_id:
            setup_id = matched_setup.id

        # Try to extract period_number
        target_p_num = None
        target_sch_id = None
        if matched_period_info:
            target_p_num = matched_period_info.get("period_number")
            target_sch_id = matched_period_info.get("schedule_id")

        if target_p_num is None:
            m = re.match(r"^p-(\d+)", raw_str)
            if m:
                target_p_num = int(m.group(1))

        # Query database periods matching setup_id and period_number
        p_query = self.db.query(TimetablePeriod).filter(TimetablePeriod.deleted_at.is_(None))
        if setup_id:
            p_query = p_query.filter(TimetablePeriod.setup_id == setup_id)
        elif timetable_id:
            p_query = p_query.filter(TimetablePeriod.timetable_id == timetable_id)
        elif school_id:
            p_query = p_query.filter(TimetablePeriod.school_id == school_id)

        if target_p_num is not None:
            if target_sch_id:
                specific_p = p_query.filter(
                    TimetablePeriod.period_number == target_p_num,
                    TimetablePeriod.schedule_id == target_sch_id,
                ).first()
                if specific_p:
                    return specific_p

            match_p = p_query.filter(TimetablePeriod.period_number == target_p_num).first()
            if match_p:
                return match_p

        # If period row doesn't exist yet but we have matched_period_info and setup
        if matched_setup and matched_period_info and (school_id or matched_setup.school_id):
            sch_id = matched_period_info.get("schedule_id") or "default"
            p_num = int(matched_period_info.get("period_number", 1))
            st = _parse_time(matched_period_info.get("start_time", "08:30"))
            et = _parse_time(matched_period_info.get("end_time", "09:15"))
            is_brk = bool(matched_period_info.get("is_break", False))
            p_type = matched_period_info.get("type") or ("RECESS" if is_brk else "CLASS")
            lbl = matched_period_info.get("label") or ("RECESS" if is_brk else f"P{p_num}")

            new_period = TimetablePeriod(
                school_id=school_id or matched_setup.school_id,
                timetable_id=timetable_id or matched_setup.timetable_id,
                setup_id=matched_setup.id,
                schedule_id=sch_id,
                period_number=p_num,
                start_time=st,
                end_time=et,
                is_break=is_brk,
                period_type=p_type,
                label=lbl,
            )
            self.db.add(new_period)
            self.db.flush()
            return new_period

        return None

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
            p = self._resolve_period(
                data.period_id,
                school_id=school_id,
                timetable_id=data.timetable_id,
            )
            if p:
                target_start = p.start_time
                target_end = p.end_time

        if not target_start or not target_end:
            return {"has_conflict": False, "message": None, "conflicting_entry": None}

        t_name = f"{teacher.first_name} {teacher.last_name}".strip()
        sp = getattr(teacher, "staff_profile", None)
        if sp and not sp.is_academic:
            return {
                "has_conflict": True,
                "message": f"{t_name} is registered as Non-Academic staff and cannot be assigned teaching periods.",
                "conflicting_entry": None,
            }

        if sp and sp.working_shifts and len(sp.working_shifts) > 0:
            fits_shift = False
            for shift in sp.working_shifts:
                s_start = _parse_time(shift.get("start_time"))
                s_end = _parse_time(shift.get("end_time"))
                if s_start and s_end and s_start <= target_start and target_end <= s_end:
                    fits_shift = True
                    break
            if not fits_shift:
                shift_strs = [
                    f"{shift.get('start_time')} - {shift.get('end_time')}"
                    for shift in sp.working_shifts
                    if shift.get("start_time") and shift.get("end_time")
                ]
                shifts_display = ", ".join(shift_strs) if shift_strs else "None"
                return {
                    "has_conflict": True,
                    "message": f"{t_name} is not available at {_format_time_12h(target_start)} - {_format_time_12h(target_end)}. Configured working hours: {shifts_display}.",
                    "conflicting_entry": None,
                }

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
                TimetablePeriod.deleted_at.is_(None),
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
                cls_sec = _format_class_section_name(cls_name, sec_name)
                sub_name = e.subject.name if e.subject else "a subject"
                t_name = f"{teacher.first_name} {teacher.last_name}".strip()
                return {
                    "has_conflict": True,
                    "message": f"{t_name} is already teaching {sub_name} in {cls_sec} at this time ({_format_time_12h(ep.start_time)} - {_format_time_12h(ep.end_time)}).",
                    "conflicting_entry": {
                        "id": str(e.id),
                        "class_name": cls_name,
                        "section_name": sec_name,
                        "formatted_class_section": cls_sec,
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

        target_period = self._resolve_period(
            data.period_id,
            school_id=school_id,
            section=target_section,
            timetable_id=data.timetable_id,
        )
        if not target_period:
            raise NotFoundException("Period not found.")

        # Invariant Rule 6: Recess / Break Immunity
        if (getattr(target_period, "is_break", False) or getattr(target_period, "period_type", "") in ("LUNCH", "RECESS", "ASSEMBLY")) and data.subject_id is not None:
            raise BadRequestException(
                f"Cannot schedule a subject during break/recess '{target_period.label or 'Break'}'."
            )

        sections_to_apply = [target_section]
        days_to_apply = [data.day_of_week.upper()]

        if data.apply_days and len(data.apply_days) > 0:
            days_to_apply = [d.upper() for d in data.apply_days]
        elif data.scope == "WEEKDAYS":
            target_days = None
            setup_obj = None
            if target_period.setup_id:
                setup_obj = (
                    self.db.query(TimetableSetup)
                    .filter(
                        TimetableSetup.id == target_period.setup_id,
                        TimetableSetup.deleted_at.is_(None),
                    )
                    .first()
                )
            if not setup_obj:
                setup_assignment = (
                    self.db.query(TimetableSetupAssignment)
                    .filter(
                        TimetableSetupAssignment.timetable_id == data.timetable_id,
                        TimetableSetupAssignment.target_type == "SECTION",
                        TimetableSetupAssignment.target_id == target_section.id,
                        TimetableSetupAssignment.deleted_at.is_(None),
                    )
                    .first()
                )
                if not setup_assignment:
                    setup_assignment = (
                        self.db.query(TimetableSetupAssignment)
                        .filter(
                            TimetableSetupAssignment.timetable_id == data.timetable_id,
                            TimetableSetupAssignment.target_type == "CLASS",
                            TimetableSetupAssignment.target_id == target_section.class_id,
                            TimetableSetupAssignment.deleted_at.is_(None),
                        )
                        .first()
                    )
                if setup_assignment:
                    setup_obj = (
                        self.db.query(TimetableSetup)
                        .filter(
                            TimetableSetup.id == setup_assignment.setup_id,
                            TimetableSetup.deleted_at.is_(None),
                        )
                        .first()
                    )
            if not setup_obj:
                setup_obj = (
                    self.db.query(TimetableSetup)
                    .filter(
                        TimetableSetup.timetable_id == data.timetable_id,
                        TimetableSetup.deleted_at.is_(None),
                    )
                    .first()
                )

            if setup_obj and setup_obj.schedules_json:
                try:
                    schedules = json.loads(setup_obj.schedules_json)
                    day_upper = data.day_of_week.upper()
                    for sch in schedules:
                        sch_days = [d.upper() for d in sch.get("days", [])]
                        if day_upper in sch_days:
                            target_days = sch_days
                            break
                except Exception:
                    pass

            if target_days:
                days_to_apply = target_days
            else:
                days_to_apply = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
        elif data.scope == "CLASS_SECTIONS":
            sections_to_apply = (
                self.db.query(Section)
                .filter(Section.class_id == target_section.class_id, Section.deleted_at.is_(None))
                .all()
            )

        # Invariant Rule 7: Valid Weekday Enforcement
        valid_days = {d.value for d in DayOfWeek}
        for d in days_to_apply:
            if d not in valid_days:
                raise BadRequestException(f"Invalid day_of_week '{d}'. Must be one of: {sorted(valid_days)}")

        # Invariant Rule 5: Curriculum Assignment (ClassSubject) & Subject Existence
        if data.subject_id is not None:
            subject_obj = (
                self.db.query(Subject)
                .filter(
                    Subject.id == data.subject_id,
                    Subject.school_id == school_id,
                    Subject.deleted_at.is_(None),
                )
                .first()
            )
            if not subject_obj:
                raise NotFoundException("Subject not found in this school.")

            class_ids = list({s.class_id for s in sections_to_apply if s.class_id})
            linked_classes = (
                self.db.query(ClassSubject.class_id)
                .filter(
                    ClassSubject.school_id == school_id,
                    ClassSubject.class_id.in_(class_ids),
                    ClassSubject.subject_id == data.subject_id,
                    ClassSubject.deleted_at.is_(None),
                )
                .distinct()
                .all()
            )
            linked_class_ids = {r[0] for r in linked_classes}
            unlinked_sections = [s for s in sections_to_apply if s.class_id not in linked_class_ids]
            if unlinked_sections:
                sec_names = ", ".join(s.name for s in unlinked_sections)
                raise BadRequestException(
                    f"Subject '{subject_obj.name}' is not assigned to Class in Manage School for section(s): {sec_names}."
                )

        # Invariant Rules 2 & 3: Academic Staff Only & Working Shift Adherence
        if data.subject_id is not None and data.teacher_user_id:
            teacher_user = (
                self.db.query(User)
                .join(StaffProfile, StaffProfile.user_id == User.id)
                .options(joinedload(User.staff_profile))
                .filter(
                    User.id == data.teacher_user_id,
                    StaffProfile.school_id == school_id,
                    User.is_active.is_(True),
                    User.deleted_at.is_(None),
                    User.role == UserRole.STAFF,
                )
                .first()
            )
            if not teacher_user:
                raise BadRequestException("Selected teacher is not an active teaching staff member of this school.")

            sp = teacher_user.staff_profile
            teacher_name = f"{teacher_user.first_name} {teacher_user.last_name}".strip()
            if sp and not sp.is_academic:
                raise BadRequestException(
                    f"Staff member '{teacher_name}' is registered as Non-Academic only and cannot be assigned to teaching periods."
                )

            if sp and sp.working_shifts and len(sp.working_shifts) > 0 and target_period.start_time and target_period.end_time:
                fits_shift = False
                for shift in sp.working_shifts:
                    s_start = _parse_time(shift.get("start_time"))
                    s_end = _parse_time(shift.get("end_time"))
                    if s_start and s_end and s_start <= target_period.start_time and target_period.end_time <= s_end:
                        fits_shift = True
                        break
                if not fits_shift:
                    shift_strs = [
                        f"{shift.get('start_time')} - {shift.get('end_time')}"
                        for shift in sp.working_shifts
                        if shift.get("start_time") and shift.get("end_time")
                    ]
                    shifts_display = ", ".join(shift_strs) if shift_strs else "None"
                    raise BadRequestException(
                        f"Teacher '{teacher_name}' is unavailable during Period {target_period.period_number} "
                        f"({_format_time_12h(target_period.start_time)} - {_format_time_12h(target_period.end_time)}). "
                        f"Configured working hours: {shifts_display}."
                    )

        updated_count = 0
        cleared_count = 0
        target_section_ids = [s.id for s in sections_to_apply]

        # Fast-path for unassigning slot(s)
        if data.subject_id is None:
            cleared_entries = (
                self.db.query(TimetableEntry)
                .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
                .filter(
                    TimetableEntry.school_id == school_id,
                    TimetableEntry.section_id.in_(target_section_ids),
                    TimetableEntry.day_of_week.in_(days_to_apply),
                    or_(
                        TimetableEntry.period_id == target_period.id,
                        and_(
                            TimetablePeriod.setup_id == target_period.setup_id,
                            TimetablePeriod.period_number == target_period.period_number,
                        ),
                        TimetablePeriod.period_number == target_period.period_number,
                    ),
                    or_(
                        TimetableEntry.timetable_id == data.timetable_id,
                        TimetableEntry.timetable_id.is_(None),
                    ),
                    TimetableEntry.deleted_at.is_(None),
                )
                .all()
            )
            for ce in cleared_entries:
                ce.deleted_at = now
                ce.deleted_by = user_id
                cleared_count += 1

            self.db.commit()
            return {
                "success": True,
                "updated_count": 0,
                "cleared_count": cleared_count,
                "message": f"Successfully unassigned slot ({cleared_count} cleared).",
            }

        # Pre-fetch all existing entries for all target sections and days in a single batch query
        existing_entries = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.section_id.in_(target_section_ids),
                TimetableEntry.day_of_week.in_(days_to_apply),
                or_(
                    TimetableEntry.period_id == target_period.id,
                    and_(
                        TimetablePeriod.setup_id == target_period.setup_id,
                        TimetablePeriod.period_number == target_period.period_number,
                    ),
                ),
                or_(
                    TimetableEntry.timetable_id == data.timetable_id,
                    TimetableEntry.timetable_id.is_(None),
                ),
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.is_(None),
            )
            .all()
        )
        existing_map: Dict[Tuple[UUID, str], TimetableEntry] = {
            (e.section_id, e.day_of_week): e for e in existing_entries
        }

        # Pre-fetch ClassSubject teacher fallbacks if teacher_user_id was not explicitly provided
        cs_map: Dict[UUID, Optional[UUID]] = {}
        if data.subject_id is not None and not data.teacher_user_id:
            class_ids = list({s.class_id for s in sections_to_apply})
            cs_list = (
                self.db.query(ClassSubject)
                .filter(
                    ClassSubject.school_id == school_id,
                    ClassSubject.class_id.in_(class_ids),
                    ClassSubject.subject_id == data.subject_id,
                    ClassSubject.deleted_at.is_(None),
                )
                .order_by(ClassSubject.section_id.desc().nullslast())
                .all()
            )
            for cs in cs_list:
                if cs.teacher_id:
                    if cs.section_id and cs.section_id not in cs_map:
                        cs_map[cs.section_id] = cs.teacher_id
                    elif not cs.section_id:
                        for s in sections_to_apply:
                            if s.class_id == cs.class_id and s.id not in cs_map:
                                cs_map[s.id] = cs.teacher_id

        for sec in sections_to_apply:
            for day in days_to_apply:
                existing = existing_map.get((sec.id, day))

                if data.subject_id is None:
                    if existing:
                        existing.deleted_at = now
                        existing.deleted_by = user_id
                        cleared_count += 1
                else:
                    assigned_teacher_id = data.teacher_user_id or cs_map.get(sec.id)

                    if existing:
                        existing.subject_id = data.subject_id
                        existing.teacher_user_id = assigned_teacher_id
                        existing.timetable_id = data.timetable_id
                        existing.period_id = target_period.id
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

    def list_periods(self, school_id: UUID, timetable_id: Optional[UUID] = None) -> List[TimetablePeriod]:
        """List active periods for a school, sorted by period_number asc."""
        q = (
            self.db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.school_id == school_id,
                TimetablePeriod.deleted_at.is_(None),
            )
        )
        if timetable_id:
            q = q.filter(TimetablePeriod.timetable_id == timetable_id)
        return q.order_by(TimetablePeriod.period_number.asc()).all()

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
        """List active teaching staff for the school (Academic staff only)."""
        users = (
            self.db.query(User)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .options(
                joinedload(User.staff_profile).selectinload(StaffProfile.staff_wings)
            )
            .filter(
                StaffProfile.school_id == school_id,
                StaffProfile.is_academic.is_(True),
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
            tag_val = (sp.tag if sp and sp.tag else (sp.designation if sp and sp.designation else "Teacher"))
            assigned_wing_ids = [sw.wing_id for sw in sp.staff_wings if getattr(sw, "deleted_at", None) is None] if (sp and hasattr(sp, "staff_wings") and sp.staff_wings) else []
            teachers.append({
                "id": u.id,
                "name": f"{u.first_name} {u.last_name}".strip(),
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "roll_no": sp.roll_no if sp else None,
                "department": sp.department if sp else None,
                "designation": tag_val,
                "tag": tag_val,
                "is_academic": sp.is_academic if sp else True,
                "working_shifts": sp.working_shifts if (sp and sp.working_shifts) else [],
                "assigned_wing_ids": assigned_wing_ids,
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
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
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
                ClassSubject.section_id == section.id,
            )
            .all()
        )
        subject_teacher_map = {}
        for cs in class_subjects:
            if cs.section_id == section.id and cs.teacher:
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
            t = e.teacher or subject_teacher_map.get(e.subject_id)
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
        period = self._resolve_period(
            period_id,
            school_id=school_id,
            section=section,
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

            sp = teacher.staff_profile
            teacher_name = f"{teacher.first_name} {teacher.last_name}".strip()
            if sp and not sp.is_academic:
                raise BadRequestException(f"Staff member '{teacher_name}' is registered as Non-Academic only and cannot be assigned to teaching periods.")

            if sp and sp.working_shifts and len(sp.working_shifts) > 0:
                fits_shift = False
                for shift in sp.working_shifts:
                    s_start = _parse_time(shift.get("start_time"))
                    s_end = _parse_time(shift.get("end_time"))
                    if s_start and s_end and s_start <= period.start_time and period.end_time <= s_end:
                        fits_shift = True
                        break
                if not fits_shift:
                    shift_strs = [
                        f"{shift.get('start_time')} - {shift.get('end_time')}"
                        for shift in sp.working_shifts
                        if shift.get("start_time") and shift.get("end_time")
                    ]
                    shifts_display = ", ".join(shift_strs) if shift_strs else "None"
                    raise BadRequestException(
                        f"Teacher '{teacher_name}' is unavailable during Period {period.period_number} "
                        f"({_format_time_12h(period.start_time)} - {_format_time_12h(period.end_time)}). "
                        f"Configured working hours: {shifts_display}."
                    )

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
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .options(joinedload(TimetableEntry.subject))
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.section_id == section_id,
                TimetableEntry.day_of_week == day_val,
                or_(
                    TimetableEntry.period_id == period_id,
                    and_(
                        TimetablePeriod.setup_id == period.setup_id,
                        TimetablePeriod.period_number == period.period_number,
                    ),
                ),
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.is_(None),
            )
        )
        if getattr(period, "timetable_id", None):
            section_conflict_query = section_conflict_query.filter(
                or_(
                    TimetableEntry.timetable_id == period.timetable_id,
                    TimetableEntry.timetable_id.is_(None),
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
                .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
                .options(
                    joinedload(TimetableEntry.section).joinedload(Section.school_class),
                    joinedload(TimetableEntry.subject),
                    joinedload(TimetableEntry.period),
                )
                .filter(
                    TimetableEntry.school_id == school_id,
                    TimetableEntry.teacher_user_id == teacher_user_id,
                    TimetableEntry.day_of_week == day_val,
                    TimetableEntry.deleted_at.is_(None),
                    TimetablePeriod.deleted_at.is_(None),
                )
            )
            if getattr(period, "timetable_id", None):
                teacher_conflict_query = teacher_conflict_query.filter(
                    or_(
                        TimetableEntry.timetable_id == period.timetable_id,
                        TimetableEntry.timetable_id.is_(None),
                    )
                )
            if exclude_entry_id:
                teacher_conflict_query = teacher_conflict_query.filter(TimetableEntry.id != exclude_entry_id)

            tch_entries = teacher_conflict_query.all()
            for tch_conflict in tch_entries:
                cp = tch_conflict.period
                if cp and max(period.start_time, cp.start_time) < min(period.end_time, cp.end_time):
                    conf_sec = tch_conflict.section
                    conf_class_name = conf_sec.school_class.name if conf_sec and conf_sec.school_class else ""
                    conf_sec_name = conf_sec.name if conf_sec else ""
                    conf_cls_sec = _format_class_section_name(conf_class_name, conf_sec_name)
                    conf_sub_name = tch_conflict.subject.name if tch_conflict.subject else "a class"

                    raise ScheduleConflictException(
                        code="TEACHER_SCHEDULE_CONFLICT",
                        message=f"{teacher_name} is already assigned to {conf_cls_sec} ({conf_sub_name}) during {day_display} Period {period.period_number} ({_format_time_12h(cp.start_time)} - {_format_time_12h(cp.end_time)}).",
                        details={
                            "teacher_name": teacher_name,
                            "class_name": conf_class_name,
                            "section_name": conf_sec_name,
                            "formatted_class_section": conf_cls_sec,
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
                        ClassSubject.section_id == data.section_id,
                        ClassSubject.deleted_at.is_(None),
                    )
                    .first()
                )
                if cs and cs.teacher_id:
                    data.teacher_user_id = cs.teacher_id

        resolved_period = self._resolve_period(
            data.period_id,
            school_id=school_id,
            section_id=data.section_id,
            timetable_id=data.timetable_id,
        )
        if not resolved_period:
            raise NotFoundException("Period not found in this school.")
        if getattr(resolved_period, "is_break", False) or getattr(resolved_period, "period_type", "") in ("LUNCH", "RECESS", "ASSEMBLY"):
            raise BadRequestException(f"Cannot schedule lectures during break period '{resolved_period.label or resolved_period.period_number}'.")

        # Invariant: Verify that the resolved period exists in the active schedule for this day
        if resolved_period.setup_id:
            parent_setup = self.db.query(TimetableSetup).filter(TimetableSetup.id == resolved_period.setup_id, TimetableSetup.deleted_at.is_(None)).first()
            if parent_setup and parent_setup.schedules_json:
                try:
                    schedules_data = json.loads(parent_setup.schedules_json)
                    day_upper = (data.day_of_week.value if hasattr(data.day_of_week, "value") else str(data.day_of_week)).upper()
                    day_schedule = next((sch for sch in schedules_data if day_upper in [d.upper() for d in sch.get("days", [])]), None)
                    if day_schedule:
                        valid_period_nums = {int(p.get("period_number", 0)) for p in day_schedule.get("periods", [])}
                        if resolved_period.period_number not in valid_period_nums:
                            raise BadRequestException(f"Period P{resolved_period.period_number} does not exist in the {day_upper} schedule.")
                except (json.JSONDecodeError, BadRequestException) as e:
                    if isinstance(e, BadRequestException):
                        raise e

        resolved_period_id = resolved_period.id

        existing_slot = (
            self.db.query(TimetableEntry)
            .join(TimetablePeriod, TimetablePeriod.id == TimetableEntry.period_id)
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.section_id == data.section_id,
                TimetableEntry.day_of_week == data.day_of_week.value,
                or_(
                    TimetableEntry.period_id == resolved_period_id,
                    and_(
                        TimetablePeriod.setup_id == resolved_period.setup_id,
                        TimetablePeriod.period_number == resolved_period.period_number,
                    ),
                ),
                TimetableEntry.deleted_at.is_(None),
                TimetablePeriod.deleted_at.is_(None),
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
                period_id=resolved_period_id,
                day_of_week=data.day_of_week.value,
                exclude_entry_id=existing_slot.id,
            )
            existing_slot.period_id = resolved_period_id
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
            period_id=resolved_period_id,
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
            period_id=resolved_period_id,
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
                            ClassSubject.section_id == entry.section_id,
                            ClassSubject.deleted_at.is_(None),
                        )
                        .first()
                    )
                    target_teacher_id = cs.teacher_id if cs else None
            else:
                target_teacher_id = entry.teacher_user_id

        target_period_id = entry.period_id
        if data.period_id is not None:
            resolved_p = self._resolve_period(
                data.period_id,
                school_id=school_id,
                section_id=entry.section_id,
            )
            if not resolved_p:
                raise NotFoundException("Period not found in this school.")
            target_period_id = resolved_p.id
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

    def get_free_teachers(
        self,
        school_id: UUID,
        day_of_week: Optional[str] = None,
        timetable_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Scan and calculate teacher availability across all actual time intervals / periods.
        Avoids N+1 queries by fetching all teachers, periods, and entries in single queries.
        """
        if not timetable_id:
            active_tt = self.get_active_timetable(school_id)
            if active_tt:
                timetable_id = active_tt.id

        periods = self.list_periods(school_id, timetable_id=timetable_id)
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
        if timetable_id:
            entries_query = entries_query.filter(TimetableEntry.timetable_id == timetable_id)

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
                joinedload(TimetableEntry.section).joinedload(Section.school_class),
            )
            .filter(
                TimetableEntry.school_id == school_id,
                TimetableEntry.deleted_at.is_(None),
            )
            .order_by(TimetablePeriod.period_number.asc(), TimetableEntry.created_at.asc())
            .all()
        )

        class_subjects = (
            self.db.query(ClassSubject)
            .options(joinedload(ClassSubject.teacher).joinedload(User.staff_profile))
            .filter(ClassSubject.school_id == school_id, ClassSubject.deleted_at.is_(None))
            .all()
        )
        master_sec_sub_teacher_map: Dict[Tuple[UUID, UUID], Any] = {}
        for cs in class_subjects:
            if cs.teacher and cs.subject_id and cs.section_id:
                master_sec_sub_teacher_map[(cs.section_id, cs.subject_id)] = cs.teacher

        entries_data = []
        for e in entries:
            t = e.teacher or master_sec_sub_teacher_map.get((e.section_id, e.subject_id))
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
