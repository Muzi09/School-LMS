import re
from datetime import datetime, timezone
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.dialects.postgresql import insert

from app.api.deps import get_current_user, require_manage_school
from app.core.database import get_db
from app.services.emblem_service import available_emblem_url, save_emblem
from app.services.timetable_service import TimetableService
from app.models.enums import UserRole
from app.models.house import House
from app.models.school import School
from app.models.school_class import SchoolClass
from app.services.school_order import class_order, section_order
from app.models.section import Section
from app.models.staff import StaffProfile
from app.models.student import StudentProfile
from app.models.subject import ClassSubject, Subject
from app.models.timetable import TimetableEntry, TimetablePeriod
from app.models.user import User
from app.models.wing import Wing, WingClass
from app.schemas.school_config import (
    ClassCreateRequest,
    ClassOptionResponse,
    ClassReorderRequest,
    ClassSubjectsAssignRequest,
    ClassToggleSharedRequest,
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
    RoomUpdateRequest,
    SectionRoomModeRequest,
    StructureReorderRequest,
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
    SubjectSplitRequest,
    SubjectUpdateRequest,
    TeacherSimpleRead,
    WingCreateRequest,
    WingUpdateRequest,
)

router = APIRouter(prefix="/school", tags=["School Configuration"])

def _format_teacher(user: Optional[User]) -> Optional[TeacherSimpleRead]:
    if not user or user.deleted_at is not None:
        return None
    sp = getattr(user, "staff_profile", None)
    full_name = f"{user.first_name} {user.last_name}".strip()
    assigned_wing_ids = [sw.wing_id for sw in sp.staff_wings if getattr(sw, "deleted_at", None) is None] if (sp and hasattr(sp, "staff_wings") and sp.staff_wings) else []
    tag_val = (sp.tag if sp and sp.tag else (sp.designation if sp and sp.designation else "Teacher"))
    return TeacherSimpleRead(
        id=user.id,
        name=full_name,
        email=user.email,
        roll_no=sp.roll_no if sp else None,
        department=sp.department if sp else None,
        designation=tag_val,
        tag=tag_val,
        is_academic=sp.is_academic if sp else True,
        assigned_wing_ids=assigned_wing_ids,
        working_shifts=sp.working_shifts if (sp and sp.working_shifts) else [],
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
    return (section.order_index, chunks, created, str(section.id))


def _format_subject_response(
    sub: Subject,
    teacher_id: Optional[UUID] = None,
    teacher_user: Optional[User] = None,
    sec_teachers: Optional[dict] = None,
) -> SubjectOptionResponse:
    child_responses = []
    if getattr(sub, "is_split", False) and getattr(sub, "child_subjects", None):
        active_children = [c for c in sub.child_subjects if c.deleted_at is None]
        for c in sorted(active_children, key=lambda x: (x.order_index, x.name)):
            c_tid, c_tuser = (None, None)
            if sec_teachers and c.id in sec_teachers:
                c_tid, c_tuser = sec_teachers[c.id]
            child_responses.append(
                SubjectOptionResponse(
                    id=c.id,
                    name=c.name,
                    code=c.code,
                    category=c.category or "academic",
                    is_academic=c.is_academic,
                    order_index=c.order_index,
                    is_split=False,
                    parent_id=sub.id,
                    parent_name=sub.name,
                    teacher_id=c_tid,
                    teacher=_format_teacher(c_tuser) if c_tuser else None,
                )
            )

    return SubjectOptionResponse(
        id=sub.id,
        name=sub.name,
        code=sub.code,
        category=sub.category or ("academic" if sub.is_academic else "non_academic"),
        is_academic=sub.is_academic,
        order_index=sub.order_index,
        is_split=getattr(sub, "is_split", False),
        parent_id=sub.parent_id,
        parent_name=sub.parent.name if getattr(sub, "parent", None) else None,
        child_subjects=child_responses,
        teacher_id=teacher_id,
        teacher=_format_teacher(teacher_user) if teacher_user else None,
    )


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
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject).selectinload(Subject.child_subjects),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
        )
        .filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        )
        .order_by(*class_order())
        .all()
    )

    result: List[ClassOptionResponse] = []
    for c in classes:
        active_sections = sorted([s for s in c.sections if s.deleted_at is None], key=_natural_section_key)
        active_class_subjects = [
            cs for cs in c.class_subjects
            if cs.deleted_at is None and cs.subject and cs.subject.deleted_at is None
        ]

        same_for_all_sections = getattr(c, "same_for_all_sections", True)

        # Shared subjects (only top-level subjects with parent_id is None)
        shared_subjects_map = {}
        for cs in active_class_subjects:
            sub = cs.subject
            if sub.parent_id is not None:
                continue
            if cs.section_id is None or same_for_all_sections:
                if sub.id not in shared_subjects_map:
                    shared_subjects_map[sub.id] = cs

        sections_response: List[SectionOptionResponse] = []
        for s in active_sections:
            sec_subjects_map = {}
            sec_teachers = {}
            for cs in active_class_subjects:
                if cs.section_id == s.id and cs.teacher_id:
                    sec_teachers[cs.subject_id] = (cs.teacher_id, cs.teacher)

            if same_for_all_sections:
                # Every section has all shared subjects with its section-specific teacher assigned if any.
                # Teacher assignment is strictly section-specific and must NEVER fallback to shared_cs.
                for sub_id, shared_cs in shared_subjects_map.items():
                    sub = shared_cs.subject
                    sec_t_id, sec_t_obj = sec_teachers.get(sub_id, (None, None))
                    sec_subjects_map[sub_id] = _format_subject_response(
                        sub,
                        teacher_id=sec_t_id,
                        teacher_user=sec_t_obj,
                        sec_teachers=sec_teachers,
                    )
            else:
                # Only subjects explicitly assigned to this section (top-level only)
                for cs in active_class_subjects:
                    if cs.section_id == s.id and cs.subject.parent_id is None:
                        sub = cs.subject
                        sec_subjects_map[sub.id] = _format_subject_response(
                            sub,
                            teacher_id=cs.teacher_id,
                            teacher_user=cs.teacher,
                            sec_teachers=sec_teachers,
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
            [
                _format_subject_response(cs.subject, teacher_id=None, teacher_user=None)
                for cs in shared_subjects_map.values()
            ],
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
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject).selectinload(Subject.child_subjects),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
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

    same_for_all_sections = getattr(school_class, "same_for_all_sections", True)

    sec_teachers = {}
    for cs in active_class_subjects:
        if sec_obj and cs.section_id == sec_obj.id and cs.teacher_id:
            sec_teachers[cs.subject_id] = (cs.teacher_id, cs.teacher)

    sec_subjects_map = {}
    for cs in active_class_subjects:
        sub = cs.subject
        if sub.parent_id is not None:
            continue
        if same_for_all_sections:
            if cs.section_id is None or (sec_obj and cs.section_id == sec_obj.id):
                if sub.id not in sec_subjects_map:
                    t_id, t_obj = sec_teachers.get(sub.id, (None, None))
                    sec_subjects_map[sub.id] = _format_subject_response(
                        sub,
                        teacher_id=t_id,
                        teacher_user=t_obj,
                        sec_teachers=sec_teachers,
                    )
        else:
            if sec_obj and cs.section_id == sec_obj.id:
                sec_subjects_map[sub.id] = _format_subject_response(
                    sub,
                    teacher_id=cs.teacher_id,
                    teacher_user=cs.teacher,
                    sec_teachers=sec_teachers,
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
        db.query(Section).join(SchoolClass)
        .filter(
            Section.school_id == current_user.school_id,
            Section.deleted_at.is_(None),
        )
        .order_by(*class_order(), *section_order())
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
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject).selectinload(Subject.child_subjects),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.teacher).joinedload(User.staff_profile),
            selectinload(SchoolClass.wing_classes).joinedload(WingClass.wing),
        )
        .filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        )
        .order_by(*class_order())
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

    # 4. Fetch Subjects with their assignments and child subjects
    subjects = (
        db.query(Subject)
        .options(
            selectinload(Subject.class_subjects),
            selectinload(Subject.child_subjects),
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

        same_for_all = getattr(c, "same_for_all_sections", True)

        # Class-level shared subjects (only top-level subjects with parent_id is None)
        shared_subs_map = {}
        for cs in active_class_subjects:
            sub = cs.subject
            if sub.parent_id is not None:
                continue
            if cs.section_id is None or same_for_all:
                if sub.id not in shared_subs_map:
                    shared_subs_map[sub.id] = cs

        # Section-level subjects
        sec_response_list: List[SchoolConfigClassSection] = []
        for s in active_sections:
            sec_subs_map = {}
            sec_teachers = {}
            for cs in active_class_subjects:
                if cs.section_id == s.id and cs.teacher_id:
                    sec_teachers[cs.subject_id] = (cs.teacher_id, cs.teacher)

            if same_for_all:
                for sub_id, shared_cs in shared_subs_map.items():
                    sub = shared_cs.subject
                    sec_t_id, sec_t_obj = sec_teachers.get(sub_id, (None, None))
                    sec_subs_map[sub_id] = _format_subject_response(
                        sub,
                        teacher_id=sec_t_id,
                        teacher_user=sec_t_obj,
                        sec_teachers=sec_teachers,
                    )
            else:
                for cs in active_class_subjects:
                    if cs.section_id == s.id and cs.subject.parent_id is None:
                        sub = cs.subject
                        sec_subs_map[sub.id] = _format_subject_response(
                            sub,
                            teacher_id=cs.teacher_id,
                            teacher_user=cs.teacher,
                            sec_teachers=sec_teachers,
                        )

            sorted_sec_subs = sorted(
                sec_subs_map.values(),
                key=lambda x: (0 if x.is_academic else 1, x.order_index, x.name),
            )
            sec_response_list.append(
                SchoolConfigClassSection(
                    single_room=s.single_room,
                    room_number=s.room_number,
                    room_reviews={} if s.single_room else s.room_reviews or {},
                    room_overrides={cs.subject_id: cs.room_override for cs in active_class_subjects
                                    if cs.section_id == s.id and cs.room_override and not s.single_room},
                    parallel_subject_ids=s.parallel_subject_ids or [],
                    id=s.id,
                    class_id=s.class_id,
                    name=s.name,
                    class_teacher_id=s.class_teacher_id,
                    class_teacher=_format_teacher(s.class_teacher),
                    subjects=sorted_sec_subs,
                )
            )

        sorted_class_subs = sorted(
            [
                _format_subject_response(cs.subject, teacher_id=None, teacher_user=None)
                for cs in shared_subs_map.values()
            ],
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
        active_wcs.sort(key=lambda wc: (wc.school_class.order_index, wc.school_class.name, wc.class_id))
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

    # Map Subjects (top-level with child_subjects)
    subjects_response: List[SchoolConfigSubject] = []
    for sub in [s for s in subjects if s.parent_id is None]:
        active_cs = [cs for cs in sub.class_subjects if cs.deleted_at is None]
        assigned_c_ids = list({cs.class_id for cs in active_cs if cs.section_id is None})
        assigned_s_ids = list({cs.section_id for cs in active_cs if cs.section_id is not None})
        child_resps = []
        if getattr(sub, "is_split", False) and getattr(sub, "child_subjects", None):
            active_children = [c for c in sub.child_subjects if c.deleted_at is None]
            for c in sorted(active_children, key=lambda x: (x.order_index, x.name)):
                child_resps.append(
                    SubjectOptionResponse(
                        id=c.id,
                        name=c.name,
                        code=c.code,
                        category=c.category or "academic",
                        is_academic=c.is_academic,
                        order_index=c.order_index,
                        is_split=False,
                        parent_id=sub.id,
                        parent_name=sub.name,
                    )
                )
        subjects_response.append(
            SchoolConfigSubject(
                id=sub.id,
                name=sub.name,
                code=sub.code,
                category=sub.category or ("academic" if sub.is_academic else "non_academic"),
                is_academic=sub.is_academic,
                order_index=sub.order_index,
                is_split=getattr(sub, "is_split", False),
                parent_id=sub.parent_id,
                child_subjects=child_resps,
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
            emblem_url=available_emblem_url(school.emblem_url),
        ),
    )


# -------------------------------------------------------------
# Classes Endpoints
# -------------------------------------------------------------

def _next_class_order(db: Session, wing_id: UUID) -> int:
    highest = db.query(func.max(SchoolClass.order_index)).join(
        WingClass, WingClass.class_id == SchoolClass.id,
    ).filter(WingClass.wing_id == wing_id, WingClass.deleted_at.is_(None),
             SchoolClass.deleted_at.is_(None)).scalar()
    return highest + 1 if highest is not None else 0


def _save_structure_order(db, current_user, query, ids):
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
    records = {record.id: record for record in query.all()}
    if len(ids) != len(records) or set(ids) != records.keys():
        raise HTTPException(409, "The list changed. Refresh before reordering.")
    for order_index, record_id in enumerate(ids):
        records[record_id].order_index = order_index
        records[record_id].updated_by = current_user.id
    db.commit()
    return {"success": True}


@router.put("/wings/reorder")
def reorder_wings(
    payload: StructureReorderRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    query = db.query(Wing).filter_by(school_id=current_user.school_id, deleted_at=None)
    return _save_structure_order(db, current_user, query, payload.ids)


@router.put("/wings/{wing_id}/classes/reorder")
def reorder_wing_classes(
    wing_id: UUID,
    payload: StructureReorderRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    query = db.query(SchoolClass).join(WingClass).join(Wing).filter(
        SchoolClass.school_id == current_user.school_id, SchoolClass.deleted_at.is_(None),
        WingClass.school_id == current_user.school_id, WingClass.deleted_at.is_(None),
        Wing.id == wing_id, Wing.school_id == current_user.school_id, Wing.deleted_at.is_(None),
    )
    return _save_structure_order(db, current_user, query, payload.ids)


@router.put("/classes/{class_id}/sections/reorder")
def reorder_class_sections(
    class_id: UUID,
    payload: StructureReorderRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    query = db.query(Section).filter_by(
        school_id=current_user.school_id, class_id=class_id, deleted_at=None,
    )
    return _save_structure_order(db, current_user, query, payload.ids)


@router.post("/classes", status_code=status.HTTP_201_CREATED)
def create_class(
    payload: ClassCreateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new class for the current school with initial sections and a required wing."""
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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

    wing = db.query(Wing).filter_by(
        id=payload.wing_id, school_id=current_user.school_id, deleted_at=None,
    ).first()
    if not wing:
        raise HTTPException(400, "Select a valid academic wing.")

    # Create class
    new_class = SchoolClass(
        school_id=current_user.school_id,
        name=name_clean,
        order_index=_next_class_order(db, wing.id),
        same_for_all_sections=payload.same_for_all_sections,
        created_by=current_user.id,
    )
    db.add(new_class)
    db.flush()

    # Create initial sections
    sections = payload.initial_sections if payload.initial_sections else ["A"]
    seen = set()
    for order_index, s_name in enumerate(sections):
        s_clean = s_name.strip()
        if s_clean and s_clean.lower() not in seen:
            seen.add(s_clean.lower())
            sec = Section(
                school_id=current_user.school_id,
                class_id=new_class.id,
                name=s_clean,
                order_index=order_index,
                created_by=current_user.id,
            )
            db.add(sec)

    db.add(WingClass(
        school_id=current_user.school_id, wing_id=wing.id,
        class_id=new_class.id, created_by=current_user.id,
    ))

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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
            or_(
                StudentProfile.section_id.in_(select(Section.id).where(Section.class_id == class_id)),
                and_(StudentProfile.section_id.is_(None), func.lower(StudentProfile.class_name) == old_name.lower()),
            ),
        ).update({"class_name": name_clean}, synchronize_session=False)

    if payload.order_index is not None:
        school_class.order_index = payload.order_index

    # Wing assignment update
    if payload.update_wing or "wing_id" in payload.model_fields_set:
        if not payload.wing_id:
            raise HTTPException(400, "Select an academic wing.")
        existing_wing = db.query(WingClass.wing_id).filter_by(
            school_id=current_user.school_id, class_id=class_id, deleted_at=None,
        ).limit(1).scalar()
        if existing_wing != payload.wing_id:
            school_class.order_index = _next_class_order(db, payload.wing_id)
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
    if (payload.same_for_all_sections is not None
            and payload.same_for_all_sections != school_class.same_for_all_sections):
        toggle_class_shared_subjects(
            class_id, ClassToggleSharedRequest(same_for_all_sections=payload.same_for_all_sections),
            current_user, db,
        )
    else:
        db.commit()
    return {"success": True, "id": str(school_class.id), "name": school_class.name}


@router.put("/classes/reorder")
def reorder_classes(
    payload: ClassReorderRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Batch reorder classes by updating their order_index."""
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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

    if not db.query(WingClass.id).join(Wing).filter(
        WingClass.class_id == class_id, WingClass.school_id == current_user.school_id,
        WingClass.deleted_at.is_(None), Wing.deleted_at.is_(None),
    ).first():
        raise HTTPException(409, "Assign this class to a wing before adding sections.")

    siblings = db.query(Section).filter_by(
        class_id=class_id, school_id=current_user.school_id, deleted_at=None,
    ).all()
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
        order_index=max((s.order_index for s in siblings), default=-1) + 1,
        parallel_subject_ids=list(siblings[0].parallel_subject_ids or [])
        if school_class.same_for_all_sections and siblings else [],
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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
            or_(
                StudentProfile.section_id == sec.id,
                and_(StudentProfile.section_id.is_(None),
                     func.lower(StudentProfile.class_name) == parent_class.name.lower(),
                     func.lower(StudentProfile.section) == old_name.lower()),
            ),
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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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


@router.put("/classes/{class_id}/toggle-shared")
def toggle_class_shared_subjects(
    class_id: UUID,
    payload: ClassToggleSharedRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Toggle the 'same_for_all_sections' flag for a class.
    - When switching to FALSE (section-specific):
      Copies current shared subjects to each active section so each section
      can have separate subjects without losing the existing ones.
    - When switching to TRUE (shared across all sections):
      Unifies subjects across all sections using source_section_id or merge_all.
    """
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
    school_class = (
        db.query(SchoolClass)
        .options(
            selectinload(SchoolClass.sections),
            selectinload(SchoolClass.class_subjects).joinedload(ClassSubject.subject),
        )
        .filter(
            SchoolClass.id == class_id,
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        )
        .first()
    )
    if not school_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found.",
        )

    active_sections = [s for s in school_class.sections if s.deleted_at is None]
    active_class_subjects = [
        cs for cs in school_class.class_subjects
        if cs.deleted_at is None and cs.subject and cs.subject.deleted_at is None
    ]

    target_shared = payload.same_for_all_sections

    if target_shared == school_class.same_for_all_sections:
        return {"success": True, "class_id": str(class_id), "same_for_all_sections": target_shared}

    if not target_shared:
        # Switching from Shared -> Section-Specific (False)
        # 1. Collect all distinct subjects currently configured (shared or existing)
        distinct_subjects = {}
        for cs in active_class_subjects:
            if cs.subject_id not in distinct_subjects:
                distinct_subjects[cs.subject_id] = cs

        # 2. For each section, ensure it has an explicit ClassSubject entry for every subject
        for sec in active_sections:
            existing_sec_sub_ids = {
                cs.subject_id: cs for cs in active_class_subjects if cs.section_id == sec.id
            }
            for sub_id, shared_cs in distinct_subjects.items():
                if sub_id not in existing_sec_sub_ids:
                    new_cs = ClassSubject(
                        school_id=current_user.school_id,
                        class_id=school_class.id,
                        section_id=sec.id,
                        subject_id=sub_id,
                        teacher_id=None,  # Teacher assignment is strictly independent per section
                        created_by=current_user.id,
                    )
                    db.add(new_cs)

        # 3. Clean up class-level records (section_id is None) so section records take full control
        db.query(ClassSubject).filter(
            ClassSubject.class_id == school_class.id,
            ClassSubject.section_id.is_(None),
            ClassSubject.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        school_class.same_for_all_sections = False

    else:
        # Switching from Section-Specific -> Shared (True)
        # Determine the canonical set of subjects to share
        active_sections.sort(key=_natural_section_key)
        source = next((sec for sec in active_sections if sec.id == payload.source_section_id), None)
        if payload.source_section_id and not source:
            raise HTTPException(400, "Select a section from this class.")
        canonical_subject_ids = []
        if payload.source_section_id:
            sec_cs = [
                cs for cs in active_class_subjects if cs.section_id == payload.source_section_id
            ]
            canonical_subject_ids = [cs.subject_id for cs in sec_cs]
        elif payload.merge_all:
            seen_ids = set()
            for cs in active_class_subjects:
                if cs.subject_id not in seen_ids:
                    seen_ids.add(cs.subject_id)
                    canonical_subject_ids.append(cs.subject_id)
        else:
            # Default to first section or existing class-level subjects
            if active_sections:
                first_sec_cs = [
                    cs for cs in active_class_subjects if cs.section_id == active_sections[0].id
                ]
                canonical_subject_ids = [cs.subject_id for cs in first_sec_cs]
            if not canonical_subject_ids:
                canonical_subject_ids = list({cs.subject_id for cs in active_class_subjects})

        # 1. Update/create class-level entries (section_id is None)
        existing_shared_map = {
            cs.subject_id: cs for cs in active_class_subjects if cs.section_id is None
        }
        for sub_id in canonical_subject_ids:
            if sub_id not in existing_shared_map:
                new_cs = ClassSubject(
                    school_id=current_user.school_id,
                    class_id=school_class.id,
                    section_id=None,
                    subject_id=sub_id,
                    created_by=current_user.id,
                )
                db.add(new_cs)

        # Delete any class-level shared subjects not in canonical list
        db.query(ClassSubject).filter(
            ClassSubject.class_id == school_class.id,
            ClassSubject.section_id.is_(None),
            ClassSubject.subject_id.notin_(canonical_subject_ids),
            ClassSubject.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        # 2. For each section, remove section-specific ClassSubject records for subjects not in canonical list
        db.query(ClassSubject).filter(
            ClassSubject.class_id == school_class.id,
            ClassSubject.section_id.isnot(None),
            ClassSubject.subject_id.notin_(canonical_subject_ids),
            ClassSubject.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        if payload.merge_all:
            sources = active_sections
        else:
            sources = [source or active_sections[0]] if active_sections else []
        canonical_ids = {str(subject_id) for subject_id in canonical_subject_ids}
        parallel_ids = sorted({
            pid for sec in sources for pid in (sec.parallel_subject_ids or []) if pid in canonical_ids
        })
        for sec in active_sections:
            sec.parallel_subject_ids = parallel_ids
        school_class.same_for_all_sections = True

    school_class.updated_by = current_user.id
    db.commit()

    return {
        "success": True,
        "class_id": str(school_class.id),
        "same_for_all_sections": school_class.same_for_all_sections,
        "message": (
            f"All sections of '{school_class.name}' now share the same subjects."
            if school_class.same_for_all_sections
            else f"Each section of '{school_class.name}' now has separate subjects."
        ),
    }


@router.put("/classes/{class_id}/subjects")
def assign_class_subjects(
    class_id: UUID,
    payload: ClassSubjectsAssignRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Explicitly assign shared subjects for a class across all its sections.
    """
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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

    # Clear existing class-level mappings
    db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id,
        ClassSubject.section_id.is_(None),
        ClassSubject.school_id == current_user.school_id,
    ).delete(synchronize_session=False)

    # Add new class-level mappings (class-level shared subjects have no teacher; teachers are per section)
    all_assigned_ids = []
    for sub_id in payload.subject_ids:
        sub = (
            db.query(Subject)
            .options(selectinload(Subject.child_subjects))
            .filter(
                Subject.id == sub_id,
                Subject.school_id == current_user.school_id,
                Subject.deleted_at.is_(None),
            )
            .first()
        )
        if sub:
            all_assigned_ids.append(sub.id)
            cs = ClassSubject(
                school_id=current_user.school_id,
                class_id=class_id,
                section_id=None,
                subject_id=sub.id,
                teacher_id=None,
                created_by=current_user.id,
            )
            db.add(cs)
            if getattr(sub, "is_split", False) and getattr(sub, "child_subjects", None):
                for child in sub.child_subjects:
                    if child.deleted_at is None:
                        all_assigned_ids.append(child.id)
                        child_cs = ClassSubject(
                            school_id=current_user.school_id,
                            class_id=class_id,
                            section_id=None,
                            subject_id=child.id,
                            teacher_id=None,
                            created_by=current_user.id,
                        )
                        db.add(child_cs)

    # Clean up section-specific records for subjects no longer in payload
    db.query(ClassSubject).filter(
        ClassSubject.class_id == class_id,
        ClassSubject.section_id.isnot(None),
        ClassSubject.subject_id.notin_(all_assigned_ids),
        ClassSubject.school_id == current_user.school_id,
    ).delete(synchronize_session=False)

    assigned_ids = {str(subject_id) for subject_id in all_assigned_ids}
    for sec in db.query(Section).filter_by(
        school_id=current_user.school_id, class_id=class_id, deleted_at=None,
    ):
        sec.parallel_subject_ids = [pid for pid in (sec.parallel_subject_ids or []) if pid in assigned_ids]

    school_class.updated_by = current_user.id
    db.commit()

    return {
        "success": True,
        "message": f"Updated shared subjects for {school_class.name}.",
        "count": len(payload.subject_ids),
    }


@router.put("/classes/{class_id}/sections/{section_id}/subjects")
def assign_section_subjects(
    class_id: UUID,
    section_id: UUID,
    payload: SectionSubjectsAssignRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Assign subjects for a specific section.
    If 'same_for_all_sections' is enabled for this class, updates class-level shared
    subjects across all sections. Otherwise, updates only this section's subjects.
    """
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
    ).with_for_update().first()
    if not sec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found in specified class.",
        )

    if school_class.same_for_all_sections:
        return assign_class_subjects(
            class_id, ClassSubjectsAssignRequest(subject_ids=payload.subject_ids), current_user, db,
        )

    # Keep retained allocations (including the teacher and room) when editing the list.
    subjects = db.query(Subject).options(selectinload(Subject.child_subjects)).filter(
        Subject.school_id == current_user.school_id, Subject.id.in_(payload.subject_ids),
        Subject.deleted_at.is_(None),
    ).all()
    wanted = {sub.id for sub in subjects}
    wanted.update(child.id for sub in subjects if sub.is_split for child in sub.child_subjects
                  if child.deleted_at is None and child.school_id == current_user.school_id)
    assigned_ids = {str(subject_id) for subject_id in wanted}
    sec.parallel_subject_ids = [pid for pid in (sec.parallel_subject_ids or []) if pid in assigned_ids]
    existing = db.query(ClassSubject).filter_by(
        class_id=class_id, section_id=sec.id, school_id=current_user.school_id, deleted_at=None,
    ).with_for_update().all()
    for row in existing:
        if row.subject_id in wanted:
            wanted.remove(row.subject_id)
        else:
            db.delete(row)
    for subject_id in wanted:
        db.add(ClassSubject(school_id=current_user.school_id, class_id=class_id, section_id=sec.id,
                            subject_id=subject_id, created_by=current_user.id))

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


def _section_teacher_conflict_warning(db: Session, sec: Section, teacher_user: User | None, tt_entries: list[TimetableEntry]) -> dict | None:
    # Detect any timetable schedule conflicts introduced by this assignment (Non-blocking)
    warning_payload = None
    if teacher_user and tt_entries:
        try:
            entry_ids = [e.id for e in tt_entries]
            other_entries = (
                db.query(TimetableEntry)
                .options(
                    joinedload(TimetableEntry.period),
                    joinedload(TimetableEntry.section).joinedload(Section.school_class),
                    joinedload(TimetableEntry.subject),
                )
                .filter(
                    TimetableEntry.school_id == sec.school_id,
                    TimetableEntry.teacher_user_id == teacher_user.id,
                    TimetableEntry.deleted_at.is_(None),
                    TimetableEntry.id.notin_(entry_ids),
                )
                .all()
            )

            conflict_summaries = []
            seen_pairs = set()

            for entry in tt_entries:
                p1 = entry.period
                if not p1 or not p1.start_time or not p1.end_time:
                    continue

                for other in other_entries:
                    if entry.timetable_id and other.timetable_id and entry.timetable_id != other.timetable_id:
                        continue
                    if entry.day_of_week != other.day_of_week:
                        continue

                    p2 = other.period
                    if not p2 or not p2.start_time or not p2.end_time:
                        continue

                    # Check overlapping time interval: max(start1, start2) < min(end1, end2)
                    if max(p1.start_time, p2.start_time) < min(p1.end_time, p2.end_time):
                        pair_key = tuple(sorted([str(entry.id), str(other.id)]))
                        if pair_key not in seen_pairs:
                            seen_pairs.add(pair_key)
                            sec1_name = f"{sec.school_class.name}-{sec.name}" if (sec and sec.school_class) else sec.name
                            other_sec = other.section
                            sec2_name = f"{other_sec.school_class.name}-{other_sec.name}" if (other_sec and other_sec.school_class) else (other_sec.name if other_sec else "another section")
                            day_label = entry.day_of_week.capitalize()
                            p_label = f"Period {p1.period_number}" if p1.period_number else ""
                            conflict_summaries.append(f"{sec1_name} & {sec2_name} on {day_label} {p_label}".strip())

            if conflict_summaries:
                count = len(conflict_summaries)
                examples_str = "; ".join(conflict_summaries[:2])
                if count > 2:
                    examples_str += f" (+{count - 2} more)"
                t_name = f"{teacher_user.first_name} {teacher_user.last_name}".strip()
                warning_payload = {
                    "has_conflict": True,
                    "conflict_count": count,
                    "details": f"{t_name} is double-booked: {examples_str}. Please review and resolve on the Timetable page.",
                }
        except Exception:
            # Non-blocking: warning detection failure should never fail teacher assignment
            pass

    return warning_payload


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
        .with_for_update()
        .first()
    )
    if not sec or (class_id is not None and sec.class_id != class_id):
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
                User.role == UserRole.STAFF,
                StaffProfile.is_academic.is_(True),
                StaffProfile.school_id == current_user.school_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
            .first()
        )
        if not teacher_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Select an active academic staff member.",
            )

        school_wings = db.query(Wing).filter_by(school_id=current_user.school_id, deleted_at=None)
        if school_wings.first() is not None:
            class_wing_id = (
                school_wings.with_entities(Wing.id)
                .join(WingClass, WingClass.wing_id == Wing.id)
                .filter(WingClass.class_id == sec.class_id, WingClass.deleted_at.is_(None))
                .scalar()
            )
            if class_wing_id not in teacher_user.staff_profile.assigned_wing_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Select a teacher assigned to this class's wing.",
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

    # Collect subject ids to sync (including split child subjects if any)
    sub_ids_to_sync = [sub.id]
    if getattr(sub, "is_split", False) and getattr(sub, "child_subjects", None):
        for child in sub.child_subjects:
            if child.deleted_at is None:
                sub_ids_to_sync.append(child.id)
                child_cs = (
                    db.query(ClassSubject)
                    .filter(
                        ClassSubject.section_id == sec.id,
                        ClassSubject.subject_id == child.id,
                        ClassSubject.school_id == current_user.school_id,
                        ClassSubject.deleted_at.is_(None),
                    )
                    .first()
                )
                if child_cs:
                    child_cs.teacher_id = teacher_user.id if teacher_user else None
                    child_cs.updated_by = current_user.id
                else:
                    child_cs = ClassSubject(
                        school_id=current_user.school_id,
                        class_id=sec.class_id,
                        section_id=sec.id,
                        subject_id=child.id,
                        teacher_id=teacher_user.id if teacher_user else None,
                        created_by=current_user.id,
                    )
                    db.add(child_cs)

    timetables = TimetableService(db).lock_school_timetables(sec.school_id)

    # Synchronize existing timetable entries for this section and subject(s).
    tt_entries = (
        db.query(TimetableEntry)
        .options(
            joinedload(TimetableEntry.period),
            joinedload(TimetableEntry.section).joinedload(Section.school_class),
        )
        .filter(
            TimetableEntry.school_id == current_user.school_id,
            TimetableEntry.section_id == sec.id,
            TimetableEntry.subject_id.in_(sub_ids_to_sync),
            TimetableEntry.placement_id.is_(None),
            TimetableEntry.deleted_at.is_(None),
        )
        .all()
    )

    for entry in tt_entries:
        entry.teacher_user_id = teacher_user.id if teacher_user else None
        entry.updated_by = current_user.id

    affected_ids = {entry.timetable_id for entry in tt_entries}
    for timetable in timetables:
        if timetable.id in affected_ids:
            timetable.version = (timetable.version or 1) + 1
            timetable.updated_by = current_user.id
    db.commit()

    warning_payload = _section_teacher_conflict_warning(db, sec, teacher_user, tt_entries)

    return {
        "success": True,
        "section_id": str(sec.id),
        "subject_id": str(sub.id),
        "teacher_id": str(teacher_user.id) if teacher_user else None,
        "teacher": _format_teacher(teacher_user).model_dump() if teacher_user else None,
        "warning": warning_payload,
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
        .options(
            joinedload(User.staff_profile).selectinload(StaffProfile.staff_wings)
        )
        .filter(
            StaffProfile.school_id == current_user.school_id,
            StaffProfile.is_academic.is_(True),
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
        c_ids = set(payload.assigned_class_ids or [])
        s_ids = set(payload.assigned_section_ids or [])
        existing = db.query(ClassSubject).filter_by(
            subject_id=sub.id, school_id=current_user.school_id, deleted_at=None,
        ).with_for_update().all()
        keep_classes, keep_sections = set(), set()
        for row in existing:
            if row.section_id is None and row.class_id in c_ids:
                keep_classes.add(row.class_id)
            elif row.section_id and (row.section_id in s_ids or
                    (row.class_id in c_ids and (row.room_override or row.teacher_id))):
                keep_sections.add(row.section_id)
            else:
                db.delete(row)
        c_ids -= keep_classes
        s_ids -= keep_sections
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


@router.put("/subjects/{subject_id}/split")
def split_subject(
    subject_id: UUID,
    payload: SubjectSplitRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Split an academic subject into multiple child parts (e.g., Science -> Physics, Chemistry, Bio),
    or un-split if parts is empty.
    """
    sub = (
        db.query(Subject)
        .options(selectinload(Subject.child_subjects), selectinload(Subject.class_subjects))
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

    if not sub.is_academic or sub.category != "academic":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only academic subjects can be split into parts.",
        )

    if sub.parent_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Child subjects cannot be split further.",
        )

    cleaned_parts = [p.strip() for p in payload.parts if p and p.strip()]

    # Un-split if empty parts
    if not cleaned_parts:
        sub.is_split = False
        sub.updated_by = current_user.id
        now = datetime.now(timezone.utc)
        for child in sub.child_subjects:
            if child.deleted_at is None:
                child.deleted_at = now
                child.deleted_by = current_user.id
                db.query(ClassSubject).filter(
                    ClassSubject.subject_id == child.id,
                    ClassSubject.school_id == current_user.school_id,
                    ClassSubject.deleted_at.is_(None),
                ).update({"deleted_at": now, "deleted_by": current_user.id}, synchronize_session=False)
        db.commit()
        return {
            "success": True,
            "message": f"Subject '{sub.name}' is now unified (un-split).",
            "is_split": False,
            "child_subjects": [],
        }

    # Validate at least 2 parts when splitting
    if len(cleaned_parts) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A split subject must have at least 2 parts (e.g., Physics, Chemistry, Biology).",
        )

    # Check for duplicate names within the parts
    lower_names = [p.lower() for p in cleaned_parts]
    if len(lower_names) != len(set(lower_names)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Part names must be unique within the split subject.",
        )

    sub.is_split = True
    sub.updated_by = current_user.id
    now = datetime.now(timezone.utc)

    # Existing active child subjects
    existing_children = {c.name.lower(): c for c in sub.child_subjects if c.deleted_at is None}
    kept_child_ids = []

    # Map of classes/sections where parent subject is assigned
    parent_cs_list = (
        db.query(ClassSubject)
        .filter(
            ClassSubject.subject_id == sub.id,
            ClassSubject.school_id == current_user.school_id,
            ClassSubject.deleted_at.is_(None),
        )
        .all()
    )

    child_responses = []
    for idx, part_name in enumerate(cleaned_parts):
        key = part_name.lower()
        if key in existing_children:
            child = existing_children[key]
            child.name = part_name
            child.order_index = idx
            child.updated_by = current_user.id
        else:
            # Check if there is a soft-deleted child with this name to reactivate
            soft_deleted = (
                db.query(Subject)
                .filter(
                    Subject.school_id == current_user.school_id,
                    Subject.parent_id == sub.id,
                    func.lower(Subject.name) == key,
                )
                .first()
            )
            if soft_deleted:
                child = soft_deleted
                child.name = part_name
                child.order_index = idx
                child.deleted_at = None
                child.deleted_by = None
                child.updated_by = current_user.id
            else:
                child = Subject(
                    school_id=current_user.school_id,
                    name=part_name,
                    category=sub.category,
                    is_academic=True,
                    order_index=idx,
                    parent_id=sub.id,
                    is_split=False,
                    created_by=current_user.id,
                )
                db.add(child)
                db.flush()

        kept_child_ids.append(child.id)

        # Ensure child is assigned to all classes/sections where parent is assigned
        for pcs in parent_cs_list:
            existing_child_cs = (
                db.query(ClassSubject)
                .filter(
                    ClassSubject.subject_id == child.id,
                    ClassSubject.class_id == pcs.class_id,
                    ClassSubject.section_id == pcs.section_id,
                    ClassSubject.school_id == current_user.school_id,
                    ClassSubject.deleted_at.is_(None),
                )
                .first()
            )
            if not existing_child_cs:
                new_cs = ClassSubject(
                    school_id=current_user.school_id,
                    class_id=pcs.class_id,
                    section_id=pcs.section_id,
                    subject_id=child.id,
                    teacher_id=None,
                    created_by=current_user.id,
                )
                db.add(new_cs)

        child_responses.append(
            SubjectOptionResponse(
                id=child.id,
                name=child.name,
                code=child.code,
                category=child.category,
                is_academic=child.is_academic,
                order_index=child.order_index,
                is_split=False,
                parent_id=sub.id,
                parent_name=sub.name,
            )
        )

    # Soft delete children no longer in cleaned_parts
    for c_key, c_obj in existing_children.items():
        if c_obj.id not in kept_child_ids:
            c_obj.deleted_at = now
            c_obj.deleted_by = current_user.id
            db.query(ClassSubject).filter(
                ClassSubject.subject_id == c_obj.id,
                ClassSubject.school_id == current_user.school_id,
                ClassSubject.deleted_at.is_(None),
            ).update({"deleted_at": now, "deleted_by": current_user.id}, synchronize_session=False)

    db.commit()

    return {
        "success": True,
        "message": f"Subject '{sub.name}' split into {len(cleaned_parts)} parts successfully.",
        "is_split": True,
        "child_subjects": [c.model_dump() for c in child_responses],
    }


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: UUID,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete a subject with safety check for active timetable entries."""
    sub = (
        db.query(Subject)
        .options(selectinload(Subject.child_subjects))
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

    # Check if sub or any child subjects have timetable entries
    sub_ids = [sub.id]
    if getattr(sub, "is_split", False) and getattr(sub, "child_subjects", None):
        sub_ids.extend([c.id for c in sub.child_subjects if c.deleted_at is None])

    tt_count = db.query(TimetableEntry).filter(
        TimetableEntry.school_id == current_user.school_id,
        TimetableEntry.subject_id.in_(sub_ids),
        TimetableEntry.deleted_at.is_(None),
    ).count()
    if tt_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Subject '{sub.name}' because active timetable entries exist for it or its parts.",
        )

    now = datetime.now(timezone.utc)
    sub.deleted_at = now
    sub.deleted_by = current_user.id

    for cid in sub_ids:
        if cid != sub.id:
            db.query(Subject).filter(Subject.id == cid).update(
                {"deleted_at": now, "deleted_by": current_user.id},
                synchronize_session=False,
            )

    db.query(ClassSubject).filter(
        ClassSubject.subject_id.in_(sub_ids),
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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
        order_index=(db.query(func.max(Wing.order_index)).filter_by(
            school_id=current_user.school_id, deleted_at=None,
        ).scalar() or 0) + 1,
        created_by=current_user.id,
    )
    db.add(wing)
    db.flush()

    for order_index, cid in enumerate(dict.fromkeys(payload.class_ids)):
        c_rec = db.query(SchoolClass).filter(
            SchoolClass.id == cid,
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        ).first()
        if c_rec:
            c_rec.order_index = order_index
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
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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
        assigned = {row.class_id for row in db.query(WingClass).filter_by(
            school_id=current_user.school_id, wing_id=wing.id, deleted_at=None,
        )}
        if assigned.difference(payload.class_ids):
            raise HTTPException(409, "Move classes to another wing to remove them from this wing.")
        next_order = _next_class_order(db, wing.id)

        # Replace mappings atomically.
        db.query(WingClass).filter(
            WingClass.wing_id == wing.id,
            WingClass.school_id == current_user.school_id,
        ).delete(synchronize_session=False)

        for cid in dict.fromkeys(payload.class_ids):
            c_rec = db.query(SchoolClass).filter(
                SchoolClass.id == cid,
                SchoolClass.school_id == current_user.school_id,
                SchoolClass.deleted_at.is_(None),
            ).first()
            if c_rec:
                if cid not in assigned:
                    c_rec.order_index = next_order
                    next_order += 1
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
    """Delete a wing after its classes have been moved."""
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
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

    if db.query(WingClass.id).join(SchoolClass).filter(
        WingClass.wing_id == wing.id, WingClass.school_id == current_user.school_id,
        WingClass.deleted_at.is_(None), SchoolClass.deleted_at.is_(None),
    ).first():
        raise HTTPException(409, "Move this wing’s classes before deleting it.")

    now = datetime.now(timezone.utc)
    wing.deleted_at = now
    wing.deleted_by = current_user.id
    db.commit()
    return {"success": True, "message": f"Wing '{wing.name}' deleted."}


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
    if current_user.school_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A school account is required.")
    unique_filename = await save_emblem(file)
    emblem_relative_url = f"/uploads/emblems/{unique_filename}"

    return EmblemUploadResponse(
        success=True,
        emblem_url=emblem_relative_url,
        filename=unique_filename,
    )


@router.put("/sections/{section_id}/room-mode")
def set_section_room_mode(
    section_id: UUID, payload: SectionRoomModeRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)],
):
    section = db.query(Section).filter_by(
        id=section_id, school_id=current_user.school_id, deleted_at=None,
    ).with_for_update().first()
    if not section:
        raise HTTPException(404, "Section not found.")
    section.single_room = payload.single_room
    section.updated_by = current_user.id
    db.commit()
    return {"single_room": section.single_room}


@router.put("/sections/{section_id}/room")
@router.put("/sections/{section_id}/subjects/{subject_id}/room")
def set_section_room(
    section_id: UUID, payload: RoomUpdateRequest,
    current_user: Annotated[User, Depends(require_manage_school)],
    db: Annotated[Session, Depends(get_db)], subject_id: UUID | None = None,
):
    school = current_user.school_id
    section = db.query(Section).filter_by(id=section_id, school_id=school, deleted_at=None).with_for_update().first()
    if not section:
        raise HTTPException(404, "Section not found.")
    label = payload.room_number or None
    if subject_id is None:
        section.room_number = label
    else:
        if section.single_room:
            raise HTTPException(409, "Turn off the shared room setting to edit subject rooms.")
        reviews = dict(section.room_reviews or {})
        allocation = db.query(ClassSubject).join(Subject).filter(
            ClassSubject.school_id == school, ClassSubject.class_id == section.class_id,
            ClassSubject.subject_id == subject_id, ClassSubject.deleted_at.is_(None),
            Subject.school_id == school, Subject.deleted_at.is_(None),
        )
        row = allocation.filter(ClassSubject.section_id == section.id).with_for_update(of=ClassSubject).first()
        if row:
            row.room_override = label
            row.updated_by = current_user.id
        elif allocation.filter(ClassSubject.section_id.is_(None)).first():
            if label:
                statement = insert(ClassSubject).values(
                    school_id=school, class_id=section.class_id, section_id=section.id,
                    subject_id=subject_id, room_override=label, created_by=current_user.id,
                )
                db.execute(statement.on_conflict_do_update(
                    index_elements=[ClassSubject.class_id, ClassSubject.section_id, ClassSubject.subject_id],
                    index_where=ClassSubject.deleted_at.is_(None),
                    set_={"room_override": label, "updated_by": current_user.id, "updated_at": func.now()},
                ))
        elif label or str(subject_id) not in reviews:
            raise HTTPException(404, "Assign this subject to the section first.")
        if reviews.pop(str(subject_id), None) is not None:
            section.room_reviews = reviews
    section.updated_by = current_user.id
    db.commit()
    return {"success": True}


@router.put("/sections/{section_id}/parallel/{subject_id}")
def set_parallel_subject(section_id: UUID, subject_id: UUID, enabled: bool,
                         current_user: Annotated[User, Depends(require_manage_school)],
                         db: Annotated[Session, Depends(get_db)]):
    school = current_user.school_id
    db.query(School.id).filter(School.id == current_user.school_id).with_for_update().first()
    TimetableService(db).lock_school_timetables(school)
    section = db.query(Section).filter_by(id=section_id, school_id=school, deleted_at=None).with_for_update().first()
    if not section or not db.query(Subject.id).filter_by(id=subject_id, school_id=school, deleted_at=None).first():
        raise HTTPException(404, "Section or subject not found.")
    if enabled:
        allocation = db.query(ClassSubject.id).filter_by(school_id=school, class_id=section.class_id,
            subject_id=subject_id, deleted_at=None).filter(or_(ClassSubject.section_id == section_id,
            ClassSubject.section_id.is_(None))).first()
        if not allocation:
            raise HTTPException(400, "Assign this subject to the section first.")
    school_class = db.query(SchoolClass).filter_by(id=section.class_id, school_id=school).first()
    sections = [section]
    if school_class.same_for_all_sections:
        sections = db.query(Section).filter_by(
            school_id=school, class_id=section.class_id, deleted_at=None,
        ).all()
    for target in sections:
        ids = set(target.parallel_subject_ids or [])
        if enabled:
            ids.add(str(subject_id))
        else:
            ids.discard(str(subject_id))
        target.parallel_subject_ids = sorted(ids)
    db.commit()
    return {"enabled": enabled}
