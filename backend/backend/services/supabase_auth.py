"""
Supabase Authentication Service (GoTrue)
========================================
A thin, dependency-light async client over the Supabase Auth (GoTrue) REST API
(``/auth/v1``). The backend owns the Supabase session and exposes a small, stable
surface the web/mobile clients can hook into without touching Supabase directly.

Why REST (httpx) instead of the supabase-py SDK:
    * No SDK version coupling and no global singletons.
    * Precise control over tokens so the API layer can store them in an
      HTTP-only cookie (safer than exposing tokens to JavaScript).
    * Works the same for email/password, OAuth, refresh, and sign-out.

All methods raise :class:`SupabaseAuthError` with an HTTP-style status code and a
human-readable message on failure, which the API layer maps to HTTPException.
"""

import logging
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx

from backend.config import settings

logger = logging.getLogger("supabase_auth")


class SupabaseAuthError(Exception):
    """Raised when a Supabase Auth call fails. Carries an HTTP status + message."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class SupabaseAuthService:
    """Async GoTrue client scoped to the configured Supabase project."""

    def __init__(self) -> None:
        self._timeout = 15.0

    # -- configuration helpers ------------------------------------------------
    @property
    def base_url(self) -> Optional[str]:
        if not settings.SUPABASE_URL:
            return None
        return settings.SUPABASE_URL.rstrip("/") + "/auth/v1"

    @property
    def anon_key(self) -> Optional[str]:
        return settings.SUPABASE_ANON_KEY

    def is_configured(self) -> bool:
        """True only when both the project URL and anon key are present."""
        return bool(self.base_url and self.anon_key)

    def _headers(self, access_token: Optional[str] = None) -> Dict[str, str]:
        # GoTrue requires the apikey header; a user access token (when present)
        # goes in Authorization, otherwise the anon key is used as the bearer.
        bearer = access_token or self.anon_key or ""
        return {
            "apikey": self.anon_key or "",
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
        }

    def _ensure_configured(self) -> None:
        if not self.is_configured():
            raise SupabaseAuthError(
                503,
                "Supabase authentication is not configured. Set SUPABASE_URL and "
                "SUPABASE_ANON_KEY in the backend environment.",
            )

    @staticmethod
    def _extract_error(resp: httpx.Response) -> str:
        try:
            body = resp.json()
        except Exception:
            return f"Authentication request failed (HTTP {resp.status_code})."
        for key in ("msg", "error_description", "error", "message"):
            val = body.get(key) if isinstance(body, dict) else None
            if val:
                return str(val)
        return f"Authentication request failed (HTTP {resp.status_code})."

    async def _post(self, path: str, json: Dict[str, Any], access_token: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_configured()
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, headers=self._headers(access_token), json=json)
        except Exception as e:
            logger.warning(f"Supabase auth POST {path} transport error: {e}")
            raise SupabaseAuthError(503, "Could not reach the authentication provider.")
        if resp.status_code >= 400:
            raise SupabaseAuthError(resp.status_code, self._extract_error(resp))
        return resp.json() if resp.content else {}

    # -- public API -----------------------------------------------------------
    async def sign_up(self, email: str, password: str) -> Dict[str, Any]:
        """Register a new email/password user. May require email confirmation."""
        return await self._post("/signup", {"email": email, "password": password})

    async def sign_in_password(self, email: str, password: str) -> Dict[str, Any]:
        """Exchange email/password for a Supabase session (access + refresh token)."""
        return await self._post(
            "/token?grant_type=password", {"email": email, "password": password}
        )

    async def refresh(self, refresh_token: str) -> Dict[str, Any]:
        """Exchange a refresh token for a fresh session."""
        return await self._post(
            "/token?grant_type=refresh_token", {"refresh_token": refresh_token}
        )

    async def get_user(self, access_token: str) -> Dict[str, Any]:
        """Return the user profile for a valid access token (verifies the token)."""
        self._ensure_configured()
        url = f"{self.base_url}/user"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers(access_token))
        except Exception as e:
            logger.warning(f"Supabase auth GET /user transport error: {e}")
            raise SupabaseAuthError(503, "Could not reach the authentication provider.")
        if resp.status_code >= 400:
            raise SupabaseAuthError(resp.status_code, self._extract_error(resp))
        return resp.json() if resp.content else {}

    async def sign_out(self, access_token: str) -> None:
        """Revoke the current session server-side (best-effort)."""
        if not self.is_configured() or not access_token:
            return
        url = f"{self.base_url}/logout"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                await client.post(url, headers=self._headers(access_token), json={})
        except Exception as e:
            # Sign-out should never hard-fail the request; the cookie is cleared regardless.
            logger.debug(f"Supabase sign-out best-effort error: {e}")

    def oauth_authorize_url(self, provider: str, redirect_to: str) -> str:
        """Build the GoTrue authorize URL the browser should be sent to."""
        self._ensure_configured()
        query = urlencode({"provider": provider, "redirect_to": redirect_to})
        return f"{self.base_url}/authorize?{query}"


# Module-level singleton used by the API layer.
supabase_auth = SupabaseAuthService()
