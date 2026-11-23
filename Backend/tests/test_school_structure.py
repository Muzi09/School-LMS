from uuid import UUID

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import school_config as config
from app.models import SchoolClass, Section, Subject
from app.schemas.school_config import (
    ClassCreateRequest, ClassSubjectsAssignRequest, ClassToggleSharedRequest,
    ClassUpdateRequest, SectionCreateRequest, StructureReorderRequest, WingCreateRequest,
)


def test_wing_assignment_and_hierarchy_order(db, school, school_actor):
    grade = db.query(SchoolClass).filter_by(school_id=school.id).one()
    primary = UUID(config.create_wing(WingCreateRequest(name="Primary"), school_actor, db)["id"])
    senior = UUID(config.create_wing(WingCreateRequest(name="Senior"), school_actor, db)["id"])
    config.update_class(grade.id, ClassUpdateRequest(wing_id=primary), school_actor, db)
    with pytest.raises(HTTPException) as error:
        config.update_class(grade.id, ClassUpdateRequest(update_wing=True), school_actor, db)
    assert error.value.status_code == 400
    with pytest.raises(HTTPException) as error:
        config.delete_wing(primary, school_actor, db)
    assert error.value.status_code == 409

    other = UUID(config.create_class(
        ClassCreateRequest(name="Grade 5", wing_id=primary, initial_sections=["C", "B"]),
        school_actor, db,
    )["id"])
    upper = UUID(config.create_class(
        ClassCreateRequest(name="Grade 9", wing_id=senior), school_actor, db,
    )["id"])
    initial = config.get_school_full_config(school_actor, db)
    assert [record.id for record in initial.classes] == [grade.id, other, upper]
    sections = next(record.sections for record in initial.classes if record.id == other)
    assert [section.name for section in sections] == ["C", "B"]

    config.reorder_wings(StructureReorderRequest(ids=[senior, primary]), school_actor, db)
    config.reorder_wing_classes(primary, StructureReorderRequest(ids=[other, grade.id]), school_actor, db)
    config.reorder_class_sections(
        other, StructureReorderRequest(ids=[sections[1].id, sections[0].id]), school_actor, db,
    )
    ordered = config.get_school_full_config(school_actor, db)
    assert [record.id for record in ordered.classes] == [upper, other, grade.id]
    assert ordered.wings[1].class_ids == [other, grade.id]
    assert [section.name for section in ordered.classes[1].sections] == ["B", "C"]


def test_parallel_tracks_shared_subjects_and_new_sections(db, school, school_actor):
    grade = db.query(SchoolClass).filter_by(school_id=school.id).one()
    wing = UUID(config.create_wing(WingCreateRequest(name="Middle"), school_actor, db)["id"])
    config.update_class(grade.id, ClassUpdateRequest(wing_id=wing), school_actor, db)
    science = Subject(name="Science", school_id=school.id)
    db.add(science)
    db.flush()
    config.assign_class_subjects(grade.id, ClassSubjectsAssignRequest(subject_ids=[science.id]), school_actor, db)

    a = db.query(Section).filter_by(class_id=grade.id, name="A").one()
    b = UUID(config.create_section(grade.id, SectionCreateRequest(name="B"), school_actor, db)["id"])
    config.set_parallel_subject(b, science.id, True, school_actor, db)
    assert a.parallel_subject_ids == [str(science.id)]
    c = UUID(config.create_section(grade.id, SectionCreateRequest(name="C"), school_actor, db)["id"])
    assert db.get(Section, c).parallel_subject_ids == [str(science.id)]

    config.toggle_class_shared_subjects(
        grade.id, ClassToggleSharedRequest(same_for_all_sections=False), school_actor, db,
    )
    config.set_parallel_subject(a.id, science.id, False, school_actor, db)
    assert db.get(Section, b).parallel_subject_ids == [str(science.id)]
    config.toggle_class_shared_subjects(
        grade.id, ClassToggleSharedRequest(same_for_all_sections=True, source_section_id=a.id), school_actor, db,
    )
    assert all(not section.parallel_subject_ids for section in db.query(Section).filter_by(class_id=grade.id))
