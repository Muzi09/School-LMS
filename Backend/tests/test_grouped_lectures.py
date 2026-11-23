from datetime import date
from uuid import UUID, uuid4

from io import BytesIO

from openpyxl import Workbook, load_workbook

import pytest

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models import Gender, School, SchoolClass, Section, StaffProfile, Subject, User, UserRole
from app.models.subject import ClassSubject
from app.models.timetable import TimetableEntry
from app.services.lecture_planner import GroupDefinition, LecturePlanner, PlaceLessons
from app.services.timetable_service import TimetableService
from app.services.timetable_export_service import ExportCell, ScheduleSheet, TimetableExportService


def test_large_elective_roster_prints_across_excel_rows():
    workbook = Workbook()
    sheet = ScheduleSheet(workbook, "Classes", "Synthetic timetable", True)
    options = [f"Option {i:02d} · Room 201" for i in range(60)]
    sheet.grid([("MONDAY", ["P1", "P2"], [ExportCell("\n".join(options)), ExportCell("English")])])
    stream = BytesIO()
    workbook.save(stream)
    rows = list(load_workbook(stream)["Classes"].values)[2:]
    assert [row[0] for row in rows] == ["Monday", "Monday (cont.)", "Monday (cont.)"]
    assert [option for row in rows for option in row[1].splitlines()] == options
    assert [row[2] for row in rows if row[2]] == ["English"]


@pytest.mark.parametrize("shared_teacher", [False, True])
def test_shared_period_counts_conflicts_removal_and_restore(db, school, school_actor, shared_teacher):
    service = TimetableService(db)
    tt = service.get_active_timetable(school.id)
    first = db.query(Section).filter_by(school_id=school.id).one()
    first.room_number = "201"
    other_class = SchoolClass(school_id=school.id, name="Grade 8")
    db.add(other_class)
    db.flush()
    second = Section(school_id=school.id, class_id=other_class.id, name="B", room_number="B-12")
    db.add(second)
    db.flush()
    options = []
    for subject_name, sections in [("Maths", [first, second]), ("Music", [first])]:
        uid = uuid4()
        teacher = User(id=uid, first_name=subject_name, last_name="Teacher", login_mobile=str(uid.int)[-15:],
                       role=UserRole.STAFF, is_active=True)
        subject = Subject(name=subject_name, school_id=school.id)
        db.add_all([teacher, subject])
        db.flush()
        db.add(StaffProfile(user_id=uid, school_id=school.id, roll_no=subject_name,
                            is_academic=True, gender=next(iter(Gender)), date_of_birth=date(1980, 1, 1)))
        if shared_teacher and options:
            uid = options[0]["teacher_id"]
        for sec in sections:
            db.add(ClassSubject(school_id=school.id, class_id=sec.class_id, section_id=sec.id,
                                subject_id=subject.id, teacher_id=uid))
            sec.parallel_subject_ids = [*(sec.parallel_subject_ids or []), str(subject.id)]
        options.append(dict(id=uuid4(), subject_id=subject.id, teacher_id=uid, room_number="201",
                            section_ids=[sec.id for sec in sections]))
    db.flush()

    def planner():
        return LecturePlanner(service, school.id, tt.id, school_actor.id, tt.version)

    def update(days):
        return planner().place(PlaceLessons(version=tt.version, group_id=group["id"], days=days))

    definition = GroupDefinition(version=tt.version, name="Options", options=options)
    second.parallel_subject_ids = []
    with pytest.raises(BadRequestException, match="parallel"):
        planner().save_group(definition)
    second.parallel_subject_ids = [str(options[0]["subject_id"])]
    group = planner().save_group(definition)
    monday = dict(day="MONDAY", start="08:30", end="09:15", options=options)
    with pytest.raises(BadRequestException):
        update([monday, dict(monday, day="FRIDAY", end="09:16")])
    active = db.query(TimetableEntry).filter_by(school_id=school.id, timetable_id=tt.id, deleted_at=None)
    assert active.count() == 0
    update([monday])
    assert active.count() == 3
    exporter = TimetableExportService(db)
    workbook = load_workbook(exporter.export_timetable_excel(school.id, tt.id, section_ids=[first.id],
                                                              teacher_ids=[options[0]["teacher_id"]]))
    class_sheet, teacher_sheet = workbook.worksheets
    class_cells = [v for row in class_sheet.values for v in row if v]
    teacher_cells = [v for row in teacher_sheet.values for v in row if v]
    assert any("Maths" in v and "Music" in v and "201" in v for v in class_cells)
    assert any("Assigned 1" in v and "45m teaching" in v for v in teacher_cells)
    assert any("Grade 6 A" in v and "Grade 8 B" in v and "Maths" in v for v in teacher_cells)
    assert any("Grade 6 A · 201" in v and "Grade 8 B · B-12" in v for v in teacher_cells)
    assert any("Music" in v for v in teacher_cells) == shared_teacher
    second_school = School(name="Other school", code=uuid4().hex[:12])
    db.add(second_school)
    db.flush()
    with pytest.raises(NotFoundException):
        exporter.export_timetable_excel(second_school.id, tt.id)
    with pytest.raises(NotFoundException):
        exporter.export_timetable_excel(school.id, uuid4())
    assert not service.validate_timetable_conflicts(school.id, tt.id)[0]
    assert service.get_class_wise_timetable(school.id, tt.id)["stats"]["assigned_slots"] == 2
    with pytest.raises(ConflictException, match="Teacher is already scheduled"):
        update([monday])
    placement = active.first().placement_id
    update([dict(monday, placement_id=placement, options=options[:1])])
    assert active.count() == 2
    partial = load_workbook(exporter.export_timetable_excel(school.id, tt.id, section_ids=[first.id],
                                                             teacher_ids=[options[0]["teacher_id"]]))
    assert any("1 of 2 options scheduled" in str(v) for row in partial.worksheets[1].values for v in row)
    assert sum("1 of 2 options scheduled" in str(v) for row in partial.active.values for v in row) == 1
    assert len(tt.lecture_plan["placements"][str(placement)]["expected"]) == 2
    update([dict(monday, placement_id=placement)])
    assert active.count() == 3
    with pytest.raises(NotFoundException):
        LecturePlanner(service, uuid4(), tt.id, school_actor.id, tt.version)
    with pytest.raises(BadRequestException):
        planner().save_group(GroupDefinition(version=tt.version, name="Invalid", options=[
            dict(options[0], section_ids=[uuid4()])]))
    with pytest.raises(ConflictException):
        LecturePlanner(service, school.id, tt.id, school_actor.id, tt.version - 1)
    planner().delete_group(UUID(group["id"]))
    assert group["id"] not in tt.lecture_plan["groups"]
    assert active.count() == 3
    with pytest.raises(NotFoundException):
        update([dict(monday, day="TUESDAY")])
    update([dict(monday, placement_id=placement, options=options[:1])])
    assert active.count() == 2
    update([dict(monday, placement_id=placement, options=[])])
    assert active.count() == 0
    assert group["id"] not in tt.lecture_plan["archived_groups"]
