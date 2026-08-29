from datetime import datetime
from typing import Any, Generic, Sequence, Type, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic Base Repository implementing standard CRUD operations
    following SQLAlchemy 2.0 paradigms.
    """

    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: UUID, include_deleted: bool = False) -> ModelType | None:
        """Fetch a single record by its UUID primary key."""
        stmt = select(self.model).where(self.model.id == id)
        if hasattr(self.model, "deleted_at") and not include_deleted:
            stmt = stmt.where(self.model.deleted_at.is_(None))
        return self.db.scalars(stmt).first()

    def list(
        self,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False,
    ) -> Sequence[ModelType]:
        """Fetch a list of records with pagination."""
        stmt = select(self.model)
        if hasattr(self.model, "deleted_at") and not include_deleted:
            stmt = stmt.where(self.model.deleted_at.is_(None))
        stmt = stmt.offset(skip).limit(limit)
        return self.db.scalars(stmt).all()

    def count(self, include_deleted: bool = False) -> int:
        """Count total active records."""
        stmt = select(func.count(self.model.id))
        if hasattr(self.model, "deleted_at") and not include_deleted:
            stmt = stmt.where(self.model.deleted_at.is_(None))
        return self.db.scalar(stmt) or 0

    def create(self, instance: ModelType, autocommit: bool = True) -> ModelType:
        """Add and persist a new model instance."""
        self.db.add(instance)
        if autocommit:
            self.db.commit()
            self.db.refresh(instance)
        else:
            self.db.flush()
        return instance

    def update(
        self,
        instance: ModelType,
        attributes: dict[str, Any],
        updated_by_id: UUID | None = None,
        autocommit: bool = True,
    ) -> ModelType:
        """Update model instance attributes."""
        for key, value in attributes.items():
            if hasattr(instance, key):
                setattr(instance, key, value)

        if hasattr(instance, "updated_at"):
            setattr(instance, "updated_at", datetime.utcnow())
        if hasattr(instance, "updated_by") and updated_by_id:
            setattr(instance, "updated_by", updated_by_id)

        if autocommit:
            self.db.commit()
            self.db.refresh(instance)
        else:
            self.db.flush()
        return instance

    def delete(self, instance: ModelType, autocommit: bool = True) -> None:
        """Hard delete a record from the database."""
        self.db.delete(instance)
        if autocommit:
            self.db.commit()
        else:
            self.db.flush()

    def soft_delete(
        self,
        instance: ModelType,
        deleted_by_id: UUID | None = None,
        autocommit: bool = True,
    ) -> ModelType:
        """Soft delete a record by setting deleted_at timestamp."""
        now = datetime.utcnow()
        if hasattr(instance, "deleted_at"):
            setattr(instance, "deleted_at", now)
        if hasattr(instance, "deleted_by") and deleted_by_id:
            setattr(instance, "deleted_by", deleted_by_id)
        if hasattr(instance, "is_active"):
            setattr(instance, "is_active", False)
        if hasattr(instance, "updated_at"):
            setattr(instance, "updated_at", now)

        if autocommit:
            self.db.commit()
            self.db.refresh(instance)
        else:
            self.db.flush()
        return instance
