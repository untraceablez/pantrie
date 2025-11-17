"""OAuth authentication API endpoints."""
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from starlette.config import Config

from src.core.deps import DbSession
from src.schemas.user import TokenResponse
from src.services.oauth_service import OAuthProvider, OAuthService, oauth

router = APIRouter(prefix="/auth/oauth", tags=["OAuth"])

config = Config(".env")


@router.get("/{provider}/authorize")
async def oauth_authorize(
    request: Request,
    provider: OAuthProvider,
    redirect_uri: str = Query(..., description="Frontend callback URL"),
) -> RedirectResponse:
    """
    Initiate OAuth flow by redirecting to provider's authorization page.

    Args:
        provider: OAuth provider (google or authentik)
        redirect_uri: Frontend URL to redirect to after OAuth callback

    Returns:
        Redirect to OAuth provider's authorization page
    """
    # Get OAuth client
    client = oauth.create_client(provider)

    # Generate callback URL (this will be our backend callback endpoint)
    callback_url = str(request.url_for("oauth_callback", provider=provider))

    # Determine the correct protocol
    # Check multiple headers that reverse proxies might set
    forwarded_proto = (
        request.headers.get("X-Forwarded-Proto") or
        request.headers.get("CF-Visitor") or  # Cloudflare
        request.headers.get("X-Forwarded-Ssl")
    )

    # If we have a Cloudflare CF-Visitor header, it's JSON
    if forwarded_proto and "https" in forwarded_proto.lower():
        callback_url = callback_url.replace("http://", "https://")
    # For standard X-Forwarded-Proto header
    elif forwarded_proto == "https":
        callback_url = callback_url.replace("http://", "https://")
    # Fallback: if the redirect_uri from frontend is HTTPS, assume we should use HTTPS
    elif redirect_uri and redirect_uri.startswith("https://"):
        callback_url = callback_url.replace("http://", "https://")

    # Store the frontend redirect_uri in state to use after callback
    # In production, you might want to encrypt this or store in Redis
    redirect_url = await client.authorize_redirect(request, callback_url, state=redirect_uri)

    return redirect_url


@router.get("/{provider}/callback", name="oauth_callback")
async def oauth_callback(
    request: Request,
    provider: OAuthProvider,
    db: DbSession,
    code: str = Query(..., description="Authorization code from OAuth provider"),
    state: str | None = Query(None, description="State parameter (frontend redirect URL)"),
) -> RedirectResponse:
    """
    Handle OAuth callback from provider.

    Args:
        provider: OAuth provider (google or authentik)
        code: Authorization code from OAuth provider
        state: Frontend redirect URL passed in authorize step
        db: Database session

    Returns:
        Redirect to frontend with tokens in URL parameters
    """
    # Get callback URL
    callback_url = str(request.url_for("oauth_callback", provider=provider))

    # Handle OAuth callback and get tokens
    oauth_service = OAuthService(db)
    token_response = await oauth_service.handle_callback(
        provider=provider,
        code=code,
        redirect_uri=callback_url,
        request=request,
    )

    # Redirect to frontend with tokens
    # The frontend redirect URL was passed in the state parameter
    frontend_url = state if state else "http://localhost:5173/oauth/callback"

    # Append tokens as URL parameters
    redirect_url = (
        f"{frontend_url}"
        f"?access_token={token_response.access_token}"
        f"&refresh_token={token_response.refresh_token}"
        f"&expires_in={token_response.expires_in}"
        f"&provider={provider}"
    )

    return RedirectResponse(url=redirect_url)


@router.get("/providers")
async def get_available_providers() -> dict[str, list[str]]:
    """
    Get list of configured OAuth providers.

    Returns:
        Dictionary with available OAuth providers
    """
    from src.config import get_settings

    settings = get_settings()
    providers = []

    if settings.OAUTH_GOOGLE_CLIENT_ID and settings.OAUTH_GOOGLE_CLIENT_SECRET:
        providers.append("google")

    if (
        settings.OAUTH_AUTHENTIK_CLIENT_ID
        and settings.OAUTH_AUTHENTIK_CLIENT_SECRET
        and settings.OAUTH_AUTHENTIK_BASE_URL
    ):
        providers.append("authentik")

    return {"providers": providers}
