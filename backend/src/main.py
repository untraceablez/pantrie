"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.v1 import allergen, auth, barcode, households, inventory, locations, setup, users
from src.config import get_settings
from src.core.exceptions import PantrieException
from src.core.logging import setup_logging

# Setup structured logging
logger = setup_logging()

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    logger.info("Application starting up", version=settings.APP_VERSION)
    yield
    logger.info("Application shutting down")


app = FastAPI(
    title="Pantrie API",
    description="Household inventory management system API",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
)

# CORS middleware - must be added first (middleware applies in reverse order)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# Request logging middleware for debugging (added after CORS)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests for debugging."""
    logger.info(
        "Incoming request",
        method=request.method,
        url=str(request.url),
        origin=request.headers.get("origin"),
        content_type=request.headers.get("content-type"),
    )
    response = await call_next(request)
    logger.info(
        "Response",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
    )
    return response


# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    logger.error(
        "Validation error",
        errors=exc.errors(),
        body=exc.body,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "details": exc.errors(),
        },
    )


# Exception handler for custom exceptions
@app.exception_handler(PantrieException)
async def pantrie_exception_handler(request: Request, exc: PantrieException) -> JSONResponse:
    """Handle custom Pantrie exceptions."""
    logger.error(
        "Application error",
        error=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        path=request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "details": exc.details,
        },
    )


# Register API routers
app.include_router(setup.router, prefix="/api/v1")  # Setup must be first (no auth required)
app.include_router(allergen.router, prefix="/api/v1/households", tags=["allergens"])
app.include_router(auth.router, prefix="/api/v1")
app.include_router(barcode.router, prefix="/api/v1")
app.include_router(households.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(locations.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/api/health")
async def health_check() -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
        },
    )


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Pantrie API", "version": settings.APP_VERSION}


# Note: CORSMiddleware handles OPTIONS requests automatically
# We don't need a custom OPTIONS handler
