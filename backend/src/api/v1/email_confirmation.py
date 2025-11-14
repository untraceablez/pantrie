"""
Email confirmation API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db
from src.services.email_service import EmailService

router = APIRouter(prefix="/email", tags=["email"])


class ConfirmEmailRequest(BaseModel):
    """Request model for email confirmation."""

    token: str


class ConfirmEmailResponse(BaseModel):
    """Response model for email confirmation."""

    message: str
    success: bool


@router.post("/confirm", response_model=ConfirmEmailResponse)
async def confirm_email(
    request: ConfirmEmailRequest, db: AsyncSession = Depends(get_db)
) -> ConfirmEmailResponse:
    """
    Confirm a user's email address using their confirmation token.

    Args:
        request: Confirmation request with token
        db: Database session

    Returns:
        Success message

    Raises:
        400: If token is invalid or expired
    """
    success = await EmailService.confirm_email(db, request.token)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired confirmation token",
        )

    return ConfirmEmailResponse(
        message="Email confirmed successfully! You can now log in.",
        success=True,
    )


@router.get("/verify-token/{token}")
async def verify_token(token: str, db: AsyncSession = Depends(get_db)):
    """
    Verify if a confirmation token is valid (without confirming it).

    Args:
        token: Confirmation token
        db: Database session

    Returns:
        Token validity information
    """
    user = await EmailService.verify_confirmation_token(db, token)

    if not user:
        return {"valid": False, "message": "Invalid or expired token"}

    return {
        "valid": True,
        "user": {"username": user.username, "email": user.email},
    }
