import os
import re
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_user, require_manage_school
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.house import House
from app.models.school import School
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.subject import ClassSubject, Subject
from app.models.timetable import TimetableEntry
from app.models.user import User
from app.models.wing import Wing, WingClass
from app.schemas.school_config import (
    ClassCreateRequest,
    ClassOptionResponse,
    ClassReorderRequest,
    ClassUpdateRequest,
    EmblemUploadResponse,
    HouseCreateRequest,
    HouseOptionResponse,
    HouseUpdateRequest,
    SchoolConfigClass,
    SchoolConfigClassSection,
    SchoolConfigCustomization,
    SchoolConfigHouse,
    SchoolConfigResponse,
    SchoolConfigSubject,
    SchoolConfigWing,
    SchoolCustomizationUpdateRequest,
    SectionClassTeacherAssignRequest,
    SectionCreateRequest,
    SectionOptionResponse,
    SectionSubjectTeacherAssignRequest,
    SectionSubjectsAssignRequest,
    SectionSubjectsResponse,
    SectionUpdateRequest,
    SubjectCreateRequest,
    SubjectOptionResponse,
    SubjectReorderRequest,
    SubjectUpdateRequest,
    TeacherSimpleRead,
    WingCreateRequest,
    WingUpdateRequest,
)

router = APIRouter(prefix="/school", tags=["School Configuration"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "emblems")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _format_teacher(user: Optional[User]) -> Optional[TeacherSimpleRead]:
    if not user or user.deleted_at is not None:
        return None
    sp = getattr(user, "staff_profile", None)
    full_name = f"{user.first_name} {user.last_name}".strip()
    return TeacherSimpleRead(
        id=user.id,
        name=full_name,
        email=user.email,
        roll_no=sp.roll_no if sp else None,
        department=sp.department if sp else None,
        designation=sp.designation if sp else None,
    )


def _natural_section_key(section: Section):
    """
    Sorts sections naturally: e.g. "A" -> [(1, "a")], "Section 2" -> [(1, "section "), (0, 2)]
    Fall back to created_at and id for identical names.
    """
    chunks = []
    for part in re.split(r'(\d+)', (section.name or "").strip()):
        if not part:
            continue
        if part.isdigit():
            chunks.append((0, int(part)))
        else:
            chunks.append((1, part.lower()))
    created = section.created_at.timestamp() if hasattr(section, "created_at") and section.created_at else 0
    return (chunks, created, str(section.id))


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
            selectinload(SchoolClass.sections).joinedload(Section.class_teacher).joinedload(User.staff_profile),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
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
        active_sections = sorted([s for s in c.sections if s.deleted_at is None], key=_natural_section_key)
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
                    teacher_id=cs.teacher_id,
                    teacher=_format_teacher(cs.teacher),
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
                        teacher_id=cs.teacher_id,
                        teacher=_format_teacher(cs.teacher),
                    )
                # If section-specific mode is active, also inherit any shared subjects
                elif not same_for_all_sections and cs.section_id is None:
                    sub = cs.subject
                    if sub.id not in sec_subjects_map:
                        sec_subjects_map[sub.id] = SubjectOptionResponse(
                            id=sub.id,
                            name=sub.name,
                            code=sub.code,
                            category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                            is_academic=sub.is_academic,
                            order_index=sub.order_index,
                            teacher_id=cs.teacher_id,
                            teacher=_format_teacher(cs.teacher),
                        )
                # If same for all sections, all sections have all class-level subjects
                elif same_for_all_sections and cs.section_id is None:
                    sub = cs.subject
                    if sub.id not in sec_subjects_map:
                        sec_subjects_map[sub.id] = SubjectOptionResponse(
                            id=sub.id,
                            name=sub.name,
                            code=sub.code,
                            category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                            is_academic=sub.is_academic,
                            order_index=sub.order_index,
                            teacher_id=cs.teacher_id,
                            teacher=_format_teacher(cs.teacher),
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
                    class_teacher_id=s.class_teacher_id,
                    class_teacher=_format_teacher(s.class_teacher),
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


# =============================================================
# Manage School Workspace Endpoints
# =============================================================

@router.get("/config", response_model=SchoolConfigResponse)
def get_school_full_config(
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get complete school configuration workspace data for the current user's school.
    Enforces strict tenant isolation and uses eager loading to avoid N+1 queries.
    """
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated user is not associated with any active school.",
        )

    # 1. Fetch School customization
    school = (
        db.query(School)
        .filter(
            School.id == current_user.school_id,
            School.deleted_at.is_(None),
        )
        .first()
    )
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School configuration not found.",
        )

    # 2. Fetch Classes with Sections, ClassSubjects, and Wing mappings
    classes = (
        db.query(SchoolClass)
        .options(
            selectinload(SchoolClass.sections).joinedload(Section.class_teacher).joinedload(User.staff_profile),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
            selectinload(SchoolClass.wing_classes).joinedload(WingClass.wing),
        )
        .filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        )
        .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc())
        .all()
    )

    # 3. Fetch Wings with their mapped classes
    wings = (
        db.query(Wing)
        .options(
            selectinload(Wing.wing_classes).joinedload(WingClass.school_class)
        )
        .filter(
            Wing.school_id == current_user.school_id,
            Wing.deleted_at.is_(None),
        )
        .order_by(Wing.order_index.asc(), Wing.name.asc())
        .all()
    )

    # 4. Fetch Subjects with their assignments
    subjects = (
        db.query(Subject)
        .options(
            selectinload(Subject.class_subjects)
        )
        .filter(
            Subject.school_id == current_user.school_id,
            Subject.deleted_at.is_(None),
        )
        .order_by(Subject.order_index.asc(), Subject.name.asc())
        .all()
    )

    # 5. Fetch Houses
    houses = (
        db.query(House)
        .filter(
            House.school_id == current_user.school_id,
            House.deleted_at.is_(None),
        )
        .order_by(House.name.asc())
        .all()
    )

    # Map Classes
    classes_response: List[SchoolConfigClass] = []
    for c in classes:
        # Determine wing
        active_wing = None
        for wc in c.wing_classes:
            if wc.deleted_at is None and wc.wing and wc.wing.deleted_at is None:
                active_wing = wc.wing
                break

        active_sections = sorted([s for s in c.sections if s.deleted_at is None], key=_natural_section_key)
        active_class_subjects = [
            cs for cs in c.class_subjects
            if cs.deleted_at is None and cs.subject and cs.subject.deleted_at is None
        ]

        has_section_specific = any(cs.section_id is not None for cs in active_class_subjects)
        same_for_all = not has_section_specific

        # Class-level shared subjects
        shared_subs_map = {}
        for cs in active_class_subjects:
            if cs.section_id is None:
                sub = cs.subject
                shared_subs_map[sub.id] = SubjectOptionResponse(
                    id=sub.id,
                    name=sub.name,
                    code=sub.code,
                    category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                    is_academic=sub.is_academic,
                    order_index=sub.order_index,
                    teacher_id=cs.teacher_id,
                    teacher=_format_teacher(cs.teacher),
                )

        # Section-level subjects
        sec_response_list: List[SchoolConfigClassSection] = []
        for s in active_sections:
            sec_subs_map = {}
            for cs in active_class_subjects:
                if cs.section_id == s.id:
                    sub = cs.subject
                    sec_subs_map[sub.id] = SubjectOptionResponse(
                        id=sub.id,
                        name=sub.name,
                        code=sub.code,
                        category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                        is_academic=sub.is_academic,
                        order_index=sub.order_index,
                        teacher_id=cs.teacher_id,
                        teacher=_format_teacher(cs.teacher),
                    )
                elif cs.section_id is None:
                    sub = cs.subject
                    if sub.id not in sec_subs_map:
                        sec_subs_map[sub.id] = SubjectOptionResponse(
                            id=sub.id,
                            name=sub.name,
                            code=sub.code,
                            category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                            is_academic=sub.is_academic,
                            order_index=sub.order_index,
                            teacher_id=cs.teacher_id,
                            teacher=_format_teacher(cs.teacher),
                        )

            sorted_sec_subs = sorted(
                sec_subs_map.values(),
                key=lambda x: (0 if x.is_academic else 1, x.order_index, x.name),
            )
            sec_response_list.append(
                SchoolConfigClassSection(
                    id=s.id,
                    class_id=s.class_id,
                    name=s.name,
                    class_teacher_id=s.class_teacher_id,
                    class_teacher=_format_teacher(s.class_teacher),
                    subjects=sorted_sec_subs,
                )
            )

        sorted_class_subs = sorted(
            shared_subs_map.values(),
            key=lambda x: (0 if x.is_academic else 1, x.order_index, x.name),
        )

        classes_response.append(
            SchoolConfigClass(
                id=c.id,
                name=c.name,
                order_index=c.order_index,
                wing_id=active_wing.id if active_wing else None,
                wing_name=active_wing.name if active_wing else None,
                sections=sec_response_list,
                subjects=sorted_class_subs,
                same_for_all_sections=same_for_all,
            )
        )

    # Map Wings
    wings_response: List[SchoolConfigWing] = []
    for w in wings:
        active_wcs = [
            wc for wc in w.wing_classes
            if wc.deleted_at is None and wc.school_class and wc.school_class.deleted_at is None
        ]
        class_ids = [wc.school_class.id for wc in active_wcs]
        class_names = [wc.school_class.name for wc in active_wcs]
        wings_response.append(
            SchoolConfigWing(
                id=w.id,
                name=w.name,
                order_index=w.order_index,
                class_ids=class_ids,
                class_names=class_names,
            )
        )

    # Map Subjects
    subjects_response: List[SchoolConfigSubject] = []
    for sub in subjects:
        active_cs = [cs for cs in sub.class_subjects if cs.deleted_at is None]
        assigned_c_ids = list({cs.class_id for cs in active_cs if cs.section_id is None})
        assigned_s_ids = list({cs.section_id for cs in active_cs if cs.section_id is not None})
        subjects_response.append(
            SchoolConfigSubject(
                id=sub.id,
                name=sub.name,
                code=sub.code,
                category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                is_academic=sub.is_academic,
                order_index=sub.order_index,
                assigned_class_ids=assigned_c_ids,
                assigned_section_ids=assigned_s_ids,
            )
        )

    # Map Houses
    houses_response: List[SchoolConfigHouse] = [
        SchoolConfigHouse(
            id=h.id,
            name=h.name,
            color=h.color,
            emblem_url=h.emblem_url,
        )
        for h in houses
    ]

    return SchoolConfigResponse(
        classes=classes_response,
        wings=wings_response,
        subjects=subjects_response,
        houses=houses_response,
        customization=SchoolConfigCustomization(
            primary_color=school.primary_color,
            emblem_url=school.emblem_url,
        ),
    )


# -------------------------------------------------------------
# Classes Endpoints
# -------------------------------------------------------------

@router.post("/classes", status_code=status.HTTP_201_CREATED)
def create_class(
    payload: ClassCreateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new class for the current school with initial sections and optional wing."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class name cannot be empty.",
        )

    # Check uniqueness
    existing = db.query(SchoolClass).filter(
        SchoolClass.school_id == current_user.school_id,
        func.lower(SchoolClass.name) == name_clean.lower(),
        SchoolClass.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Class '{name_clean}' already exists.",
        )

    # Create class
    new_class = SchoolClass(
        school_id=current_user.school_id,
        name=name_clean,
        order_index=payload.order_index,
        created_by=current_user.id,
    )
    db.add(new_class)
    db.flush()

    # Create initial sections
    sections = payload.initial_sections if payload.initial_sections else ["A"]
    seen = set()
    for s_name in sections:
        s_clean = s_name.strip()
        if s_clean and s_clean.lower() not in seen:
            seen.add(s_clean.lower())
            sec = Section(
                school_id=current_user.school_id,
                class_id=new_class.id,
                name=s_clean,
                created_by=current_user.id,
            )
            db.add(sec)

    # Assign wing if provided
    if payload.wing_id:
        wing = db.query(Wing).filter(
            Wing.id == payload.wing_id,
            Wing.school_id == current_user.school_id,
            Wing.deleted_at.is_(None),
        ).first()
        if wing:
            wc = WingClass(
                school_id=current_user.school_id,
                wing_id=wing.id,
                class_id=new_class.id,
                created_by=current_user.id,
            )
            db.add(wc)

    db.commit()
    db.refresh(new_class)
    return {"success": True, "id": str(new_class.id), "name": new_class.name}


@router.patch("/classes/{class_id}")
def update_class(
    class_id: UUID,
    payload: ClassUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Rename, reorder, or change wing assignment for a class."""
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.school_id == current_user.school_id,
        SchoolClass.deleted_at.is_(None),
    ).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    # Rename
    if payload.name is not None:
        name_clean = payload.name.strip()
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Class name cannot be empty.",
            )
        existing = db.query(SchoolClass).filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.id != class_id,
            func.lower(SchoolClass.name) == name_clean.lower(),
            SchoolClass.deleted_at.is_(None),
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Class '{name_clean}' already exists.",
            )
        old_name = school_class.name
        school_class.name = name_clean

        # Update student profile references to preserve placement
        db.query(StudentProfile).filter(
            StudentProfile.school_id == current_user.school_id,
            func.lower(StudentProfile.class_name) == old_name.lower(),
        ).update({"class_name": name_clean}, synchronize_session=False)

    if payload.order_index is not None:
        school_class.order_index = payload.order_index

    # Wing assignment update
    if payload.update_wing:
        # Remove any existing wing assignment
        db.query(WingClass).filter(
            WingClass.class_id == school_class.id,
            WingClass.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        if payload.wing_id:
            wing = db.query(Wing).filter(
                Wing.id == payload.wing_id,
                Wing.school_id == current_user.school_id,
                Wing.deleted_at.is_(None),
            ).first()
            if not wing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified wing not found.",
                )
            wc = WingClass(
                school_id=current_user.school_id,
                wing_id=wing.id,
                class_id=school_class.id,
                created_by=current_user.id,
            )
            db.add(wc)

    school_class.updated_by = current_user.id
    db.commit()
    return {"success": True, "id": str(school_class.id), "name": school_class.name}


@router.put("/classes/reorder")
def reorder_classes(
    payload: ClassReorderRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Batch reorder classes by updating their order_index."""
    for item in payload.classes:
        db.query(SchoolClass).filter(
            SchoolClass.id == item.class_id,
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        ).update(
            {"order_index": item.order_index, "updated_by": current_user.id},
            synchronize_session=False,
        )
    db.commit()
    return {"success": True}


@router.delete("/classes/{class_id}")
def delete_class(
    class_id: UUID,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Soft-delete a class with strict safety checks against dependent students or timetables.
    """
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.school_id == current_user.school_id,
        SchoolClass.deleted_at.is_(None),
    ).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    # 1. Dependency check: Students enrolled
    student_count = db.query(StudentProfile).filter(
        StudentProfile.school_id == current_user.school_id,
        func.lower(StudentProfile.class_name) == school_class.name.lower(),
    ).count()
    if student_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete '{school_class.name}' because {student_count} student(s) are currently enrolled in it.",
        )

    # 2. Dependency check: Timetable entries
    active_sec_ids = [
        s.id for s in school_class.sections
        if s.deleted_at is None
    ]
    if active_sec_ids:
        tt_count = db.query(TimetableEntry).filter(
            TimetableEntry.school_id == current_user.school_id,
            TimetableEntry.section_id.in_(active_sec_ids),
            TimetableEntry.deleted_at.is_(None),
        ).count()
        if tt_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete '{school_class.name}' because active timetable entries exist for its sections.",
            )

    # 3. Soft-delete class and child sections
    now = datetime.now(timezone.utc)
    school_class.deleted_at = now
    school_class.deleted_by = current_user.id

    for s in school_class.sections:
        if s.deleted_at is None:
            s.deleted_at = now
            s.deleted_by = current_user.id

    db.query(ClassSubject).filter(
        ClassSubject.class_id == school_class.id,
        ClassSubject.school_id == current_user.school_id,
    ).update({"deleted_at": now, "deleted_by": current_user.id}, synchronize_session=False)

    db.query(WingClass).filter(
        WingClass.class_id == school_class.id,
        WingClass.school_id == current_user.school_id,
    ).delete(synchronize_session=False)

    db.commit()
    return {"success": True, "message": f"Class '{school_class.name}' deleted successfully."}


# -------------------------------------------------------------
# Sections Endpoints
# -------------------------------------------------------------

@router.post("/classes/{class_id}/sections", status_code=status.HTTP_201_CREATED)
def create_section(
    class_id: UUID,
    payload: SectionCreateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Add a new section to an existing class."""
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.school_id == current_user.school_id,
        SchoolClass.deleted_at.is_(None),
    ).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parent class not found.",
        )

    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section name cannot be empty.",
        )

    # Check uniqueness within this class
    existing = db.query(Section).filter(
        Section.class_id == class_id,
        Section.school_id == current_user.school_id,
        func.lower(Section.name) == name_clean.lower(),
        Section.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Section '{name_clean}' already exists in {school_class.name}.",
        )

    sec = Section(
        school_id=current_user.school_id,
        class_id=class_id,
        name=name_clean,
        created_by=current_user.id,
    )
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return {"success": True, "id": str(sec.id), "name": sec.name, "class_id": str(sec.class_id)}


@router.patch("/sections/{section_id}")
def update_section(
    section_id: UUID,
    payload: SectionUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Rename a section with duplicate validation and student sync."""
    sec = db.query(Section).filter(
        Section.id == section_id,
        Section.school_id == current_user.school_id,
        Section.deleted_at.is_(None),
    ).first()
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found.",
        )

    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Section name cannot be empty.",
        )

    existing = db.query(Section).filter(
        Section.class_id == sec.class_id,
        Section.school_id == current_user.school_id,
        Section.id != section_id,
        func.lower(Section.name) == name_clean.lower(),
        Section.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Section '{name_clean}' already exists in this class.",
        )

    old_name = sec.name
    sec.name = name_clean
    sec.updated_by = current_user.id

    # Sync student profiles in this section
    parent_class = db.query(SchoolClass).filter(SchoolClass.id == sec.class_id).first()
    if parent_class:
        db.query(StudentProfile).filter(
            StudentProfile.school_id == current_user.school_id,
            func.lower(StudentProfile.class_name) == parent_class.name.lower(),
            func.lower(StudentProfile.section) == old_name.lower(),
        ).update({"section": name_clean}, synchronize_session=False)

    db.commit()
    return {"success": True, "id": str(sec.id), "name": sec.name}


@router.delete("/sections/{section_id}")
def delete_section(
    section_id: UUID,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete a section with safety checks for enrolled students and timetables."""
    sec = db.query(Section).filter(
        Section.id == section_id,
        Section.school_id == current_user.school_id,
        Section.deleted_at.is_(None),
    ).first()
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found.",
        )

    parent_class = db.query(SchoolClass).filter(SchoolClass.id == sec.class_id).first()
    cls_name = parent_class.name if parent_class else ""

    # Check students
    student_count = db.query(StudentProfile).filter(
        StudentProfile.school_id == current_user.school_id,
        func.lower(StudentProfile.class_name) == cls_name.lower(),
        func.lower(StudentProfile.section) == sec.name.lower(),
    ).count()
    if student_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Section '{sec.name}' because {student_count} student(s) are assigned to it.",
        )

    # Check timetable entries
    tt_count = db.query(TimetableEntry).filter(
        TimetableEntry.school_id == current_user.school_id,
        TimetableEntry.section_id == sec.id,
        TimetableEntry.deleted_at.is_(None),
    ).count()
    if tt_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Section '{sec.name}' because active timetable entries exist for it.",
        )

    now = datetime.now(timezone.utc)
    sec.deleted_at = now
    sec.deleted_by = current_user.id

    db.query(ClassSubject).filter(
        ClassSubject.section_id == sec.id,
        ClassSubject.school_id == current_user.school_id,
    ).update({"deleted_at": now, "deleted_by": current_user.id}, synchronize_session=False)

    db.commit()
    return {"success": True, "message": f"Section '{sec.name}' deleted successfully."}


@router.put("/classes/{class_id}/sections/{section_id}/subjects")
def assign_section_subjects(
    class_id: UUID,
    section_id: UUID,
    payload: SectionSubjectsAssignRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Explicitly assign subjects for a specific section.
    Replaces existing section-specific ClassSubject records with the specified subject list.
    """
    school_class = db.query(SchoolClass).filter(
        SchoolClass.id == class_id,
        SchoolClass.school_id == current_user.school_id,
        SchoolClass.deleted_at.is_(None),
    ).first()
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    sec = db.query(Section).filter(
        Section.id == section_id,
        Section.class_id == class_id,
        Section.school_id == current_user.school_id,
        Section.deleted_at.is_(None),
    ).first()
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found in specified class.",
        )

    # 1. Capture existing teacher assignments for section to preserve them
    existing_cs = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.section_id == section_id,
            ClassSubject.school_id == current_user.school_id,
        )
        .all()
    )
    teacher_map = {cs.subject_id: cs.teacher_id for cs in existing_cs if cs.teacher_id}

    # Clear existing section-specific mappings
    db.query(ClassSubject).filter(
        ClassSubject.section_id == section_id,
        ClassSubject.school_id == current_user.school_id,
    ).delete(synchronize_session=False)

    # 2. Add new mappings, preserving existing teacher assignments
    for sub_id in payload.subject_ids:
        sub = db.query(Subject).filter(
            Subject.id == sub_id,
            Subject.school_id == current_user.school_id,
            Subject.deleted_at.is_(None),
        ).first()
        if sub:
            cs = ClassSubject(
                school_id=current_user.school_id,
                class_id=class_id,
                section_id=section_id,
                subject_id=sub.id,
                teacher_id=teacher_map.get(sub.id),
                created_by=current_user.id,
            )
            db.add(cs)

    db.commit()
    return {
        "success": True,
        "message": f"Updated subjects for {school_class.name} - Section {sec.name}.",
        "count": len(payload.subject_ids),
    }


@router.put("/sections/{section_id}/class-teacher")
def assign_class_teacher(
    section_id: UUID,
    payload: SectionClassTeacherAssignRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Assign or unassign a class teacher for a specific section.
    """
    sec = (
        db.query(Section)
        .options(joinedload(Section.class_teacher).joinedload(User.staff_profile))
        .filter(
            Section.id == section_id,
            Section.school_id == current_user.school_id,
            Section.deleted_at.is_(None),
        )
        .first()
    )
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found.",
        )

    teacher_user = None
    teacher_target_id = payload.class_teacher_id or payload.teacher_id
    if teacher_target_id:
        teacher_user = (
            db.query(User)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .options(joinedload(User.staff_profile))
            .filter(
                User.id == teacher_target_id,
                StaffProfile.school_id == current_user.school_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
            .first()
        )
        if not teacher_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected staff member not found or is not active.",
            )

    sec.class_teacher_id = teacher_user.id if teacher_user else None
    sec.updated_by = current_user.id
    db.commit()
    db.refresh(sec)

    return {
        "success": True,
        "section_id": str(sec.id),
        "class_teacher_id": str(sec.class_teacher_id) if sec.class_teacher_id else None,
        "class_teacher": _format_teacher(teacher_user).model_dump() if teacher_user else None,
        "message": f"Class teacher {'assigned' if teacher_user else 'unassigned'} successfully.",
    }


@router.put("/sections/{section_id}/subjects/{subject_id}/teacher")
@router.put("/classes/{class_id}/sections/{section_id}/subjects/{subject_id}/teacher")
def assign_section_subject_teacher(
    section_id: UUID,
    subject_id: UUID,
    payload: SectionSubjectTeacherAssignRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
    class_id: Optional[UUID] = None,
):
    """
    Assign or unassign a teacher for a specific subject in a section.
    """
    sec = (
        db.query(Section)
        .filter(
            Section.id == section_id,
            Section.school_id == current_user.school_id,
            Section.deleted_at.is_(None),
        )
        .first()
    )
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found.",
        )

    sub = (
        db.query(Subject)
        .filter(
            Subject.id == subject_id,
            Subject.school_id == current_user.school_id,
            Subject.deleted_at.is_(None),
        )
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        )

    teacher_user = None
    if payload.teacher_id:
        teacher_user = (
            db.query(User)
            .join(StaffProfile, StaffProfile.user_id == User.id)
            .options(joinedload(User.staff_profile))
            .filter(
                User.id == payload.teacher_id,
                StaffProfile.school_id == current_user.school_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
            .first()
        )
        if not teacher_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected staff member not found or is not active.",
            )

    # Find existing section-specific ClassSubject
    cs = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.section_id == sec.id,
            ClassSubject.subject_id == sub.id,
            ClassSubject.school_id == current_user.school_id,
            ClassSubject.deleted_at.is_(None),
        )
        .first()
    )

    if cs:
        cs.teacher_id = teacher_user.id if teacher_user else None
        cs.updated_by = current_user.id
    else:
        # Create section-specific ClassSubject entry
        cs = ClassSubject(
            school_id=current_user.school_id,
            class_id=sec.class_id,
            section_id=sec.id,
            subject_id=sub.id,
            teacher_id=teacher_user.id if teacher_user else None,
            created_by=current_user.id,
        )
        db.add(cs)

    db.commit()
    return {
        "success": True,
        "section_id": str(sec.id),
        "subject_id": str(sub.id),
        "teacher_id": str(teacher_user.id) if teacher_user else None,
        "teacher": _format_teacher(teacher_user).model_dump() if teacher_user else None,
        "message": f"Teacher {'assigned' if teacher_user else 'unassigned'} for subject '{sub.name}'.",
    }


@router.get("/teachers", response_model=List[TeacherSimpleRead])
def get_school_teachers(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List all active teaching staff members for the current user's school.
    """
    if not current_user.school_id:
        return []

    users = (
        db.query(User)
        .join(StaffProfile, StaffProfile.user_id == User.id)
        .options(joinedload(User.staff_profile))
        .filter(
            StaffProfile.school_id == current_user.school_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            User.role == UserRole.STAFF,
        )
        .order_by(User.first_name.asc(), User.last_name.asc())
        .all()
    )
    return [_format_teacher(u) for u in users if u]


# -------------------------------------------------------------
# Subjects Endpoints
# -------------------------------------------------------------

@router.post("/subjects", status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new subject and assign it to classes or sections."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject name cannot be empty.",
        )

    existing = db.query(Subject).filter(
        Subject.school_id == current_user.school_id,
        func.lower(Subject.name) == name_clean.lower(),
        Subject.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subject '{name_clean}' already exists.",
        )

    category_clean = (payload.category or "academic").strip().lower()
    is_acad = payload.is_academic if payload.is_academic is not None else (category_clean == "academic")

    sub = Subject(
        school_id=current_user.school_id,
        name=name_clean,
        code=payload.code.strip() if payload.code else None,
        category=category_clean,
        is_academic=is_acad,
        order_index=payload.order_index,
        created_by=current_user.id,
    )
    db.add(sub)
    db.flush()

    # Assign whole-class
    for cid in payload.assigned_class_ids:
        c_rec = db.query(SchoolClass).filter(
            SchoolClass.id == cid,
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        ).first()
        if c_rec:
            cs = ClassSubject(
                school_id=current_user.school_id,
                class_id=c_rec.id,
                section_id=None,
                subject_id=sub.id,
                created_by=current_user.id,
            )
            db.add(cs)

    # Assign section-specific
    for sid in payload.assigned_section_ids:
        s_rec = db.query(Section).filter(
            Section.id == sid,
            Section.school_id == current_user.school_id,
            Section.deleted_at.is_(None),
        ).first()
        if s_rec:
            cs = ClassSubject(
                school_id=current_user.school_id,
                class_id=s_rec.class_id,
                section_id=s_rec.id,
                subject_id=sub.id,
                created_by=current_user.id,
            )
            db.add(cs)

    db.commit()
    db.refresh(sub)
    return {"success": True, "id": str(sub.id), "name": sub.name}


@router.patch("/subjects/{subject_id}")
def update_subject(
    subject_id: UUID,
    payload: SubjectUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update subject properties and class/section assignments."""
    sub = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.school_id == current_user.school_id,
        Subject.deleted_at.is_(None),
    ).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        )

    if payload.name is not None:
        name_clean = payload.name.strip()
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subject name cannot be empty.",
            )
        existing = db.query(Subject).filter(
            Subject.school_id == current_user.school_id,
            Subject.id != subject_id,
            func.lower(Subject.name) == name_clean.lower(),
            Subject.deleted_at.is_(None),
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subject '{name_clean}' already exists.",
            )
        sub.name = name_clean

    if payload.code is not None:
        sub.code = payload.code.strip() if payload.code.strip() else None

    if payload.category is not None:
        sub.category = payload.category.strip().lower()

    if payload.is_academic is not None:
        sub.is_academic = payload.is_academic

    if payload.order_index is not None:
        sub.order_index = payload.order_index

    # Update assignments if passed
    if payload.assigned_class_ids is not None or payload.assigned_section_ids is not None:
        # Remove existing mappings
        db.query(ClassSubject).filter(
            ClassSubject.subject_id == sub.id,
            ClassSubject.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        c_ids = payload.assigned_class_ids or []
        for cid in c_ids:
            c_rec = db.query(SchoolClass).filter(
                SchoolClass.id == cid,
                SchoolClass.school_id == current_user.school_id,
                SchoolClass.deleted_at.is_(None),
            ).first()
            if c_rec:
                cs = ClassSubject(
                    school_id=current_user.school_id,
                    class_id=c_rec.id,
                    section_id=None,
                    subject_id=sub.id,
                    created_by=current_user.id,
                )
                db.add(cs)

        s_ids = payload.assigned_section_ids or []
        for sid in s_ids:
            s_rec = db.query(Section).filter(
                Section.id == sid,
                Section.school_id == current_user.school_id,
                Section.deleted_at.is_(None),
            ).first()
            if s_rec:
                cs = ClassSubject(
                    school_id=current_user.school_id,
                    class_id=s_rec.class_id,
                    section_id=s_rec.id,
                    subject_id=sub.id,
                    created_by=current_user.id,
                )
                db.add(cs)

    sub.updated_by = current_user.id
    db.commit()
    return {"success": True, "id": str(sub.id), "name": sub.name}


@router.put("/subjects/reorder")
def reorder_subjects(
    payload: SubjectReorderRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Batch reorder subjects."""
    for item in payload.subjects:
        db.query(Subject).filter(
            Subject.id == item.subject_id,
            Subject.school_id == current_user.school_id,
            Subject.deleted_at.is_(None),
        ).update(
            {"order_index": item.order_index, "updated_by": current_user.id},
            synchronize_session=False,
        )
    db.commit()
    return {"success": True}


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: UUID,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete a subject with safety check for active timetable entries."""
    sub = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.school_id == current_user.school_id,
        Subject.deleted_at.is_(None),
    ).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        )

    tt_count = db.query(TimetableEntry).filter(
        TimetableEntry.school_id == current_user.school_id,
        TimetableEntry.subject_id == sub.id,
        TimetableEntry.deleted_at.is_(None),
    ).count()
    if tt_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Subject '{sub.name}' because active timetable entries exist for it.",
        )

    now = datetime.now(timezone.utc)
    sub.deleted_at = now
    sub.deleted_by = current_user.id

    db.query(ClassSubject).filter(
        ClassSubject.subject_id == sub.id,
        ClassSubject.school_id == current_user.school_id,
    ).update({"deleted_at": now, "deleted_by": current_user.id}, synchronize_session=False)

    db.commit()
    return {"success": True, "message": f"Subject '{sub.name}' deleted successfully."}


# -------------------------------------------------------------
# Wings Endpoints
# -------------------------------------------------------------

@router.post("/wings", status_code=status.HTTP_201_CREATED)
def create_wing(
    payload: WingCreateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new academic wing and assign classes to it."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wing name cannot be empty.",
        )

    existing = db.query(Wing).filter(
        Wing.school_id == current_user.school_id,
        func.lower(Wing.name) == name_clean.lower(),
        Wing.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Wing '{name_clean}' already exists.",
        )

    wing = Wing(
        school_id=current_user.school_id,
        name=name_clean,
        order_index=payload.order_index,
        created_by=current_user.id,
    )
    db.add(wing)
    db.flush()

    for cid in payload.class_ids:
        c_rec = db.query(SchoolClass).filter(
            SchoolClass.id == cid,
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        ).first()
        if c_rec:
            # Unassign from any prior wing
            db.query(WingClass).filter(
                WingClass.class_id == c_rec.id,
                WingClass.school_id == current_user.school_id,
            ).delete(synchronize_session=False)

            wc = WingClass(
                school_id=current_user.school_id,
                wing_id=wing.id,
                class_id=c_rec.id,
                created_by=current_user.id,
            )
            db.add(wc)

    db.commit()
    db.refresh(wing)
    return {"success": True, "id": str(wing.id), "name": wing.name}


@router.patch("/wings/{wing_id}")
def update_wing(
    wing_id: UUID,
    payload: WingUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Rename a wing, change its order, or reassign classes."""
    wing = db.query(Wing).filter(
        Wing.id == wing_id,
        Wing.school_id == current_user.school_id,
        Wing.deleted_at.is_(None),
    ).first()
    if not wing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wing not found.",
        )

    if payload.name is not None:
        name_clean = payload.name.strip()
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wing name cannot be empty.",
            )
        existing = db.query(Wing).filter(
            Wing.school_id == current_user.school_id,
            Wing.id != wing_id,
            func.lower(Wing.name) == name_clean.lower(),
            Wing.deleted_at.is_(None),
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Wing '{name_clean}' already exists.",
            )
        wing.name = name_clean

    if payload.order_index is not None:
        wing.order_index = payload.order_index

    if payload.class_ids is not None:
        # Clear existing mappings for this wing
        db.query(WingClass).filter(
            WingClass.wing_id == wing.id,
            WingClass.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        for cid in payload.class_ids:
            c_rec = db.query(SchoolClass).filter(
                SchoolClass.id == cid,
                SchoolClass.school_id == current_user.school_id,
                SchoolClass.deleted_at.is_(None),
            ).first()
            if c_rec:
                # Remove from previous wing
                db.query(WingClass).filter(
                    WingClass.class_id == c_rec.id,
                    WingClass.school_id == current_user.school_id,
                ).delete(synchronize_session=False)

                wc = WingClass(
                    school_id=current_user.school_id,
                    wing_id=wing.id,
                    class_id=c_rec.id,
                    created_by=current_user.id,
                )
                db.add(wc)

    wing.updated_by = current_user.id
    db.commit()
    return {"success": True, "id": str(wing.id), "name": wing.name}


@router.delete("/wings/{wing_id}")
def delete_wing(
    wing_id: UUID,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a wing. Classes in this wing are safely unassigned and become 'Unassigned'.
    Underlying classes are NOT deleted.
    """
    wing = db.query(Wing).filter(
        Wing.id == wing_id,
        Wing.school_id == current_user.school_id,
        Wing.deleted_at.is_(None),
    ).first()
    if not wing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wing not found.",
        )

    # Safely remove wing_classes mappings (classes become Unassigned)
    db.query(WingClass).filter(
        WingClass.wing_id == wing.id,
        WingClass.school_id == current_user.school_id,
    ).delete(synchronize_session=False)

    now = datetime.now(timezone.utc)
    wing.deleted_at = now
    wing.deleted_by = current_user.id
    db.commit()
    return {"success": True, "message": f"Wing '{wing.name}' deleted. Classes are now unassigned."}


# -------------------------------------------------------------
# Houses Endpoints
# -------------------------------------------------------------

@router.post("/houses", status_code=status.HTTP_201_CREATED)
def create_house(
    payload: HouseCreateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new house (max 4 per school)."""
    count = db.query(House).filter(
        House.school_id == current_user.school_id,
        House.deleted_at.is_(None),
    ).count()
    if count >= 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 4 houses allowed per school.",
        )

    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="House name cannot be empty.",
        )

    existing = db.query(House).filter(
        House.school_id == current_user.school_id,
        func.lower(House.name) == name_clean.lower(),
        House.deleted_at.is_(None),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"House '{name_clean}' already exists.",
        )

    house = House(
        school_id=current_user.school_id,
        name=name_clean,
        color=payload.color.strip() if payload.color else None,
        emblem_url=payload.emblem_url.strip() if payload.emblem_url else None,
        created_by=current_user.id,
    )
    db.add(house)
    db.commit()
    db.refresh(house)
    return {"success": True, "id": str(house.id), "name": house.name}


@router.patch("/houses/{house_id}")
def update_house(
    house_id: UUID,
    payload: HouseUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update house name, color, or emblem."""
    house = db.query(House).filter(
        House.id == house_id,
        House.school_id == current_user.school_id,
        House.deleted_at.is_(None),
    ).first()
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="House not found.",
        )

    if payload.name is not None:
        name_clean = payload.name.strip()
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="House name cannot be empty.",
            )
        existing = db.query(House).filter(
            House.school_id == current_user.school_id,
            House.id != house_id,
            func.lower(House.name) == name_clean.lower(),
            House.deleted_at.is_(None),
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"House '{name_clean}' already exists.",
            )
        old_name = house.name
        house.name = name_clean

        # Update student profile house field
        db.query(StudentProfile).filter(
            StudentProfile.school_id == current_user.school_id,
            func.lower(StudentProfile.house) == old_name.lower(),
        ).update({"house": name_clean}, synchronize_session=False)

    if payload.color is not None:
        house.color = payload.color.strip() if payload.color.strip() else None

    if payload.emblem_url is not None:
        house.emblem_url = payload.emblem_url.strip() if payload.emblem_url.strip() else None

    house.updated_by = current_user.id
    db.commit()
    return {"success": True, "id": str(house.id), "name": house.name}


@router.delete("/houses/{house_id}")
def delete_house(
    house_id: UUID,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete a house with safety check against assigned students."""
    house = db.query(House).filter(
        House.id == house_id,
        House.school_id == current_user.school_id,
        House.deleted_at.is_(None),
    ).first()
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="House not found.",
        )

    student_count = db.query(StudentProfile).filter(
        StudentProfile.school_id == current_user.school_id,
        func.lower(StudentProfile.house) == house.name.lower(),
    ).count()
    if student_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete House '{house.name}' because {student_count} student(s) are assigned to it.",
        )

    now = datetime.now(timezone.utc)
    house.deleted_at = now
    house.deleted_by = current_user.id
    db.commit()
    return {"success": True, "message": f"House '{house.name}' deleted successfully."}


# -------------------------------------------------------------
# School Customization (Theme Color & Emblem) Endpoints
# -------------------------------------------------------------

@router.patch("/customization")
def update_school_customization(
    payload: SchoolCustomizationUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update school primary theme color and emblem URL.
    Step 1 school identity fields (name, code, email, phone, address) are strictly excluded and not editable.
    """
    school = db.query(School).filter(
        School.id == current_user.school_id,
        School.deleted_at.is_(None),
    ).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found.",
        )

    if payload.primary_color is not None:
        c_clean = payload.primary_color.strip()
        if c_clean:
            if not re.match(r"^#[0-9A-Fa-f]{6}$", c_clean):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid theme color format. Must be a valid 6-character HEX color e.g. #2563EB",
                )
            school.primary_color = c_clean.upper()
        else:
            school.primary_color = None

    if payload.emblem_url is not None:
        e_clean = payload.emblem_url.strip()
        school.emblem_url = e_clean if e_clean else None

    school.updated_by = current_user.id
    db.commit()
    return {
        "success": True,
        "primary_color": school.primary_color,
        "emblem_url": school.emblem_url,
    }


@router.post("/customization/emblem", response_model=EmblemUploadResponse)
async def upload_school_customization_emblem(
    file: Annotated[UploadFile, File()],
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Upload a school emblem file for the authenticated school admin.
    Does NOT require an onboarding token.
    Validates MIME type, extension, and file size (max 5 MB).
    """
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Supported formats: PNG, JPG, JPEG, WEBP.",
        )

    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Allowed extensions: .png, .jpg, .jpeg, .webp",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 5 MB.",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    unique_filename = f"emblem_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    emblem_relative_url = f"/uploads/emblems/{unique_filename}"

    return EmblemUploadResponse(
        success=True,
        emblem_url=emblem_relative_url,
        filename=unique_filename,
    )

