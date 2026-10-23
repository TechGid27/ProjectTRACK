"""
Authentication Endpoint Tests (mocked Supabase)
===============================================
Validates the backend Supabase auth flow WITHOUT any network calls by patching
the supabase_auth service. Covers cookie issue/clear, session read + refresh,
sign-in/up, OAuth URL, validation, and the get_current_user dependency.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.app import app
from backend.api import auth as auth_module

FAKE_USER = {
    "id": "11111111-1111-1111-1111-111111111111",
    "email": "watchdog@example.com",
    "role": "authenticated",
    "user_metadata": {"full_name": "Civic Watchdog"},
    "app_metadata": {"provider": "email"},
}
FAKE_SESSION = {
    "access_token": "fake-access-token",
    "refresh_token": "fake-refresh-token",
    "user": FAKE_USER,
}


class TestAuthEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # -- OAuth URL -----------------------------------------------------------
    def test_oauth_url_returns_authorize_link(self):
        with patch.object(auth_module.supabase_auth, "oauth_authorize_url",
                          return_value="https://proj.supabase.co/auth/v1/authorize?provider=google"):
            resp = self.client.get("/api/auth/oauth/google?redirect=http://localhost:5173")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("authorize", resp.json()["url"])

    def test_oauth_url_rejects_unknown_provider(self):
        resp = self.client.get("/api/auth/oauth/myspace")
        self.assertEqual(resp.status_code, 400)

    def test_oauth_url_rejects_disallowed_redirect_origin(self):
        # Supabase would silently bounce users to the Site URL for this; fail loudly instead.
        resp = self.client.get("/api/auth/oauth/google?redirect=https://evil.example.com")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("not allowed", resp.json()["detail"])

    def test_oauth_url_rejects_non_http_redirect(self):
        resp = self.client.get("/api/auth/oauth/google?redirect=javascript:alert(1)")
        self.assertEqual(resp.status_code, 400)

    def test_oauth_url_defaults_redirect_to_frontend_url(self):
        from backend.config import settings
        with patch.object(auth_module.supabase_auth, "oauth_authorize_url",
                          return_value="https://proj.supabase.co/auth/v1/authorize?provider=google") as mock_url:
            resp = self.client.get("/api/auth/oauth/google")
        self.assertEqual(resp.status_code, 200)
        mock_url.assert_called_once_with("google", settings.FRONTEND_URL)

    def test_oauth_url_forwards_allowed_redirect(self):
        with patch.object(auth_module.supabase_auth, "oauth_authorize_url",
                          return_value="https://proj.supabase.co/auth/v1/authorize?provider=google") as mock_url:
            resp = self.client.get(
                "/api/auth/oauth/google?redirect=http://localhost:5173/signin")
        self.assertEqual(resp.status_code, 200)
        mock_url.assert_called_once_with("google", "http://localhost:5173/signin")

    # -- Sign in -------------------------------------------------------------
    def test_signin_sets_cookie_and_returns_user(self):
        with patch.object(auth_module.supabase_auth, "sign_in_password",
                          new=AsyncMock(return_value=FAKE_SESSION)):
            resp = self.client.post("/api/auth/signin",
                                    json={"email": "watchdog@example.com", "password": "correct-horse"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["user"]["email"], "watchdog@example.com")
        # HTTP-only session cookie must be issued.
        self.assertIn("pt_session", resp.cookies)

    def test_signin_rejects_short_password(self):
        resp = self.client.post("/api/auth/signin",
                                json={"email": "a@b.com", "password": "123"})
        self.assertEqual(resp.status_code, 422)

    def test_signin_invalid_credentials_maps_to_error(self):
        from backend.services.supabase_auth import SupabaseAuthError
        with patch.object(auth_module.supabase_auth, "sign_in_password",
                          new=AsyncMock(side_effect=SupabaseAuthError(400, "Invalid login credentials"))):
            resp = self.client.post("/api/auth/signin",
                                    json={"email": "watchdog@example.com", "password": "wrongpass"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid login", resp.json()["detail"])

    # -- Sign up -------------------------------------------------------------
    def test_signup_requires_email_confirmation(self):
        # No access_token in the response => confirmation required.
        with patch.object(auth_module.supabase_auth, "sign_up",
                          new=AsyncMock(return_value={"id": FAKE_USER["id"], "email": FAKE_USER["email"]})):
            resp = self.client.post("/api/auth/signup",
                                    json={"email": "new@example.com", "password": "correct-horse"})
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["email_confirmation_required"])
        # The user must be told which mailbox the link went to.
        self.assertIn("new@example.com", body["message"])

    def test_signup_autoconfirmed_sets_cookie(self):
        with patch.object(auth_module.supabase_auth, "sign_up",
                          new=AsyncMock(return_value=FAKE_SESSION)):
            resp = self.client.post("/api/auth/signup",
                                    json={"email": "new@example.com", "password": "correct-horse"})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()["email_confirmation_required"])
        self.assertIn("pt_session", resp.cookies)

    def test_signup_forwards_redirect_to_confirmation_email(self):
        with patch.object(auth_module.supabase_auth, "sign_up",
                          new=AsyncMock(return_value={"id": FAKE_USER["id"], "email": FAKE_USER["email"]})) as mock_signup:
            resp = self.client.post("/api/auth/signup",
                                    json={"email": "new@example.com", "password": "correct-horse",
                                          "redirect": "http://localhost:5173/signin"})
        self.assertEqual(resp.status_code, 200)
        mock_signup.assert_awaited_once_with(
            "new@example.com", "correct-horse", redirect_to="http://localhost:5173/signin")

    def test_signup_defaults_redirect_to_frontend_url(self):
        from backend.config import settings
        with patch.object(auth_module.supabase_auth, "sign_up",
                          new=AsyncMock(return_value={"id": FAKE_USER["id"], "email": FAKE_USER["email"]})) as mock_signup:
            resp = self.client.post("/api/auth/signup",
                                    json={"email": "new@example.com", "password": "correct-horse"})
        self.assertEqual(resp.status_code, 200)
        mock_signup.assert_awaited_once_with(
            "new@example.com", "correct-horse", redirect_to=settings.FRONTEND_URL)

    def test_signup_rejects_disallowed_redirect_origin(self):
        with patch.object(auth_module.supabase_auth, "sign_up",
                          new=AsyncMock(return_value=FAKE_USER)) as mock_signup:
            resp = self.client.post("/api/auth/signup",
                                    json={"email": "new@example.com", "password": "correct-horse",
                                          "redirect": "https://evil.example.com"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("not allowed", resp.json()["detail"])
        mock_signup.assert_not_awaited()

    def test_sign_up_sends_redirect_to_in_query_string(self):
        # GoTrue has no redirect_to field on the signup body: it reads the
        # parameter off the request URL when building the confirmation link.
        import asyncio
        from backend.services.supabase_auth import supabase_auth

        with patch.object(supabase_auth, "_post",
                          new=AsyncMock(return_value={})) as mock_post:
            asyncio.run(supabase_auth.sign_up(
                "new@example.com", "correct-horse",
                redirect_to="http://localhost:5173/signin"))

        path, payload = mock_post.await_args.args
        self.assertEqual(path, "/signup?redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fsignin")
        self.assertEqual(payload, {"email": "new@example.com", "password": "correct-horse"})
        self.assertNotIn("redirect_to", payload)

    def test_sign_up_omits_redirect_query_by_default(self):
        import asyncio
        from backend.services.supabase_auth import supabase_auth

        with patch.object(supabase_auth, "_post",
                          new=AsyncMock(return_value={})) as mock_post:
            asyncio.run(supabase_auth.sign_up("new@example.com", "correct-horse"))
        self.assertEqual(mock_post.await_args.args[0], "/signup")

    # -- Resend confirmation -------------------------------------------------
    def test_resend_returns_confirmation_message(self):
        with patch.object(auth_module.supabase_auth, "resend_confirmation",
                          new=AsyncMock(return_value={})):
            resp = self.client.post("/api/auth/resend",
                                    json={"email": "new@example.com"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("new@example.com", resp.json()["message"])

    def test_resend_surfaces_supabase_delivery_error(self):
        from backend.services.supabase_auth import SupabaseAuthError
        with patch.object(auth_module.supabase_auth, "resend_confirmation",
                          new=AsyncMock(side_effect=SupabaseAuthError(
                              400, 'Email address "a@b.com" cannot be used as it is not authorized'))):
            resp = self.client.post("/api/auth/resend", json={"email": "a@b.com"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("not authorized", resp.json()["detail"])

    def test_resend_maps_rate_limit_to_429(self):
        from backend.services.supabase_auth import SupabaseAuthError
        with patch.object(auth_module.supabase_auth, "resend_confirmation",
                          new=AsyncMock(side_effect=SupabaseAuthError(
                              429, "Email rate limit exceeded"))):
            resp = self.client.post("/api/auth/resend", json={"email": "a@b.com"})
        self.assertEqual(resp.status_code, 429)

    def test_resend_rejects_disallowed_redirect_origin(self):
        with patch.object(auth_module.supabase_auth, "resend_confirmation",
                          new=AsyncMock(return_value={})) as mock_resend:
            resp = self.client.post("/api/auth/resend",
                                    json={"email": "a@b.com",
                                          "redirect": "https://evil.example.com"})
        self.assertEqual(resp.status_code, 400)
        mock_resend.assert_not_awaited()

    def test_resend_service_puts_redirect_in_query_string(self):
        import asyncio
        from backend.services.supabase_auth import supabase_auth

        with patch.object(supabase_auth, "_post",
                          new=AsyncMock(return_value={})) as mock_post:
            asyncio.run(supabase_auth.resend_confirmation(
                "new@example.com", redirect_to="http://localhost:5173"))

        path, payload = mock_post.await_args.args
        self.assertEqual(path, "/resend?redirect_to=http%3A%2F%2Flocalhost%3A5173")
        self.assertEqual(payload, {"type": "signup", "email": "new@example.com"})

    # -- Session + signout ---------------------------------------------------
    def test_session_without_cookie_is_null(self):
        resp = self.client.get("/api/auth/session")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.json()["user"])

    def test_signin_then_session_then_signout_flow(self):
        client = TestClient(app)
        with patch.object(auth_module.supabase_auth, "sign_in_password",
                          new=AsyncMock(return_value=FAKE_SESSION)):
            r1 = client.post("/api/auth/signin",
                             json={"email": "watchdog@example.com", "password": "correct-horse"})
        self.assertEqual(r1.status_code, 200)

        # Session reads the cookie and verifies with Supabase.
        with patch.object(auth_module.supabase_auth, "get_user",
                          new=AsyncMock(return_value=FAKE_USER)):
            r2 = client.get("/api/auth/session")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json()["user"]["id"], FAKE_USER["id"])

        with patch.object(auth_module.supabase_auth, "sign_out", new=AsyncMock(return_value=None)):
            r3 = client.post("/api/auth/signout")
        self.assertEqual(r3.status_code, 200)

    def test_session_refreshes_expired_access_token(self):
        from backend.services.supabase_auth import SupabaseAuthError
        client = TestClient(app)
        with patch.object(auth_module.supabase_auth, "sign_in_password",
                          new=AsyncMock(return_value=FAKE_SESSION)):
            client.post("/api/auth/signin",
                        json={"email": "watchdog@example.com", "password": "correct-horse"})

        # First get_user call fails (expired), refresh succeeds.
        with patch.object(auth_module.supabase_auth, "get_user",
                          new=AsyncMock(side_effect=SupabaseAuthError(401, "expired"))), \
             patch.object(auth_module.supabase_auth, "refresh",
                          new=AsyncMock(return_value=FAKE_SESSION)):
            resp = client.get("/api/auth/session")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["user"]["email"], FAKE_USER["email"])

    # -- OAuth callback ------------------------------------------------------
    def test_oauth_callback_persists_session(self):
        with patch.object(auth_module.supabase_auth, "get_user",
                          new=AsyncMock(return_value=FAKE_USER)):
            resp = self.client.post("/api/auth/callback",
                                    json={"access_token": "fake-access-token",
                                          "refresh_token": "fake-refresh-token"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["user"]["email"], FAKE_USER["email"])
        self.assertIn("pt_session", resp.cookies)

    # -- get_current_user dependency ----------------------------------------
    def test_get_current_user_rejects_without_cookie(self):
        import asyncio
        from fastapi import Request, HTTPException

        scope = {"type": "http", "headers": []}
        req = Request(scope)
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(auth_module.get_current_user(req))
        self.assertEqual(ctx.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
