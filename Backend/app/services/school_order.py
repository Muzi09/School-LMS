"""Display order for the school hierarchy."""
from sqlalchemy import select

from app.models.school_class import SchoolClass
from app.models.section import Section
from app.models.wing import Wing, WingClass


def class_order():
    def wing_value(column):
        return (
            select(column).select_from(WingClass).join(Wing)
            .where(WingClass.class_id == SchoolClass.id,
                   WingClass.school_id == SchoolClass.school_id,
                   WingClass.deleted_at.is_(None), Wing.deleted_at.is_(None))
            .order_by(Wing.order_index, Wing.name, Wing.id).limit(1)
            .correlate(SchoolClass).scalar_subquery().nulls_last()
        )

    return (wing_value(Wing.order_index), wing_value(Wing.name),
            SchoolClass.order_index, SchoolClass.name, SchoolClass.id)


def section_order():
    return (Section.order_index, Section.name, Section.id)
