"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.v1 import auth, households, inventory
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(auth.router, prefix="/api/v1")
app.include_router(households.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")


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
