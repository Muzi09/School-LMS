from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.connection_manager import chat_connection_manager
from app.core.database import engine
from app.core.exceptions import AppException

@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await chat_connection_manager.start()
        yield
    finally:
        await chat_connection_manager.stop()


app = FastAPI(
    title="School LMS API",
    description="Multi-tenant School Learning Management System REST API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    content = {"detail": exc.message, "message": exc.message}
    if hasattr(exc, "code"):
        content["code"] = exc.code
    if hasattr(exc, "details"):
        content["details"] = exc.details
    if exc.payload:
        content["payload"] = exc.payload
        if isinstance(exc.payload, dict):
            if "code" in exc.payload and "code" not in content:
                content["code"] = exc.payload["code"]
            if "details" in exc.payload and "details" not in content:
                content["details"] = exc.payload["details"]
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
    )


@app.exception_handler(OperationalError)
async def database_operation_failed(_request: Request, exc: OperationalError):
    if getattr(exc.orig, "sqlstate", None) in {"40001", "40P01", "55P03"}:
        return JSONResponse(
            status_code=409,
            content={"detail": "A database change is in progress. Refresh and retry."},
        )
    return JSONResponse(status_code=503, content={"detail": "The database is temporarily unavailable."})


import os
from fastapi.staticfiles import StaticFiles

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure and mount uploads directory
os.makedirs("uploads/emblems", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from app.api.v1.endpoints.chat import handle_chat_websocket

# Mount API Routers
app.include_router(api_router, prefix="/api")

# Mount native WebSocket chat endpoint
@app.websocket("/ws/chat")
async def root_chat_websocket(websocket: WebSocket):
    await handle_chat_websocket(websocket)


@app.get("/", tags=["Health"])
@app.get("/health/live", tags=["Health"])
def liveness():
    return {"status": "live"}


@app.get("/health/ready", tags=["Health"])
def readiness():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}
