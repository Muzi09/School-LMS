from typing import List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OnboardingValidateResponse(BaseModel):
    user_id: UUID
    first_name: str
    last_name: str
    email: str
    login_mobile: str
    is_valid: bool
    message: str


class ClassSectionItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Class name e.g. Class 1")
    order_index: int = Field(default=0)
    sections: List[str] = Field(default_factory=lambda: ["A"], description="List of section names e.g. ['A', 'B']")


class HouseItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="House name e.g. Red House")
    color: str | None = Field(default=None, description="Optional color code or hex e.g. #ef4444")
    emblem_url: str | None = Field(default=None, description="Optional emblem URL for the house")


class SubjectItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Subject name e.g. Mathematics")
    code: str | None = Field(default=None, description="Optional subject code e.g. MATH101")
    order_index: int = Field(default=0)
    assigned_classes: List[str] = Field(default_factory=list, description="List of class names this subject is assigned to")


class WingItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Wing name e.g. Primary Wing")
    order_index: int = Field(default=0)
    classes: List[str] = Field(default_factory=list, description="List of class names in this wing")


class SchoolSetupRequest(BaseModel):
    token: str = Field(..., description="Onboarding verification token")

    # Step 1 & 2: School Information & Address
    school_name: str = Field(..., min_length=2, max_length=255)
    school_code: str = Field(..., min_length=2, max_length=50)
    school_email: EmailStr
    school_phone: str = Field(..., min_length=5, max_length=20)
    address: str = Field(..., min_length=3, max_length=1000)

    # Classes, Sections, Subjects, Wings, Houses
    classes: List[ClassSectionItem] = Field(..., min_length=1, description="List of configured classes with sections")
    subjects: List[SubjectItem] = Field(default_factory=list, description="List of configured subjects and class assignments")
    wings: List[WingItem] = Field(default_factory=list, description="Optional list of configured academic wings")
    houses: List[HouseItem] = Field(default_factory=list, description="List of school houses")

    # Step 6: School Customization (Theme & Emblem - Optional)
    primary_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Optional school primary HEX color e.g. #2563EB",
    )
    emblem_url: str | None = Field(
        default=None,
        description="Optional relative or absolute URL to uploaded school emblem",
    )

    # Step 7: Principal Credentials
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    pin: str = Field(..., min_length=4, max_length=10, description="4-10 digit quick login PIN")
    confirm_pin: str = Field(..., min_length=4, max_length=10)


class SchoolSetupResponse(BaseModel):
    success: bool
    message: str
    school_id: UUID
    school_name: str
    principal_id: UUID
