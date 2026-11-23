"""Transactional writes shared by the Classwise and Teacherwise planners."""
from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.section import Section
from app.models.subject import ClassSubject, Subject
from app.models.timetable import DayOfWeek, TimetableEntry, TimetablePeriod


class LessonOption(BaseModel):
    id: UUID
    subject_id: UUID
    teacher_id: UUID | None = None
    section_ids: list[UUID] = Field(min_length=1, max_length=100)


class GroupDefinition(BaseModel):
    id: UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    options: list[LessonOption] = Field(min_length=1, max_length=60)
    version: int


class WeekdayPlacement(BaseModel):
    day: DayOfWeek
    start: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    placement_id: UUID | None = None
    options: list[LessonOption] = Field(max_length=60)
    # Refresh the expected roster only when explicitly applying a saved group edit.
    apply_definition: bool = False


class PlaceLessons(BaseModel):
    version: int
    group_id: UUID | None = None
    days: list[WeekdayPlacement] = Field(min_length=1, max_length=6)


class LecturePlanner:
    def __init__(self, service, school_id, timetable_id, user_id, version):
        self.service = service
        self.db = service.db
        self.school_id = school_id
        self.tt = service._lock_timetable(school_id, timetable_id)
        if self.tt.version != version:
            raise ConflictException("The timetable changed. Reopen the planner to review the latest schedule.")
        self.plan = deepcopy(self.tt.lecture_plan or {"groups": {}, "placements": {}})
        self.user_id = user_id
        self.sections = {s.id: s for s in self.db.query(Section).filter_by(school_id=school_id, deleted_at=None)}
        self.teachers = {t["id"]: t for t in service.list_eligible_teachers(school_id)}
        self.allocations = {(cs.class_id, cs.section_id, cs.subject_id): cs.teacher_id for cs in
                            self.db.query(ClassSubject).join(Subject).filter(ClassSubject.school_id == school_id,
                            ClassSubject.deleted_at.is_(None), Subject.school_id == school_id, Subject.deleted_at.is_(None))}

    def validate_options(self, options, grouped):
        ids, pairs = set(), set()
        for row in options:
            if row.id in ids:
                raise BadRequestException("Each lesson option must have a unique ID.")
            ids.add(row.id)
            if (grouped or row.teacher_id) and row.teacher_id not in self.teachers:
                raise BadRequestException("Choose an eligible teacher from this school.")
            for sid in row.section_ids:
                sec = self.sections.get(sid)
                pair = (sid, row.subject_id)
                if not sec or pair in pairs:
                    raise BadRequestException("Choose each section and subject once.")
                pairs.add(pair)
                key = (sec.class_id, sid, row.subject_id)
                fallback = (sec.class_id, None, row.subject_id)
                if key not in self.allocations and fallback not in self.allocations:
                    raise BadRequestException("This subject is no longer allocated to the section.")
                teacher = self.allocations.get(key) or self.allocations.get(fallback)
                if teacher != row.teacher_id:
                    raise BadRequestException("The teacher allocation changed in Manage School.")
                if grouped and str(row.subject_id) not in (sec.parallel_subject_ids or []):
                    raise BadRequestException("Enable parallel scheduling for each subject in Manage School.")

    def _booked_teacher(self, entry):
        if entry.teacher_user_id:
            return entry.teacher_user_id
        section = self.sections.get(entry.section_id)
        if section:
            return (self.allocations.get((section.class_id, section.id, entry.subject_id)) or
                    self.allocations.get((section.class_id, None, entry.subject_id)))
        return None

    def commit(self):
        self.tt.lecture_plan = self.plan
        self.tt.version += 1
        self.tt.updated_by = self.user_id
        self.tt.updated_at = datetime.now(timezone.utc)
        self.db.commit()

    def save_group(self, data):
        key = str(data.id or uuid4())
        if data.id and key not in self.plan["groups"]:
            raise NotFoundException("Group not found in this timetable.")
        self.validate_options(data.options, True)
        name = data.name.strip()
        if not name:
            raise BadRequestException("Enter a group name.")
        group = {"id": key, "name": name, "options": [r.model_dump(mode="json") for r in data.options]}
        self.plan["groups"][key] = group
        self.commit()
        return group

    def delete_group(self, group_id):
        key = str(group_id)
        group = self.plan["groups"].pop(key, None)
        if not group:
            raise NotFoundException("Subject group not found in this timetable.")
        if any(p["group_id"] == key for p in self.plan["placements"].values()):
            self.plan.setdefault("archived_groups", {})[key] = group
        self.commit()
        return {"success": True}

    def place(self, data):
        group = self.plan["groups"].get(str(data.group_id))
        archived = self.plan.get("archived_groups", {}).get(str(data.group_id))
        if archived and all(day.placement_id for day in data.days):
            group = archived
        if data.group_id and not group:
            raise NotFoundException("Group not found in this timetable.")
        schedules = self.service._section_schedules(self.school_id, self.tt.id)
        days = [d.day.value for d in data.days]
        if len(days) != len(set(days)):
            raise BadRequestException("Select a weekday only once.")
        existing = self.db.query(TimetableEntry).join(TimetablePeriod).options(joinedload(TimetableEntry.period)).filter(
            TimetableEntry.school_id == self.school_id, TimetableEntry.deleted_at.is_(None),
            TimetablePeriod.school_id == self.school_id, TimetablePeriod.timetable_id == self.tt.id,
            or_(TimetableEntry.timetable_id == self.tt.id, TimetableEntry.timetable_id.is_(None)),
            TimetableEntry.day_of_week.in_(days)).all()
        additions, removals = [], []
        for item in data.days:
            day = item.day.value
            key = str(item.placement_id or uuid4())
            prior = self.plan["placements"].get(key)
            if item.placement_id and (not prior or not group or prior["group_id"] != group["id"] or prior["day"] != day):
                raise NotFoundException("Scheduled group not found for this weekday.")
            options = item.options
            if group and not prior:
                options = [LessonOption.model_validate(r) for r in group["options"]]
            if not group and (len(options) != 1 or len(options[0].section_ids) != 1):
                raise BadRequestException("Choose one section for a standalone lesson.")
            rows = [e for e in existing if e.day_of_week == day]
            replacing = [e for e in rows if item.placement_id and e.placement_id == item.placement_id]
            # Removing options should still work after an allocation or bell changes.
            # Keep the identities and audit history of each surviving lesson.
            previous_rooms = {
                (e.option_id, e.section_id, e.subject_id): e.room_number for e in replacing
                if e.room_number and e.section_id in self.sections
                and str(e.subject_id) in (self.sections[e.section_id].room_reviews or {})
            }
            current = {(e.option_id, e.section_id, e.subject_id, e.teacher_user_id,
                        e.period.start_time.strftime("%H:%M"), e.period.end_time.strftime("%H:%M")): e for e in replacing}
            requested = {(r.id, sid, r.subject_id, r.teacher_id, item.start, item.end)
                         for r in options for sid in r.section_ids}
            retained = requested.intersection(current)
            removals.extend(e for identity, e in current.items() if identity not in retained)
            requires_validation = not prior or not requested.issubset(current)
            if requires_validation:
                self.validate_options(options, bool(group))
            remaining = [e for e in rows if (not item.placement_id or e.placement_id != item.placement_id) and
                         e.period.start_time.strftime("%H:%M") < item.end and item.start < e.period.end_time.strftime("%H:%M")]
            busy_teachers = {self._booked_teacher(e) for e in remaining}
            busy_sections = {e.section_id for e in remaining}
            for row in options if requires_validation else []:
                shifts = self.teachers.get(row.teacher_id, {}).get("working_shifts") or []
                if shifts and not any(s["start_time"][:5] <= item.start and item.end <= s["end_time"][:5] for s in shifts):
                    raise ConflictException(f"Lesson is outside the teacher's working hours on {day.title()}.")
                if row.teacher_id and row.teacher_id in busy_teachers:
                    raise ConflictException(f"Teacher is already scheduled during this period on {day.title()}.")
                for sid in row.section_ids:
                    if sid in busy_sections:
                        raise ConflictException(f"Section is already scheduled during this period on {day.title()}.")
                    periods = [p for p in self.service._day_periods(schedules, sid, day)
                               if str(p["start_time"])[:5] == item.start and str(p["end_time"])[:5] == item.end
                               and not p.get("is_break") and p.get("period_type", "CLASS") == "CLASS"]
                    if len(periods) != 1:
                        raise BadRequestException(f"No matching teaching period on {day.title()} for every section.")
                    if (row.id, sid, row.subject_id, row.teacher_id, item.start, item.end) in retained:
                        continue
                    additions.append(TimetableEntry(school_id=self.school_id, timetable_id=self.tt.id,
                        section_id=sid, subject_id=row.subject_id, teacher_user_id=row.teacher_id,
                        period_id=UUID(str(periods[0]["id"])), day_of_week=day, created_by=self.user_id,
                        placement_id=UUID(key) if group else None, option_id=row.id if group else None,
                        room_number=previous_rooms.get((row.id, sid, row.subject_id))))
            if group and options:
                expected = prior["expected"] if prior and not item.apply_definition else group["options"]
                self.plan["placements"][key] = {"group_id": group["id"], "day": day, "expected": expected}
            elif prior:
                del self.plan["placements"][key]
        if archived and not any(p["group_id"] == archived["id"] for p in self.plan["placements"].values()):
            del self.plan["archived_groups"][archived["id"]]
        for entry in removals:
            entry.deleted_at = datetime.now(timezone.utc)
            entry.deleted_by = self.user_id
        self.db.flush()
        self.db.add_all(additions)
        self.commit()
        return {"success": True}
