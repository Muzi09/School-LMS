from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    onboarding,
    school_config,
    staff,
    students,
    super_admin,
)

api_router = APIRouter(prefix="/v1")

# Mount endpoints
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(super_admin.router)
api_router.include_router(onboarding.router)
api_router.include_router(school_config.router)
api_router.include_router(staff.router)
api_router.include_router(students.router)
