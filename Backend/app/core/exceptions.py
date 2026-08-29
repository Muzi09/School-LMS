from typing import Any


class AppException(Exception):
    """Base exception for application-level domain errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        payload: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.payload = payload


class NotFoundException(AppException):
    """Exception raised when an entity is not found."""

    def __init__(self, message: str = "Resource not found", payload: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=404, payload=payload)


class ConflictException(AppException):
    """Exception raised when a conflict occurs (e.g. duplicate resource)."""

    def __init__(self, message: str = "Resource conflict", payload: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=409, payload=payload)


class BadRequestException(AppException):
    """Exception raised when the request violates business rules."""

    def __init__(self, message: str = "Bad request", payload: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=400, payload=payload)


class UnauthorizedException(AppException):
    """Exception raised when authentication fails."""

    def __init__(self, message: str = "Unauthorized", payload: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=401, payload=payload)


class ForbiddenException(AppException):
    """Exception raised when authorization/permission is denied."""

    def __init__(self, message: str = "Forbidden", payload: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=403, payload=payload)
