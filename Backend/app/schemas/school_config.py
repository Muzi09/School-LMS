from typing import Annotated, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class TeacherSimpleRead(BaseModel):
    id: UUID
    name: str
    email: str | None = None
    roll_no: str | None = None
    department: str | None = None
    designation: str | None = None
    tag: str | None = None
    is_academic: bool | None = None
    assigned_wing_ids: list[UUID] = []
    working_shifts: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


class SubjectOptionResponse(BaseModel):
    id: UUID
    name: str
    code: str | None = None
    category: str = "academic"
    is_academic: bool = True
    order_index: int = 0
    is_split: bool = False
    parent_id: UUID | None = None
    parent_name: str | None = None
    child_subjects: List["SubjectOptionResponse"] = []
    teacher_id: UUID | None = None
    teacher: TeacherSimpleRead | None = None

    model_config = ConfigDict(from_attributes=True)


class SectionOptionResponse(BaseModel):
    id: UUID
    class_id: UUID
    name: str
    class_teacher_id: UUID | None = None
    class_teacher: TeacherSimpleRead | None = None
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


# -------------------------------------------------------------
# Manage School Workspace Schemas
# -------------------------------------------------------------

class SchoolConfigCustomization(BaseModel):
    primary_color: str | None = None
    emblem_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RoomUpdateRequest(BaseModel):
    room_number: Annotated[str, StringConstraints(strip_whitespace=True, max_length=16)] | None


class SectionRoomModeRequest(BaseModel):
    single_room: bool


class SchoolConfigClassSection(BaseModel):
    single_room: bool = False
    room_number: str | None = None
    room_overrides: dict[UUID, str] = Field(default_factory=dict)
    room_reviews: dict = Field(default_factory=dict)
    parallel_subject_ids: list[UUID] = Field(default_factory=list)
    id: UUID
    class_id: UUID
    name: str
    class_teacher_id: UUID | None = None
    class_teacher: TeacherSimpleRead | None = None
    subjects: List[SubjectOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SchoolConfigClass(BaseModel):
    id: UUID
    name: str
    order_index: int
    wing_id: UUID | None = None
    wing_name: str | None = None
    sections: List[SchoolConfigClassSection] = []
    subjects: List[SubjectOptionResponse] = []
    same_for_all_sections: bool = True

    model_config = ConfigDict(from_attributes=True)


class SchoolConfigWing(BaseModel):
    id: UUID
    name: str
    order_index: int
    class_ids: List[UUID] = []
    class_names: List[str] = []

    model_config = ConfigDict(from_attributes=True)


class SchoolConfigSubject(BaseModel):
    id: UUID
    name: str
    code: str | None = None
    category: str = "academic"
    is_academic: bool = True
    order_index: int = 0
    is_split: bool = False
    parent_id: UUID | None = None
    parent_name: str | None = None
    child_subjects: List[SubjectOptionResponse] = []
    assigned_class_ids: List[UUID] = []
    assigned_section_ids: List[UUID] = []

    model_config = ConfigDict(from_attributes=True)


class SchoolConfigHouse(BaseModel):
    id: UUID
    name: str
    color: str | None = None
    emblem_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SchoolConfigResponse(BaseModel):
    classes: List[SchoolConfigClass] = []
    wings: List[SchoolConfigWing] = []
    subjects: List[SchoolConfigSubject] = []
    houses: List[SchoolConfigHouse] = []
    customization: SchoolConfigCustomization

    model_config = ConfigDict(from_attributes=True)


# Mutation Requests

class ClassCreateRequest(BaseModel):
    name: str
    order_index: int = 0
    wing_id: UUID
    initial_sections: List[str] = ["A"]
    same_for_all_sections: bool = True


class ClassUpdateRequest(BaseModel):
    name: str | None = None
    order_index: int | None = None
    wing_id: UUID | None = None
    update_wing: bool = False
    same_for_all_sections: bool | None = None


class ClassToggleSharedRequest(BaseModel):
    same_for_all_sections: bool
    source_section_id: UUID | None = None
    merge_all: bool = False


class ClassSubjectsAssignRequest(BaseModel):
    subject_ids: List[UUID]


class ClassReorderItem(BaseModel):
    class_id: UUID
    order_index: int


class ClassReorderRequest(BaseModel):
    classes: List[ClassReorderItem]


class StructureReorderRequest(BaseModel):
    ids: List[UUID]


class SectionCreateRequest(BaseModel):
    name: str


class SectionUpdateRequest(BaseModel):
    name: str | None = None
    class_teacher_id: UUID | None = None


class SectionClassTeacherAssignRequest(BaseModel):
    class_teacher_id: UUID | None = None
    teacher_id: UUID | None = None


class SectionSubjectTeacherAssignRequest(BaseModel):
    teacher_id: UUID | None = None


class SubjectCreateRequest(BaseModel):
    name: str
    code: str | None = None
    category: str = "academic"
    is_academic: bool = True
    order_index: int = 0
    is_split: bool = False
    parent_id: UUID | None = None
    child_subject_names: List[str] | None = None
    assigned_class_ids: List[UUID] = []
    assigned_section_ids: List[UUID] = []


class SubjectUpdateRequest(BaseModel):
    name: str | None = None
    code: str | None = None
    category: str | None = None
    is_academic: bool | None = None
    order_index: int | None = None
    is_split: bool | None = None
    parent_id: UUID | None = None
    child_subject_names: List[str] | None = None
    assigned_class_ids: List[UUID] | None = None
    assigned_section_ids: List[UUID] | None = None


class SubjectSplitRequest(BaseModel):
    parts: List[str] = []


class SubjectReorderItem(BaseModel):
    subject_id: UUID
    order_index: int


class SubjectReorderRequest(BaseModel):
    subjects: List[SubjectReorderItem]


class WingCreateRequest(BaseModel):
    name: str
    order_index: int = 0
    class_ids: List[UUID] = []


class WingUpdateRequest(BaseModel):
    name: str | None = None
    order_index: int | None = None
    class_ids: List[UUID] | None = None


class HouseCreateRequest(BaseModel):
    name: str
    color: str | None = None
    emblem_url: str | None = None


class HouseUpdateRequest(BaseModel):
    name: str | None = None
    color: str | None = None
    emblem_url: str | None = None


class SchoolCustomizationUpdateRequest(BaseModel):
    primary_color: str | None = None
    emblem_url: str | None = None


class SectionSubjectsAssignRequest(BaseModel):
    subject_ids: List[UUID]


class EmblemUploadResponse(BaseModel):
    success: bool
    emblem_url: str
    filename: str

