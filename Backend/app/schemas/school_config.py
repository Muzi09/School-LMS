from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SubjectOptionResponse(BaseModel):
    id: UUID
    name: str
    code: str | None = None
    category: str = "academic"
    is_academic: bool = True
    order_index: int = 0

    model_config = ConfigDict(from_attributes=True)


class SectionOptionResponse(BaseModel):
    id: UUID
    class_id: UUID
    name: str
    subjects: List[SubjectOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ClassOptionResponse(BaseModel):
    id: UUID
    name: str
    order_index: int
    same_for_all_sections: bool = True
    sections: List[SectionOptionResponse] = []
    subjects: List[SubjectOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class HouseOptionResponse(BaseModel):
    id: UUID
    name: str
    color: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SectionSubjectsResponse(BaseModel):
    class_name: str
    section: str
    same_for_all_sections: bool
    subjects: List[SubjectOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)

