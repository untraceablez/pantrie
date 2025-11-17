"""Custom exception classes for the application."""
from typing import Any


class PantrieException(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str, status_code: int = 500, details: dict[str, Any] | None = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(PantrieException):
    """Resource not found error."""

    def __init__(self, message: str = "Resource not found", details: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=404, details=details)


class AlreadyExistsError(PantrieException):
    """Resource already exists error."""

    def __init__(
        self, message: str = "Resource already exists", details: dict[str, Any] | None = None
    ):
        super().__init__(message=message, status_code=409, details=details)


class ValidationError(PantrieException):
    """Data validation error."""

    def __init__(self, message: str = "Validation failed", details: dict[str, Any] | None = None):
        super().__init__(message=message, status_code=422, details=details)


class AuthenticationError(PantrieException):
    """Authentication error."""

    def __init__(
        self, message: str = "Authentication failed", details: dict[str, Any] | None = None
    ):
        super().__init__(message=message, status_code=401, details=details)


class AuthorizationError(PantrieException):
    """Authorization error."""

    def __init__(
        self,
        message: str = "You don't have permission to access this resource",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message=message, status_code=403, details=details)


class ExternalServiceError(PantrieException):
    """External service error."""

    def __init__(
        self, message: str = "External service unavailable", details: dict[str, Any] | None = None
    ):
        super().__init__(message=message, status_code=503, details=details)


class RateLimitError(PantrieException):
    """Rate limit exceeded error."""

    def __init__(
        self, message: str = "Rate limit exceeded", details: dict[str, Any] | None = None
    ):
        super().__init__(message=message, status_code=429, details=details)


class ConfigurationError(PantrieException):
    """Configuration error."""

    def __init__(
        self, message: str = "Configuration error", details: dict[str, Any] | None = None
    ):
        super().__init__(message=message, status_code=500, details=details)
