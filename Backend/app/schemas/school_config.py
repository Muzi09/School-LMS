from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SectionOptionResponse(BaseModel):
    id: UUID
    class_id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class ClassOptionResponse(BaseModel):
    id: UUID
    name: str
    order_index: int
    sections: List[SectionOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class HouseOptionResponse(BaseModel):
    id: UUID
    name: str
    color: str | None = None

    model_config = ConfigDict(from_attributes=True)
