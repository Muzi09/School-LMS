from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.house import House
from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.user import User
from app.schemas.school_config import (
    ClassOptionResponse,
    HouseOptionResponse,
    SectionOptionResponse,
)

router = APIRouter(prefix="/school", tags=["School Configuration"])


@router.get("/classes", response_model=List[ClassOptionResponse])
def get_school_classes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get configured classes and their sections for the current user's school.
    Enforces strict tenant isolation.
    """
    if not current_user.school_id:
        return []

    classes = (
        db.query(SchoolClass)
        .options(selectinload(SchoolClass.sections))
        .filter(
            SchoolClass.school_id == current_user.school_id,
            SchoolClass.deleted_at.is_(None),
        )
        .order_by(SchoolClass.order_index.asc(), SchoolClass.name.asc())
        .all()
    )

    result: List[ClassOptionResponse] = []
    for c in classes:
        active_sections = [
            SectionOptionResponse(id=s.id, class_id=s.class_id, name=s.name)
            for s in c.sections
            if s.deleted_at is None
        ]
        result.append(
            ClassOptionResponse(
                id=c.id,
                name=c.name,
                order_index=c.order_index,
                sections=active_sections,
            )
        )

    return result


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
