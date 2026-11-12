from datetime import date, datetime
from typing import TYPE_CHECKING, List
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from app.models.base import Base, AuditMixin
from app.models.enums import Gender

if TYPE_CHECKING:
    from app.models.school import School
    from app.models.user import User
    from app.models.wing import Wing


class StaffWing(Base, AuditMixin):
    """
    Mapping indicating which Wing(s) an academic staff member belongs to.
    """
    __tablename__ = "staff_wings"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    school_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
    )

    staff_profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("staff_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    wing_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("wings.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    staff_profile: Mapped["StaffProfile"] = relationship(
        "StaffProfile",
        back_populates="staff_wings",
    )

    wing: Mapped["Wing"] = relationship(
        "Wing",
        foreign_keys=[wing_id],
    )

    @declared_attr
    def __table_args__(cls):
        return (
            Index("idx_staff_wings_school_id", cls.school_id),
            Index("idx_staff_wings_staff_profile_id", cls.staff_profile_id),
            Index("idx_staff_wings_wing_id", cls.wing_id),
            Index(
                "uq_staff_wings_profile_wing",
                cls.staff_profile_id,
                cls.wing_id,
                unique=True,
                postgresql_where=cls.deleted_at.is_(None),
            ),
        )


class StaffProfile(Base):
    __tablename__ = "staff_profiles"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
    )

    school_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "schools.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    roll_no: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    gender: Mapped[Gender] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    date_of_birth: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    pin_hash: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING_ACTIVATION",
        server_default="PENDING_ACTIVATION",
    )

    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    designation: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        default="Teacher",
        server_default="Teacher",
    )

    tag: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Teacher",
        server_default="Teacher",
    )

    is_academic: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    is_non_academic: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    working_shifts: Mapped[list[dict] | None] = mapped_column(
        JSONB,
        nullable=True,
        server_default="[]",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="staff_profile",
    )

    school: Mapped["School | None"] = relationship(
        "School",
        foreign_keys=[school_id],
    )

    staff_wings: Mapped[List["StaffWing"]] = relationship(
        "StaffWing",
        back_populates="staff_profile",
        cascade="all, delete-orphan",
    )

    @property
    def assigned_wing_ids(self) -> List[UUID]:
        if not hasattr(self, "staff_wings") or not self.staff_wings:
            return []
        return [sw.wing_id for sw in self.staff_wings if getattr(sw, "deleted_at", None) is None]

    @property
    def assigned_wings(self) -> List[dict]:
        if not hasattr(self, "staff_wings") or not self.staff_wings:
            return []
        return [
            {"id": sw.wing_id, "name": sw.wing.name if sw.wing else ""}
            for sw in self.staff_wings
            if getattr(sw, "deleted_at", None) is None and sw.wing
        ]

    @declared_attr
    def __table_args__(cls):
        return (
            Index(
                "idx_staff_profiles_roll_no",
                cls.roll_no,
            ),
            Index(
                "idx_staff_profiles_status",
                cls.status,
            ),
            Index(
                "idx_staff_profiles_school_id",
                cls.school_id,
            ),
        )
