from fastapi import APIRouter

from app.api.v1.endpoints import staff, students

api_router = APIRouter(prefix="/v1")
api_router.include_router(staff.router)
api_router.include_router(students.router)
