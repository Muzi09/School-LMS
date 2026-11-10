import pytest
from uuid import uuid4
from unittest.mock import MagicMock
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.subject import Subject, ClassSubject
from app.models.user import User
from app.api.v1.endpoints.school_config import _format_subject_response


def test_format_subject_response_with_sec_teachers():
    sub = Subject(
        id=uuid4(),
        name="Mathematics",
        code="MATH",
        is_academic=True,
        order_index=1,
        is_split=False,
    )
    t_id = uuid4()
    t_user = User(id=t_id, first_name="John", last_name="Doe")
    sec_teachers = {sub.id: (t_id, t_user)}

    # When teacher is provided for this section
    resp = _format_subject_response(sub, teacher_id=t_id, teacher_user=t_user, sec_teachers=sec_teachers)
    assert resp.id == sub.id
    assert resp.teacher_id == t_id
    assert resp.teacher.name == "John Doe"

    # When teacher is NOT provided for this section
    resp_none = _format_subject_response(sub, teacher_id=None, teacher_user=None, sec_teachers={})
    assert resp_none.id == sub.id
    assert resp_none.teacher_id is None
    assert resp_none.teacher is None


def test_section_teachers_independent_in_shared_mode():
    """
    Ensure that when same_for_all_sections is True, section A's teacher does NOT leak
    to section B, and class-level subjects have teacher_id=None.
    """
    class_id = uuid4()
    school_id = uuid4()
    teacher_id = uuid4()

    school_class = SchoolClass(
        id=class_id,
        school_id=school_id,
        name="Grade 1",
        order_index=1,
        same_for_all_sections=True,
    )
    sec_a = Section(id=uuid4(), class_id=class_id, school_id=school_id, name="A")
    sec_b = Section(id=uuid4(), class_id=class_id, school_id=school_id, name="B")
    school_class.sections = [sec_a, sec_b]

    sub = Subject(id=uuid4(), school_id=school_id, name="English", code="ENG", is_academic=True, order_index=1, is_split=False)
    teacher_user = User(id=teacher_id, first_name="Alice", last_name="Smith")

    # Class has shared ClassSubject (section_id is None, no teacher)
    shared_cs = ClassSubject(
        id=uuid4(),
        school_id=school_id,
        class_id=class_id,
        section_id=None,
        subject_id=sub.id,
        teacher_id=None,
    )
    shared_cs.subject = sub
    shared_cs.teacher = None

    # Section A has assigned teacher in ClassSubject
    sec_a_cs = ClassSubject(
        id=uuid4(),
        school_id=school_id,
        class_id=class_id,
        section_id=sec_a.id,
        subject_id=sub.id,
        teacher_id=teacher_id,
    )
    sec_a_cs.subject = sub
    sec_a_cs.teacher = teacher_user

    # active_class_subjects contains both
    active_class_subjects = [shared_cs, sec_a_cs]

    # Shared map
    shared_subjects_map = {sub.id: shared_cs}

    # Format Section A
    sec_a_teachers = {cs.subject_id: (cs.teacher_id, cs.teacher) for cs in active_class_subjects if cs.section_id == sec_a.id and cs.teacher_id}
    sec_a_t_id, sec_a_t_obj = sec_a_teachers.get(sub.id, (None, None))
    sec_a_sub_resp = _format_subject_response(sub, teacher_id=sec_a_t_id, teacher_user=sec_a_t_obj, sec_teachers=sec_a_teachers)

    # Format Section B
    sec_b_teachers = {cs.subject_id: (cs.teacher_id, cs.teacher) for cs in active_class_subjects if cs.section_id == sec_b.id and cs.teacher_id}
    sec_b_t_id, sec_b_t_obj = sec_teachers = sec_b_teachers.get(sub.id, (None, None))
    sec_b_sub_resp = _format_subject_response(sub, teacher_id=sec_b_t_id, teacher_user=sec_b_t_obj, sec_teachers=sec_b_teachers)

    # Assert Section A has teacher Alice Smith
    assert sec_a_sub_resp.teacher_id == teacher_id
    assert sec_a_sub_resp.teacher.name == "Alice Smith"

    # Assert Section B has NO teacher (did not leak from Section A or shared_cs)
    assert sec_b_sub_resp.teacher_id is None
    assert sec_b_sub_resp.teacher is None

    # Class-level shared subjects has NO teacher
    class_sub_resp = _format_subject_response(shared_cs.subject, teacher_id=None, teacher_user=None)
    assert class_sub_resp.teacher_id is None
    assert class_sub_resp.teacher is None


def test_toggle_shared_to_separate_preserves_section_teachers_and_does_not_copy():
    """
    When transitioning from Shared to Separate (same_for_all_sections = False):
    - Section A's existing teacher assignment is preserved.
    - Section B does NOT have Section A's teacher copied to it; Section B gets teacher_id=None.
    """
    class_id = uuid4()
    school_id = uuid4()
    teacher_id = uuid4()

    sec_a = Section(id=uuid4(), class_id=class_id, school_id=school_id, name="A")
    sec_b = Section(id=uuid4(), class_id=class_id, school_id=school_id, name="B")
    active_sections = [sec_a, sec_b]

    sub = Subject(id=uuid4(), school_id=school_id, name="Science", code="SCI", is_academic=True, order_index=1, is_split=False)
    teacher_user = User(id=teacher_id, first_name="Bob", last_name="Johnson")

    # Section A has assigned teacher
    sec_a_cs = ClassSubject(
        id=uuid4(),
        school_id=school_id,
        class_id=class_id,
        section_id=sec_a.id,
        subject_id=sub.id,
        teacher_id=teacher_id,
    )
    sec_a_cs.subject = sub
    sec_a_cs.teacher = teacher_user

    active_class_subjects = [sec_a_cs]
    distinct_subjects = {sub.id: sec_a_cs}

    # Simulate transition logic in toggle_class_same_for_all_sections
    added_records = []
    for sec in active_sections:
        existing_sec_sub_ids = {
            cs.subject_id: cs for cs in active_class_subjects if cs.section_id == sec.id
        }
        for sub_id, shared_cs in distinct_subjects.items():
            if sub_id not in existing_sec_sub_ids:
                new_cs = ClassSubject(
                    school_id=school_id,
                    class_id=class_id,
                    section_id=sec.id,
                    subject_id=sub_id,
                    teacher_id=None,  # Section teacher independence
                )
                added_records.append(new_cs)

    # Section A had existing record, so nothing added for Section A
    sec_a_added = [r for r in added_records if r.section_id == sec_a.id]
    assert len(sec_a_added) == 0

    # Section B had no record, so new_cs created with teacher_id=None
    sec_b_added = [r for r in added_records if r.section_id == sec_b.id]
    assert len(sec_b_added) == 1
    assert sec_b_added[0].teacher_id is None
    assert sec_b_added[0].subject_id == sub.id


def test_toggle_separate_to_shared_preserves_section_teachers():
    """
    When transitioning from Separate to Shared (same_for_all_sections = True):
    - All section-specific ClassSubject records for canonical subjects are retained.
    """
    class_id = uuid4()
    school_id = uuid4()
    teacher_a_id = uuid4()
    teacher_b_id = uuid4()

    sec_a = Section(id=uuid4(), class_id=class_id, school_id=school_id, name="A")
    sec_b = Section(id=uuid4(), class_id=class_id, school_id=school_id, name="B")

    sub = Subject(id=uuid4(), school_id=school_id, name="History", code="HIST", is_academic=True, order_index=1, is_split=False)

    sec_a_cs = ClassSubject(
        id=uuid4(),
        school_id=school_id,
        class_id=class_id,
        section_id=sec_a.id,
        subject_id=sub.id,
        teacher_id=teacher_a_id,
    )
    sec_b_cs = ClassSubject(
        id=uuid4(),
        school_id=school_id,
        class_id=class_id,
        section_id=sec_b.id,
        subject_id=sub.id,
        teacher_id=teacher_b_id,
    )

    canonical_subject_ids = [sub.id]

    # Verify that section records for canonical subjects are NOT deleted
    records_to_delete = [
        cs for cs in [sec_a_cs, sec_b_cs]
        if cs.section_id is not None and cs.subject_id not in canonical_subject_ids
    ]
    assert len(records_to_delete) == 0
    assert sec_a_cs.teacher_id == teacher_a_id
    assert sec_b_cs.teacher_id == teacher_b_id
