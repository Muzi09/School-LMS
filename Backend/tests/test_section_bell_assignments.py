"""Integration regressions. Set LMS_TEST_DATABASE_URL to a migrated PostgreSQL *_test database."""
import json
from datetime import date, time
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.exceptions import BadRequestException, ScheduleConflictException
from app.models import School, SchoolClass, Section, Subject, User, UserRole, Gender, StaffProfile
from app.models.subject import ClassSubject
from app.models.wing import Wing, WingClass
from app.models.timetable import Timetable, TimetableEntry, TimetablePeriod, TimetableSetup, TimetableSetupAssignment
from app.schemas.timetable import BulkSlotAssignRequest, MoveLessonRequest
from app.services.timetable_service import TimetableService


@pytest.fixture
def school_bells(db):
    def save(obj):
        db.add(obj)
        db.flush()
        return obj
    school = save(School(name="Bell test", code=uuid4().hex[:12]))
    sid = school.id
    tt = save(Timetable(name="Summer", school_id=sid, is_active=True))
    actor = save(User(first_name="Sam", last_name="Teacher", login_mobile=str(uuid4().int)[-15:],
                      role=UserRole.STAFF, is_active=True))
    save(StaffProfile(school_id=sid, user_id=actor.id, roll_no="A", gender=next(iter(Gender)),
                      date_of_birth=date(1980, 1, 1), is_academic=True))
    sub = save(Subject(school_id=sid, name="Maths"))
    sections, periods = [], []
    for i, (name, times) in enumerate([("Primary", [(8, 0, 8, 40), (9, 0, 9, 30)]),
                                         ("Senior", [(8, 30, 9, 20), (10, 0, 10, 20)])]):
        wing = save(Wing(school_id=sid, name=name))
        cls = save(SchoolClass(school_id=sid, name=name+" class"))
        save(WingClass(school_id=sid, wing_id=wing.id, class_id=cls.id))
        sec = save(Section(school_id=sid, class_id=cls.id, name="A"))
        save(ClassSubject(school_id=sid, section_id=sec.id, class_id=cls.id, subject_id=sub.id))
        sections.append(sec.id)
        setup = save(TimetableSetup(name=name, timetable_id=tt.id, school_id=sid, is_default=i == 0,
            applicable_days=json.dumps(["MONDAY", "SATURDAY"]), schedules_json=json.dumps([
                {"id": "regular", "days": ["MONDAY"]}, {"id": "sat", "days": ["SATURDAY"]}])))
        save(TimetableSetupAssignment(school_id=sid, timetable_id=tt.id, target_type="WING",
                                      target_id=wing.id, setup_id=setup.id))
        ids = []
        for schedule, (h, m, eh, em) in zip(("regular", "sat"), times):
            ids.append(save(TimetablePeriod(school_id=sid, timetable_id=tt.id, setup_id=setup.id, schedule_id=schedule,
                       period_number=1, label="P1", start_time=time(h,m), end_time=time(eh,em))).id)
        periods.append(ids)
    yield SimpleNamespace(db=db, service=TimetableService(db), school=sid, tt=tt.id, actor=actor.id,
                          subject=sub.id, sections=sections, periods=periods)



def assign(f, section, day, period, **kwargs):
    body = dict(timetable_id=f.tt, section_id=f.sections[section], teacher_user_id=f.actor,
                day_of_week=day, period_id=period, subject_id=f.subject)
    body.update(kwargs)
    return f.service.bulk_assign_slot(f.school, BulkSlotAssignRequest(**body), f.actor)


def test_save_across_weekday_and_saturday_and_remove_exact_lesson(school_bells):
    f = school_bells
    weekday, saturday = f.periods[0]
    assign(f, 0, "MONDAY", weekday, apply_days=["MONDAY", "SATURDAY"])
    assign(f, 1, "SATURDAY", f.periods[1][1])
    data = f.service.get_class_wise_timetable(f.school, timetable_id=f.tt)
    assert {(e["section_id"], e["day_of_week"], e["period"]["start_time"], e["period"]["end_time"])
            for e in data["entries"]} == {(f.sections[0], "MONDAY", "08:00", "08:40"),
            (f.sections[0], "SATURDAY", "09:00", "09:30"), (f.sections[1], "SATURDAY", "10:00", "10:20")}
    with pytest.raises(BadRequestException):
        assign(f, 1, "SATURDAY", saturday, subject_id=None)
    with pytest.raises(BadRequestException):
        assign(f, 0, "SATURDAY", weekday)
    with pytest.raises(ScheduleConflictException):
        assign(f, 1, "MONDAY", f.periods[1][0])
    # Simulate a legacy record stored against a different setup's P1.
    wrong = TimetableEntry(school_id=f.school, timetable_id=f.tt, section_id=f.sections[0],
             day_of_week="SATURDAY", period_id=f.periods[1][1], subject_id=f.subject)
    f.db.add(wrong)
    f.db.flush()
    f.service.validate_timetable_conflicts(f.school, f.tt)
    assert wrong.period_id == f.periods[1][1]
    assign(f, 0, "SATURDAY", saturday, subject_id=None)
    rows = f.db.query(TimetableEntry).filter_by(timetable_id=f.tt, deleted_at=None).all()
    assert {r.period_id for r in rows} == {weekday, f.periods[1][1]} and wrong in rows
    assert len(rows) == 3


def test_move_and_failed_swap_preserve_source(school_bells):
    f = school_bells
    assign(f, 0, "MONDAY", f.periods[0][0])
    source = f.db.query(TimetableEntry).filter_by(timetable_id=f.tt).one()
    body = dict(timetable_id=f.tt, source_section_id=f.sections[0], source_day="MONDAY", source_period_id=f.periods[0][0],
                section_id=f.sections[1], day_of_week="SATURDAY", period_id=f.periods[1][0])
    with pytest.raises(BadRequestException):
        f.service.move_lesson(f.school, source.id, MoveLessonRequest(**body), f.actor)
    assert source.deleted_at is None and source.period_id == f.periods[0][0]
    body["period_id"] = f.periods[1][1]
    assign(f, 1, "SATURDAY", body["period_id"])
    target = f.db.query(TimetableEntry).filter_by(timetable_id=f.tt, section_id=f.sections[1]).one()
    body["expected_target_id"] = target.id
    f.service.move_lesson(f.school, source.id, MoveLessonRequest(**body), f.actor)
    assert source.section_id == f.sections[1] and source.period_id == f.periods[1][1]
    assert target.section_id == f.sections[0] and target.period_id == f.periods[0][0]
