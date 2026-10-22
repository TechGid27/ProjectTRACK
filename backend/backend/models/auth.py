"""
Authentication Data Models
==========================
Request/response schemas for the Supabase-backed auth endpoints.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class SignInRequest(BaseModel):
    """Email/password sign-in payload."""
    email: EmailStr = Field(..., description="Account email address")
    password: str = Field(..., min_length=6, max_length=256, description="Account password")


class SignUpRequest(BaseModel):
    """Email/password registration payload."""
    email: EmailStr = Field(..., description="New account email address")
    password: str = Field(..., min_length=6, max_length=256, description="New account password")
    redirect: Optional[str] = Field(
        default=None,
        description=(
            "Frontend origin the confirmation e-mail link should return to. "
            "Must be one of the backend's allowed origins; defaults to FRONTEND_URL."
        ),
    )


class OAuthCallbackRequest(BaseModel):
    """Tokens returned by Supabase after an OAuth redirect, posted by the client."""
    access_token: str = Field(..., description="Supabase access token from the OAuth redirect")
    refresh_token: Optional[str] = Field(default=None, description="Supabase refresh token")


class ResendConfirmationRequest(BaseModel):
    """Ask for the account confirmation e-mail to be sent again."""
    email: EmailStr = Field(..., description="Address that has not confirmed yet")
    redirect: Optional[str] = Field(
        default=None,
        description="Frontend origin the confirmation e-mail link should return to",
    )


class AuthUser(BaseModel):
    """Public, non-sensitive view of an authenticated user."""
    id: str = Field(..., description="Supabase user UUID")
    email: Optional[str] = Field(default=None, description="User email")
    role: Optional[str] = Field(default=None, description="Supabase role (e.g. authenticated)")
    user_metadata: Dict[str, Any] = Field(default_factory=dict, description="Provider/profile metadata")
    app_metadata: Dict[str, Any] = Field(default_factory=dict, description="Supabase app metadata (provider, etc.)")


class UserResponse(BaseModel):
    """Standard wrapper returned by session/sign-in endpoints."""
    user: Optional[AuthUser] = Field(default=None, description="Authenticated user or null when signed out")


class OAuthUrlResponse(BaseModel):
    """Authorize URL the browser should be redirected to for OAuth sign-in."""
    url: str = Field(..., description="Supabase GoTrue authorize URL")


class SignUpResponse(BaseModel):
    """Result of a registration attempt."""
    user: Optional[AuthUser] = Field(default=None, description="Created user if auto-confirmed")
    message: str = Field(..., description="Human-readable result (e.g. check your email to confirm)")
    email_confirmation_required: bool = Field(
        default=False, description="True when the user must confirm their email before signing in"
    )


class MessageResponse(BaseModel):
    """Simple acknowledgement payload."""
    message: str = Field(..., description="Result message")
