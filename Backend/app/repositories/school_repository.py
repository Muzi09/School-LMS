from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.school import School
from app.repositories.base import BaseRepository


class SchoolRepository(BaseRepository[School]):
    """Data access repository for School entities."""

    def __init__(self, db: Session):
        super().__init__(model=School, db=db)

    def get_active_by_id(self, school_id: UUID) -> School | None:
        """Fetch active (non-deleted) school by ID."""
        stmt = select(School).where(
            School.id == school_id,
            School.deleted_at.is_(None),
        )
        return self.db.scalars(stmt).first()

    def get_by_code(self, code: str) -> School | None:
        """Fetch school by its unique code."""
        stmt = select(School).where(
            School.code == code,
            School.deleted_at.is_(None),
        )
        return self.db.scalars(stmt).first()
