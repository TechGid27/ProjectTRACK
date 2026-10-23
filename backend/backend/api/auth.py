"""
Authentication Endpoints (Supabase-backed)
==========================================
Backend-managed Supabase auth. The server exchanges credentials/OAuth tokens
with Supabase GoTrue and stores the resulting session in an HTTP-only cookie, so
the browser never handles raw tokens. This matches the contract the web client
(`Website/src/services/auth.js`) already expects:

    GET  /api/auth/oauth/{provider}?redirect=...   -> { url }
    POST /api/auth/callback   { access_token, refresh_token }  -> { user }
    GET  /api/auth/session    -> { user }
    POST /api/auth/signin     { email, password }  -> { user }
    POST /api/auth/signup     { email, password, redirect? }  -> { user, message, ... }
    POST /api/auth/resend     { email, redirect? }  -> { message }
    POST /api/auth/signout    -> { message }

Teammates can protect any route by adding the `get_current_user` dependency:

    from backend.api.auth import get_current_user

    @router.get("/private")
    async def private(user = Depends(get_current_user)):
        return {"you_are": user.email}
"""

import json
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from backend.config import settings
from backend.models.auth import (
    SignInRequest,
    SignUpRequest,
    OAuthCallbackRequest,
    ResendConfirmationRequest,
    AuthUser,
    UserResponse,
    OAuthUrlResponse,
    SignUpResponse,
    MessageResponse,
)
from backend.services.supabase_auth import supabase_auth, SupabaseAuthError

logger = logging.getLogger("auth_api")

router = APIRouter(prefix="/auth", tags=["Authentication"])

_ALLOWED_PROVIDERS = {"google", "github", "facebook", "azure", "gitlab", "bitbucket", "discord", "apple"}


# --- cookie helpers ---------------------------------------------------------
def _set_session_cookie(response: Response, access_token: str, refresh_token: Optional[str]) -> None:
    """Store the Supabase session as a single HTTP-only cookie (JSON of tokens)."""
    payload = json.dumps({"access_token": access_token, "refresh_token": refresh_token or ""})
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=payload,
        max_age=settings.AUTH_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        samesite=settings.AUTH_COOKIE_SAMESITE,
        secure=settings.AUTH_COOKIE_SECURE,
    )


def _read_session_cookie(request: Request) -> Dict[str, Optional[str]]:
    raw = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return {"access_token": data.get("access_token"), "refresh_token": data.get("refresh_token")}
    except (json.JSONDecodeError, TypeError):
        pass
    return {}


def _to_auth_user(raw: Dict[str, Any]) -> AuthUser:
    """Map a Supabase user object to the public AuthUser shape."""
    # Supabase returns the user either at the top level (/user) or under "user".
    u = raw.get("user") if isinstance(raw, dict) and "user" in raw else raw
    u = u or {}
    return AuthUser(
        id=str(u.get("id", "")),
        email=u.get("email"),
        role=u.get("role"),
        user_metadata=u.get("user_metadata") or {},
        app_metadata=u.get("app_metadata") or {},
    )


def _handle_auth_error(exc: SupabaseAuthError) -> HTTPException:
    # Normalize provider status codes into sensible API errors.
    code = exc.status_code if exc.status_code in (400, 401, 403, 409, 422, 429, 503) else 400
    return HTTPException(status_code=code, detail=exc.message)


def _validate_redirect_target(redirect: Optional[str], *, param: str = "redirect") -> str:
    """
    Validate a client-supplied redirect target against the backend allow-list.

    Supabase silently falls back to the project Site URL for any ``redirect_to``
    it does not recognise, which bounces users to the wrong origin (typically the
    deployed site) where the session cookie can never be set. Rejecting it here
    turns that silent failure into an actionable error.
    """
    target = (redirect or "").strip() or settings.FRONTEND_URL
    parsed = urlparse(target)

    # Native mobile apps deep-link back via a custom URL scheme (e.g.
    # "projecttrack://auth/callback") or the Expo Go client ("exp://..."), which
    # is not an http(s) URL. Accept schemes explicitly allow-listed in
    # settings.MOBILE_APP_SCHEMES so native OAuth works without weakening the
    # http(s) origin allow-list used by the web client.
    scheme = (parsed.scheme or "").lower()
    if scheme and scheme in settings.MOBILE_APP_SCHEMES:
        return target

    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid '{param}': expected an absolute http(s) URL such as "
                f"{settings.FRONTEND_URL}, or a registered app scheme "
                f"({', '.join(s + '://' for s in settings.MOBILE_APP_SCHEMES)})."
            ),
        )
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin not in settings.allowed_origins:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Redirect origin '{origin}' is not allowed. Set FRONTEND_URL (and "
                "CORS_ORIGINS) in the backend environment and add the same URL to "
                "the Supabase Auth redirect allow-list."
            ),
        )
    return target


# --- reusable dependency ----------------------------------------------------
async def get_current_user(request: Request) -> AuthUser:
    """
    FastAPI dependency that resolves the authenticated user from the session
    cookie, verifying the access token against Supabase. Raises 401 if missing
    or invalid. Teammates: `Depends(get_current_user)` to lock down a route.
    """
    tokens = _read_session_cookie(request)
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    try:
        raw = await supabase_auth.get_user(access_token)
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid.")
    user = _to_auth_user(raw)
    if not user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    return user


async def get_optional_user(request: Request) -> Optional[AuthUser]:
    """Like get_current_user but returns None instead of raising (for public routes)."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# --- endpoints --------------------------------------------------------------
@router.get("/oauth/{provider}", response_model=OAuthUrlResponse, summary="Get OAuth Authorize URL")
async def oauth_url(
    provider: str,
    redirect: Optional[str] = Query(default=None, description="Where Supabase should redirect after login"),
):
    """Return the Supabase authorize URL for a social provider (google, github, ...)."""
    prov = provider.strip().lower()
    if prov not in _ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported OAuth provider '{provider}'.")
    redirect_to = _validate_redirect_target(redirect, param="redirect")
    logger.info("OAuth %s authorize redirect_to=%s", prov, redirect_to)
    try:
        url = supabase_auth.oauth_authorize_url(prov, redirect_to)
    except SupabaseAuthError as exc:
        raise _handle_auth_error(exc)
    return OAuthUrlResponse(url=url)


@router.post("/callback", response_model=UserResponse, summary="Complete OAuth Login")
async def oauth_callback(body: OAuthCallbackRequest, response: Response):
    """Persist the tokens from an OAuth redirect into the HTTP-only session cookie."""
    try:
        raw = await supabase_auth.get_user(body.access_token)
    except SupabaseAuthError as exc:
        raise _handle_auth_error(exc)
    _set_session_cookie(response, body.access_token, body.refresh_token)
    return UserResponse(user=_to_auth_user(raw))


@router.get("/session", response_model=UserResponse, summary="Current Session")
async def session(request: Request, response: Response):
    """
    Return the current user, transparently refreshing the Supabase session when
    the access token has expired but a refresh token is present. Returns
    { user: null } when there is no valid session (never a hard error).
    """
    tokens = _read_session_cookie(request)
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    if not access_token:
        return UserResponse(user=None)

    try:
        raw = await supabase_auth.get_user(access_token)
        return UserResponse(user=_to_auth_user(raw))
    except SupabaseAuthError:
        # Try a refresh before giving up.
        if refresh_token:
            try:
                refreshed = await supabase_auth.refresh(refresh_token)
                new_access = refreshed.get("access_token")
                new_refresh = refreshed.get("refresh_token") or refresh_token
                if new_access:
                    _set_session_cookie(response, new_access, new_refresh)
                    return UserResponse(user=_to_auth_user(refreshed))
            except SupabaseAuthError:
                pass
        _clear_session_cookie(response)
        return UserResponse(user=None)


@router.post("/signin", response_model=UserResponse, summary="Email/Password Sign In")
async def signin(body: SignInRequest, response: Response):
    """Authenticate with email/password and open a session cookie."""
    try:
        data = await supabase_auth.sign_in_password(body.email, body.password)
    except SupabaseAuthError as exc:
        raise _handle_auth_error(exc)
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    _set_session_cookie(response, access_token, refresh_token)
    return UserResponse(user=_to_auth_user(data))


@router.post("/signup", response_model=SignUpResponse, summary="Email/Password Sign Up")
async def signup(body: SignUpRequest, response: Response):
    """
    Register a new email/password account. If the Supabase project auto-confirms
    users, a session cookie is opened immediately; otherwise the client is told
    to check their email for a confirmation link.

    The optional ``redirect`` field decides which origin the confirmation link
    sends the user back to (validated against the backend allow-list, defaulting
    to FRONTEND_URL) so confirming from a local dev server does not bounce the
    user to the deployed site.
    """
    redirect_to = _validate_redirect_target(body.redirect, param="redirect")
    try:
        data = await supabase_auth.sign_up(body.email, body.password, redirect_to=redirect_to)
    except SupabaseAuthError as exc:
        raise _handle_auth_error(exc)

    access_token = data.get("access_token")
    if access_token:
        _set_session_cookie(response, access_token, data.get("refresh_token"))
        return SignUpResponse(
            user=_to_auth_user(data),
            message="Account created and signed in.",
            email_confirmation_required=False,
        )
    return SignUpResponse(
        user=_to_auth_user(data) if data.get("id") or data.get("user") else None,
        message=(
            f"Account created. A confirmation link was sent to {body.email} — "
            "check the inbox and the spam folder before signing in."
        ),
        email_confirmation_required=True,
    )


@router.post("/resend", response_model=MessageResponse, summary="Resend Confirmation Email")
async def resend_confirmation(body: ResendConfirmationRequest):
    """
    Re-send the confirmation e-mail for an unconfirmed signup.

    GoTrue reports every delivery problem on this call (address not authorized,
    rate limit, SMTP failure), so the client can show the real reason instead of
    an unexplained "no email arrived".
    """
    redirect_to = _validate_redirect_target(body.redirect, param="redirect")
    try:
        await supabase_auth.resend_confirmation(body.email, redirect_to=redirect_to)
    except SupabaseAuthError as exc:
        raise _handle_auth_error(exc)
    return MessageResponse(
        message=(
            f"Confirmation email sent again to {body.email}. "
            "If it is still missing, look in the spam folder or wait a minute before retrying."
        )
    )


@router.post("/signout", response_model=MessageResponse, summary="Sign Out")
async def signout(request: Request, response: Response):
    """Revoke the session server-side (best-effort) and clear the cookie."""
    tokens = _read_session_cookie(request)
    access_token = tokens.get("access_token")
    if access_token:
        await supabase_auth.sign_out(access_token)
    _clear_session_cookie(response)
    return MessageResponse(message="Signed out.")
