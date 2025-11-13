"""User API endpoints."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from src.core.deps import CurrentUserId, DbSession
from src.schemas.user import PasswordChange, UserResponse, UserUpdate
from src.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: CurrentUserId,
    db: DbSession,
) -> UserResponse:
    """Get current user profile."""
    user_service = UserService(db)
    user = await user_service.get_user_by_id(user_id)
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    update_data: UserUpdate,
    user_id: CurrentUserId,
    db: DbSession,
) -> UserResponse:
    """Update current user profile."""
    user_service = UserService(db)
    user = await user_service.update_user_profile(user_id, update_data)
    return UserResponse.model_validate(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    password_change: PasswordChange,
    user_id: CurrentUserId,
    db: DbSession,
) -> None:
    """Change current user password."""
    user_service = UserService(db)
    await user_service.change_password(user_id, password_change)


@router.post("/me/avatar")
async def upload_avatar(
    user_id: CurrentUserId,
    db: DbSession,
    file: UploadFile = File(...),
) -> JSONResponse:
    """Upload user avatar image."""
    # Validate file size (10MB max)
    MAX_SIZE = 10 * 1024 * 1024  # 10MB in bytes

    # Read file content
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of 10MB"
        )

    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )

    # For now, we'll just return a placeholder
    # In production, you would upload to S3, Cloudinary, etc.
    # For this implementation, we'll use base64 encoding to store in database
    import base64
    avatar_data = base64.b64encode(content).decode('utf-8')
    avatar_url = f"data:{file.content_type};base64,{avatar_data}"

    # Update user avatar URL
    user_service = UserService(db)
    await user_service.update_user_profile(
        user_id,
        UserUpdate(avatar_url=avatar_url)
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"avatar_url": avatar_url}
    )
