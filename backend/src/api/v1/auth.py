"""Authentication API endpoints."""
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from src.core.deps import CurrentUserId, DbSession
from src.schemas.user import TokenRefresh, TokenResponse, UserCreate, UserLogin, UserResponse
from src.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: DbSession,
) -> UserResponse:
    """Register a new user account."""
    auth_service = AuthService(db)
    user = await auth_service.register(user_data)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    login_data: UserLogin,
    db: DbSession,
) -> TokenResponse:
    """Login and receive access and refresh tokens."""
    auth_service = AuthService(db)
    return await auth_service.login(login_data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    token_data: TokenRefresh,
    db: DbSession,
) -> TokenResponse:
    """Refresh access token using refresh token."""
    auth_service = AuthService(db)
    return await auth_service.refresh_access_token(token_data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    token_data: TokenRefresh,
    db: DbSession,
) -> JSONResponse:
    """Logout by revoking refresh token."""
    auth_service = AuthService(db)
    await auth_service.revoke_refresh_token(token_data.refresh_token)
    return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: CurrentUserId,
    db: DbSession,
) -> UserResponse:
    """Get current user information."""
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)
    return UserResponse.model_validate(user)
