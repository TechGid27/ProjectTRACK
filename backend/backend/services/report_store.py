"""
Report Persistence Service (Supabase Postgres + Storage)
========================================================
Thin, dependency-light async client over Supabase PostgREST (``/rest/v1``) and
Storage (``/storage/v1``), using the SERVICE ROLE key so the backend is the sole
writer (bypassing RLS). Mirrors the style of ``supabase_auth.py``: an async
httpx client, a small stable surface, and a typed error.

Surface used by the reports router / reputation engine:
    insert_report(row)                  -> dict (inserted row)
    list_reports_by_project(project_id) -> list[dict] (newest first)
    recent_report_count(user_id, since) -> int        (Pillar 3 rate limit)
    all_phashes(exclude_null=True)      -> list[str]   (Pillar 2 recycled check)
    upload_photo(path, data, content_type) -> public_url
    get_reputation(user_id)             -> dict | None
    upsert_reputation(record)           -> dict
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from backend.config import settings

logger = logging.getLogger("report_store")


class ReportStoreError(Exception):
    """Raised when a Supabase data/storage call fails. Carries HTTP-style status + message."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class ReportStore:
    """Async Supabase PostgREST + Storage client scoped to the configured project."""

    REPORTS_TABLE = "reports"
    REPUTATION_TABLE = "user_reputation"

    def __init__(self) -> None:
        self._timeout = 15.0

    # -- configuration helpers ------------------------------------------------
    @property
    def _rest_url(self) -> Optional[str]:
        if not settings.SUPABASE_URL:
            return None
        return settings.SUPABASE_URL.rstrip("/") + "/rest/v1"

    @property
    def _storage_url(self) -> Optional[str]:
        if not settings.SUPABASE_URL:
            return None
        return settings.SUPABASE_URL.rstrip("/") + "/storage/v1"

    @property
    def _service_key(self) -> Optional[str]:
        return settings.SUPABASE_SERVICE_KEY

    @property
    def bucket(self) -> str:
        return settings.SUPABASE_REPORT_BUCKET

    def is_configured(self) -> bool:
        return bool(self._rest_url and self._service_key)

    def _ensure_configured(self) -> None:
        if not self.is_configured():
            raise ReportStoreError(
                503,
                "Report persistence is not configured. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_KEY in the backend environment.",
            )

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        key = self._service_key or ""
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    @staticmethod
    def _extract_error(resp: httpx.Response) -> str:
        try:
            body = resp.json()
        except Exception:
            return f"Supabase request failed (HTTP {resp.status_code})."
        if isinstance(body, dict):
            for key in ("message", "msg", "error", "error_description", "hint"):
                if body.get(key):
                    return str(body[key])
        return f"Supabase request failed (HTTP {resp.status_code})."

    # -- PostgREST: reports ---------------------------------------------------
    async def insert_report(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a report row and return the created record."""
        self._ensure_configured()
        url = f"{self._rest_url}/{self.REPORTS_TABLE}"
        headers = self._headers({"Prefer": "return=representation"})
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, headers=headers, json=row)
        except Exception as e:
            logger.warning(f"insert_report transport error: {e}")
            raise ReportStoreError(503, "Could not reach the report datastore.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        data = resp.json() if resp.content else []
        return data[0] if isinstance(data, list) and data else (data or {})

    async def list_reports_by_project(self, project_id: str, limit: int = 200) -> List[Dict[str, Any]]:
        """Return a project's reports, newest first."""
        self._ensure_configured()
        params = {
            "project_id": f"eq.{project_id}",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        url = f"{self._rest_url}/{self.REPORTS_TABLE}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
        except Exception as e:
            logger.warning(f"list_reports_by_project transport error: {e}")
            raise ReportStoreError(503, "Could not reach the report datastore.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        return resp.json() if resp.content else []

    async def recent_report_count(self, user_id: str, since: datetime) -> int:
        """Count reports a user filed at/after ``since`` (Pillar 3 rate limit)."""
        self._ensure_configured()
        params = {
            "reporter_id": f"eq.{user_id}",
            "created_at": f"gte.{since.isoformat()}",
            "select": "id",
        }
        url = f"{self._rest_url}/{self.REPORTS_TABLE}"
        # Prefer: count=exact returns the total in the Content-Range header.
        headers = self._headers({"Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=headers, params=params)
        except Exception as e:
            logger.warning(f"recent_report_count transport error: {e}")
            raise ReportStoreError(503, "Could not reach the report datastore.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        content_range = resp.headers.get("content-range", "")
        # Format is "0-0/<total>" or "*/<total>".
        if "/" in content_range:
            total = content_range.split("/")[-1]
            if total.isdigit():
                return int(total)
        # Fallback: count the returned rows.
        body = resp.json() if resp.content else []
        return len(body) if isinstance(body, list) else 0

    async def report_counts_by_project(
        self, status: Optional[str] = None
    ) -> Dict[str, int]:
        """
        Return a ``{project_id: report_count}`` map aggregated across all reports,
        optionally restricted to a single verdict ``status`` (e.g. ``"flagged"``).

        PostgREST group-by aggregation varies by deployment, so this fetches the
        ``project_id`` column (with an optional ``status`` filter) and tallies
        client-side — portable and index-friendly. Resilient by design: when the
        datastore is unconfigured or the request fails it returns ``{}`` so the
        caller can fall back to the graph-maintained ``report_count`` ranking.
        """
        if not self.is_configured():
            return {}
        params = {"select": "project_id"}
        if status:
            params["status"] = f"eq.{status}"
        url = f"{self._rest_url}/{self.REPORTS_TABLE}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
        except Exception as e:
            logger.warning(f"report_counts_by_project transport error: {e}")
            return {}
        if resp.status_code >= 400:
            logger.warning(
                "report_counts_by_project failed: %s", self._extract_error(resp)
            )
            return {}
        rows = resp.json() if resp.content else []
        counts: Dict[str, int] = {}
        for row in rows:
            if isinstance(row, dict) and row.get("project_id"):
                pid = str(row["project_id"])
                counts[pid] = counts.get(pid, 0) + 1
        return counts

    async def all_phashes(self) -> List[str]:
        """Return all non-null perceptual hashes from prior reports (Pillar 2)."""
        self._ensure_configured()
        params = {"select": "phash", "phash": "not.is.null"}
        url = f"{self._rest_url}/{self.REPORTS_TABLE}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
        except Exception as e:
            logger.warning(f"all_phashes transport error: {e}")
            raise ReportStoreError(503, "Could not reach the report datastore.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        rows = resp.json() if resp.content else []
        return [r["phash"] for r in rows if isinstance(r, dict) and r.get("phash")]

    # -- Storage: photos ------------------------------------------------------
    async def upload_photo(self, object_path: str, data: bytes, content_type: str) -> str:
        """Upload a photo to the report-photos bucket and return its public URL."""
        self._ensure_configured()
        upload_url = f"{self._storage_url}/object/{self.bucket}/{object_path}"
        headers = {
            "apikey": self._service_key or "",
            "Authorization": f"Bearer {self._service_key or ''}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(upload_url, headers=headers, content=data)
        except Exception as e:
            logger.warning(f"upload_photo transport error: {e}")
            raise ReportStoreError(503, "Could not reach the photo storage service.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        return self.public_photo_url(object_path)

    def public_photo_url(self, object_path: str) -> str:
        """Build the public URL for an object in the report-photos bucket."""
        base = self._storage_url or ""
        return f"{base}/object/public/{self.bucket}/{object_path}"

    # -- PostgREST: reputation ------------------------------------------------
    async def get_reputation(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Return a user's reputation row, or None if they have none yet."""
        self._ensure_configured()
        params = {"user_id": f"eq.{user_id}", "limit": "1"}
        url = f"{self._rest_url}/{self.REPUTATION_TABLE}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
        except Exception as e:
            logger.warning(f"get_reputation transport error: {e}")
            raise ReportStoreError(503, "Could not reach the reputation datastore.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        rows = resp.json() if resp.content else []
        return rows[0] if isinstance(rows, list) and rows else None

    async def upsert_reputation(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Insert or update a user's reputation row (on_conflict=user_id)."""
        self._ensure_configured()
        url = f"{self._rest_url}/{self.REPUTATION_TABLE}"
        headers = self._headers({"Prefer": "resolution=merge-duplicates,return=representation"})
        params = {"on_conflict": "user_id"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, headers=headers, params=params, json=record)
        except Exception as e:
            logger.warning(f"upsert_reputation transport error: {e}")
            raise ReportStoreError(503, "Could not reach the reputation datastore.")
        if resp.status_code >= 400:
            raise ReportStoreError(resp.status_code, self._extract_error(resp))
        data = resp.json() if resp.content else []
        return data[0] if isinstance(data, list) and data else (data or record)


# Module-level singleton used by the API layer.
report_store = ReportStore()
