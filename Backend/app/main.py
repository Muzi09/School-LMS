from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.database import engine
from app.core.exceptions import AppException

app = FastAPI(
    title="School LMS API",
    description="Multi-tenant School Learning Management System REST API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    content = {"detail": exc.message}
    if exc.payload:
        content["payload"] = exc.payload
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
    )


import os
from fastapi.staticfiles import StaticFiles

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure and mount uploads directory
os.makedirs("uploads/emblems", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Mount API Routers
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["Health"])
def root():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))

    return {
        "message": "School LMS API is running",
        "database": result.scalar(),
        "docs": "/docs",
    }