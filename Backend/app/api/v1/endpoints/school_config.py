from typing import Annotated, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.house import House
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.subject import ClassSubject, Subject
from app.models.user import User
from app.schemas.school_config import (
    ClassOptionResponse,
    HouseOptionResponse,
    SectionOptionResponse,
    SectionSubjectsResponse,
    SubjectOptionResponse,
)

router = APIRouter(prefix="/school", tags=["School Configuration"])


@router.get("/classes", response_model=List[ClassOptionResponse])
def get_school_classes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get configured classes and their sections for the current user's school.
    Enforces strict tenant isolation and includes section subjects & same_for_all_sections flag.
    """
    if not current_user.school_id:
        return []

    classes = (
        db.query(SchoolClass)
        .options(
            selectinload(SchoolClass.sections),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject),
        )
        .filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        )
        .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc())
        .all()
    )

    result: List[ClassOptionResponse] = []
    for c in classes:
        active_sections = [s for s in c.sections if s.deleted_at is None]
        active_class_subjects = [
            cs for cs in c.class_subjects
            if cs.deleted_at is None and cs.subject and cs.subject.deleted_at is None
        ]

        # If any ClassSubject has a non-null section_id, sections have different subjects
        has_section_specific = any(cs.section_id is not None for cs in active_class_subjects)
        same_for_all_sections = not has_section_specific

        # Shared subjects (section_id is None)
        shared_subjects_map = {}
        for cs in active_class_subjects:
            if cs.section_id is None:
                sub = cs.subject
                shared_subjects_map[sub.id] = SubjectOptionResponse(
                    id=sub.id,
                    name=sub.name,
                    code=sub.code,
                    category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                    is_academic=sub.is_academic,
                    order_index=sub.order_index,
                )

        sections_response: List[SectionOptionResponse] = []
        for s in active_sections:
            sec_subjects_map = {}
            for cs in active_class_subjects:
                # Subjects specifically assigned to this section
                if cs.section_id == s.id:
                    sub = cs.subject
                    sec_subjects_map[sub.id] = SubjectOptionResponse(
                        id=sub.id,
                        name=sub.name,
                        code=sub.code,
                        category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                        is_academic=sub.is_academic,
                        order_index=sub.order_index,
                    )
                # If section-specific mode is active, also inherit any shared subjects
                elif not same_for_all_sections and cs.section_id is None:
                    sub = cs.subject
                    sec_subjects_map[sub.id] = SubjectOptionResponse(
                        id=sub.id,
                        name=sub.name,
                        code=sub.code,
                        category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                        is_academic=sub.is_academic,
                        order_index=sub.order_index,
                    )
                # If same for all sections, all sections have all class-level subjects
                elif same_for_all_sections and cs.section_id is None:
                    sub = cs.subject
                    sec_subjects_map[sub.id] = SubjectOptionResponse(
                        id=sub.id,
                        name=sub.name,
                        code=sub.code,
                        category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                        is_academic=sub.is_academic,
                        order_index=sub.order_index,
                    )

            # Sort: academic first, then order_index, then name
            sorted_sec_subjects = sorted(
                sec_subjects_map.values(),
                key=lambda x: (0 if x.is_academic else 1, x.order_index, x.name),
            )
            sections_response.append(
                SectionOptionResponse(
                    id=s.id,
                    class_id=s.class_id,
                    name=s.name,
                    subjects=sorted_sec_subjects,
                )
            )

        sorted_shared_subjects = sorted(
            shared_subjects_map.values(),
            key=lambda x: (0 if x.is_academic else 1, x.order_index, x.name),
        )

        result.append(
            ClassOptionResponse(
                id=c.id,
                name=c.name,
                order_index=c.order_index,
                same_for_all_sections=same_for_all_sections,
                sections=sections_response,
                subjects=sorted_shared_subjects,
            )
        )

    return result


@router.get("/section-subjects", response_model=SectionSubjectsResponse)
def get_section_subjects(
    class_name: Annotated[str, Query(description="Class name e.g. 'Class 11'")],
    section: Annotated[str, Query(description="Section name e.g. 'Science' or 'A'")],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get subjects configured for a specific class and section.
    """
    if not current_user.school_id:
        return SectionSubjectsResponse(
            class_name=class_name,
            section=section,
            same_for_all_sections=True,
            subjects=[],
        )

    school_class = (
        db.query(SchoolClass)
        .options(
            selectinload(SchoolClass.sections),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject),
        )
        .filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.name.ilike(class_name.strip()),
            SchoolClass.deleted_at.is_(None),
        )
        .first()
    )

    if not school_class:
        return SectionSubjectsResponse(
            class_name=class_name,
            section=section,
            same_for_all_sections=True,
            subjects=[],
        )

    sec_obj = next(
        (s for s in school_class.sections if s.deleted_at is None and s.name.lower() == section.strip().lower()),
        None,
    )

    active_class_subjects = [
        cs for cs in school_class.class_subjects
        if cs.deleted_at is None and cs.subject and cs.subject.deleted_at is None
    ]

    has_section_specific = any(cs.section_id is not None for cs in active_class_subjects)
    same_for_all_sections = not has_section_specific

    sec_subjects_map = {}
    for cs in active_class_subjects:
        sub = cs.subject
        if sec_obj and cs.section_id == sec_obj.id:
            sec_subjects_map[sub.id] = SubjectOptionResponse(
                id=sub.id,
                name=sub.name,
                code=sub.code,
                category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                is_academic=sub.is_academic,
                order_index=sub.order_index,
            )
        elif cs.section_id is None:
            sec_subjects_map[sub.id] = SubjectOptionResponse(
                id=sub.id,
                name=sub.name,
                code=sub.code,
                category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                is_academic=sub.is_academic,
                order_index=sub.order_index,
            )

    sorted_subjects = sorted(
        sec_subjects_map.values(),
        key=lambda x: (0 if x.is_academic else 1, x.order_index, x.name),
    )

    return SectionSubjectsResponse(
        class_name=class_name,
        section=section,
        same_for_all_sections=same_for_all_sections,
        subjects=sorted_subjects,
    )



@router.get("/sections", response_model=List[SectionOptionResponse])
def get_school_sections(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get all configured sections for the current user's school.
    """
    if not current_user.school_id:
        return []

    sections = (
        db.query(Section)
        .filter(
            Section.school_id == current_user.school_id,
            Section.deleted_at.is_(None),
        )
        .order_by(Section.name.asc())
        .all()
    )

    return [
        SectionOptionResponse(id=s.id, class_id=s.class_id, name=s.name)
        for s in sections
    ]


@router.get("/houses", response_model=List[HouseOptionResponse])
def get_school_houses(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get configured houses for the current user's school.
    """
    if not current_user.school_id:
        return []

    houses = (
        db.query(House)
        .filter(
            House.school_id == current_user.school_id,
            House.deleted_at.is_(None),
        )
        .order_by(House.name.asc())
        .all()
    )

    return [
        HouseOptionResponse(id=h.id, name=h.name, color=h.color)
        for h in houses
    ]
