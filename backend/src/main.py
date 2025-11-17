"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

from sqlalchemy import select

from src.api.v1 import allergen, auth, barcode, email_confirmation, households, inventory, locations, oauth, setup, site_admin, site_settings, users
from src.config import get_settings
from src.core.exceptions import PantrieException
from src.core.logging import setup_logging
from src.db.session import get_db
from src.models.system_settings import SystemSettings

# Setup structured logging
logger = setup_logging()

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    logger.info("Application starting up", version=settings.APP_VERSION)

    # Load proxy settings and update CORS origins
    async for db in get_db():
        try:
            result = await db.execute(select(SystemSettings))
            sys_settings = result.scalar_one_or_none()

            if sys_settings and sys_settings.custom_domain:
                protocol = "https" if sys_settings.use_https else "http"
                custom_origin = f"{protocol}://{sys_settings.custom_domain}"

                # Find CORS middleware and update origins
                for middleware in app.user_middleware:
                    if middleware.cls.__name__ == "CORSMiddleware":
                        current_origins = list(middleware.options.get("allow_origins", []))
                        if custom_origin not in current_origins:
                            current_origins.append(custom_origin)
                            logger.info(f"Added custom domain to CORS origins: {custom_origin}")
                        break
        except Exception as e:
            logger.warning(f"Failed to load proxy settings: {e}")
        finally:
            break

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

# Proxy headers middleware - handles X-Forwarded-* headers from reverse proxies
class ProxyHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to handle proxy headers from reverse proxies and Cloudflare."""

    async def dispatch(self, request: Request, call_next):
        # Trust X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host headers
        # These are set by reverse proxies like nginx, Cloudflare Tunnel, etc.

        # Get the real client IP from X-Forwarded-For or CF-Connecting-IP (Cloudflare)
        forwarded_for = request.headers.get("X-Forwarded-For")
        cf_connecting_ip = request.headers.get("CF-Connecting-IP")

        if cf_connecting_ip:
            request.scope["client"] = (cf_connecting_ip, 0)
        elif forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first one
            client_ip = forwarded_for.split(",")[0].strip()
            request.scope["client"] = (client_ip, 0)

        # Handle X-Forwarded-Proto (http/https)
        forwarded_proto = request.headers.get("X-Forwarded-Proto")
        if forwarded_proto:
            request.scope["scheme"] = forwarded_proto

        # Handle X-Forwarded-Host
        forwarded_host = request.headers.get("X-Forwarded-Host")
        if forwarded_host:
            request.scope["server"] = (forwarded_host, None)

        response = await call_next(request)
        return response

# Add proxy headers middleware first
app.add_middleware(ProxyHeadersMiddleware)

# Session middleware - required for OAuth flows
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# CORS middleware - must be added after proxy middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Allow all origins - suitable for public APIs and reverse proxies
        "http://localhost:5173",
        "http://localhost:3000",
        "http://pantrie.taylorcohron.me",
        "https://pantrie.taylorcohron.me",
    ],
    allow_credentials=True,  # Allow cookies/auth headers through reverse proxy
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
app.include_router(email_confirmation.router, prefix="/api/v1")  # Email confirmation (no auth required)
app.include_router(allergen.router, prefix="/api/v1/households", tags=["allergens"])
app.include_router(auth.router, prefix="/api/v1")
app.include_router(oauth.router, prefix="/api/v1")  # OAuth endpoints (no auth required)
app.include_router(barcode.router, prefix="/api/v1")
app.include_router(households.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")
app.include_router(locations.router, prefix="/api/v1")
app.include_router(site_admin.router, prefix="/api/v1")  # Site admin endpoints
app.include_router(site_settings.router, prefix="/api/v1")  # Site settings endpoints
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
