"""
Pipeline Schedule State Store (Supabase PostgREST)
==================================================
Durable last-run tracking for the passive periodic scraper. Mirrors the
dependency-light async style of ``report_store.py``: an httpx client over
PostgREST (``/rest/v1``) using the SERVICE ROLE key (backend is the sole
writer, bypassing RLS).

Backs ``pipeline_schedule_state`` (migration 0003). Every method degrades
gracefully: when Supabase is unconfigured or a call fails, reads return
``None`` and writes return ``False`` so the scheduler can fall back to an
in-memory clock without crashing the application.

Surface:
    get_last_run(job_name)                 -> datetime | None
    get_state(job_name)                    -> dict | None
    stamp_run(job_name, status, job_id, when) -> bool
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from backend.config import settings

logger = logging.getLogger("schedule_store")


class ScheduleStore:
    """Async Supabase PostgREST client for the pipeline_schedule_state table."""

    TABLE = "pipeline_schedule_state"

    def __init__(self) -> None:
        self._timeout = 15.0

    @property
    def _rest_url(self) -> Optional[str]:
        if not settings.SUPABASE_URL:
            return None
        return settings.SUPABASE_URL.rstrip("/") + "/rest/v1"

    @property
    def _service_key(self) -> Optional[str]:
        return settings.SUPABASE_SERVICE_KEY

    def is_configured(self) -> bool:
        return bool(self._rest_url and self._service_key)

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
    def _parse_dt(value: Any) -> Optional[datetime]:
        if not value or not isinstance(value, str):
            return None
        try:
            # PostgREST returns ISO-8601; normalize a trailing Z to +00:00.
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    async def get_state(self, job_name: str) -> Optional[Dict[str, Any]]:
        """Return the raw state row for a job, or None (unconfigured/missing/error)."""
        if not self.is_configured():
            return None
        params = {"job_name": f"eq.{job_name}", "limit": "1"}
        url = f"{self._rest_url}/{self.TABLE}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
        except Exception as e:
            logger.warning(f"get_state transport error: {e}")
            return None
        if resp.status_code >= 400:
            logger.warning("get_state failed (HTTP %s)", resp.status_code)
            return None
        rows = resp.json() if resp.content else []
        return rows[0] if isinstance(rows, list) and rows else None

    async def get_last_run(self, job_name: str) -> Optional[datetime]:
        """Return the last_run_at timestamp for a job, or None."""
        state = await self.get_state(job_name)
        return self._parse_dt(state.get("last_run_at")) if state else None

    async def stamp_run(
        self,
        job_name: str,
        status: str,
        job_id: Optional[str] = None,
        when: Optional[datetime] = None,
    ) -> bool:
        """
        Upsert the job's last-run state. Returns True on success, False if the
        datastore is unconfigured or the write fails (non-fatal for the caller).
        """
        if not self.is_configured():
            return False
        now = datetime.now(timezone.utc)
        record = {
            "job_name": job_name,
            "last_run_at": (when or now).isoformat(),
            "last_status": status,
            "last_job_id": job_id,
            "updated_at": now.isoformat(),
        }
        url = f"{self._rest_url}/{self.TABLE}"
        headers = self._headers(
            {"Prefer": "resolution=merge-duplicates,return=minimal"}
        )
        params = {"on_conflict": "job_name"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, headers=headers, params=params, json=record)
        except Exception as e:
            logger.warning(f"stamp_run transport error: {e}")
            return False
        if resp.status_code >= 400:
            logger.warning("stamp_run failed (HTTP %s)", resp.status_code)
            return False
        return True


# Module-level singleton used by the scheduler.
schedule_store = ScheduleStore()
