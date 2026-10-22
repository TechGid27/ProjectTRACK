"""
Field Report Endpoints
======================
The citizen report-verification pipeline. Implements four pillars end-to-end:

  POST /api/reports              submit a field report (multipart)
  GET  /api/reports/summaries    map-wide per-project verification counts
  GET  /api/reports/{project_id} list a project's reports with verification badges

Submission pipeline (order matters):
  1. Identity (Pillar 3)   — require an authenticated session (get_current_user).
  2. Rate limit (Pillar 3) — reject a 4th report in a rolling 24h window (429).
  3. Geofence (Pillar 1)   — recompute distance server-side vs DPWH coordinates.
  4. Forensics (Pillar 2)  — ELA + pHash (vs prior reports) on the uploaded photo.
  5. Storage               — upload the photo to the report-photos bucket.
  6. Verdict (Pillar 5)    — derive status from geofence + forensics.
  7. Persist               — insert the row, bump reputation, link Neo4j node.

The client contract matches the web/mobile code already in the repo: a multipart
POST with `credentials: 'include'` (cookie session) and NO Authorization header.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Response, UploadFile, status

from backend.api.auth import get_current_user
from backend.models.auth import AuthUser
from backend.models.report import (
    ReportVerification,
    ReportRecord,
    ReportListResponse,
    ProjectReportSummary,
    ReportSummariesResponse,
    REPORT_CATEGORIES,
    sanitize_input_text,
)
from backend.services.report_store import report_store, ReportStoreError
from backend.services.neo4j_service import neo4j_service
from backend.services import geofence as geofence_service
from backend.services import forensics as forensics_service
from backend.services import reputation as reputation_service

logger = logging.getLogger("reports_api")

router = APIRouter(prefix="/reports", tags=["Field Reports"])

# Pillar 3: Sybil resistance — max reports per user per rolling 24h window.
DAILY_REPORT_LIMIT = 3
_ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB (mirrors the storage bucket limit)
_PHOTO_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _derive_status(geofence_pass: bool, forensics_verdict: str) -> str:
    """
    Map verification signals to a verdict status (Pillar 5).
      * recycled photo            -> flagged (strongest negative signal)
      * outside geofence          -> flagged (not physically on site)
      * suspicious forensics      -> pending (needs a closer look)
      * clean + inside geofence   -> verified
    """
    if forensics_verdict == "recycled":
        return "flagged"
    if not geofence_pass:
        return "flagged"
    if forensics_verdict == "suspicious":
        return "pending"
    return "verified"


def _row_to_record(row: dict) -> ReportRecord:
    """Map a stored Supabase row to the client-facing ReportRecord (badging)."""
    return ReportRecord(
        id=str(row.get("id")),
        project_id=row.get("project_id"),
        status=row.get("status", "pending"),
        distance_meters=row.get("distance_meters"),
        geofence_pass=bool(row.get("geofence_pass", False)),
        ela_score=row.get("ela_score"),
        phash_recycled=bool(row.get("phash_recycled", False)),
        forensics_verdict=row.get("forensics_verdict", "clean"),
        reporter_reputation=int(row.get("reporter_reputation", 0) or 0),
        created_at=row.get("created_at") or datetime.now(timezone.utc),
        description=row.get("description", ""),
        category=row.get("category", "other"),
        photo_url=row.get("photo_url"),
        latitude=row.get("latitude"),
        longitude=row.get("longitude"),
    )


@router.post(
    "",
    response_model=ReportVerification,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a verified field report",
)
async def submit_report(
    response: Response,
    project_id: str = Form(...),
    description: str = Form(..., min_length=10, max_length=2000),
    category: str = Form(default="other"),
    latitude: Optional[float] = Form(default=None),
    longitude: Optional[float] = Form(default=None),
    picture: Optional[UploadFile] = File(default=None),
    user: AuthUser = Depends(get_current_user),  # Pillar 3: identity required
) -> ReportVerification:
    # --- sanitize & validate inputs -----------------------------------------
    project_id = sanitize_input_text(project_id, max_len=50)
    description = sanitize_input_text(description, max_len=2000)
    if len(description) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Description must be at least 10 characters after sanitization.",
        )

    if category not in REPORT_CATEGORIES:
        category = "other"

    # --- Pillar 3: rolling 24h rate limit -----------------------------------
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    try:
        recent = await report_store.recent_report_count(user.id, since)
    except ReportStoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    if recent >= DAILY_REPORT_LIMIT:
        response.headers["Retry-After"] = "86400"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily report limit reached ({DAILY_REPORT_LIMIT} per 24 hours).",
        )

    # --- resolve authoritative project coordinates --------------------------
    project = neo4j_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")

    # --- Pillar 1: server-authoritative geofence ----------------------------
    geo = geofence_service.verify_proximity(
        project.get("latitude"), project.get("longitude"), latitude, longitude
    )

    # --- Pillar 2: image forensics ------------------------------------------
    ela_score = None
    phash = None
    phash_recycled = False
    forensics_verdict = "clean"
    photo_url = None
    photo_path = None

    if picture is not None:
        content_type = (picture.content_type or "").lower()
        if content_type not in _ALLOWED_PHOTO_TYPES:
            raise HTTPException(status_code=422, detail="Photo must be JPEG, PNG, or WebP.")
        data = await picture.read()
        if len(data) > _MAX_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail="Photo exceeds the 10 MB limit.")
        try:
            prior = await report_store.all_phashes()
            result = forensics_service.analyze(data, prior_phashes=prior)
        except ReportStoreError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message)
        except Exception as exc:  # malformed/undecodable image
            logger.warning("Forensics failed: %s", exc)
            raise HTTPException(status_code=422, detail="Uploaded file is not a valid image.")
        ela_score = result.ela_score
        phash = result.phash
        phash_recycled = result.phash_recycled
        forensics_verdict = result.verdict

        # --- upload the photo ------------------------------------------------
        ext = _PHOTO_EXT.get(content_type, "jpg")
        photo_path = f"{project_id}/{uuid.uuid4().hex}.{ext}"
        try:
            photo_url = await report_store.upload_photo(photo_path, data, content_type)
        except ReportStoreError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # --- Pillar 5: verdict ---------------------------------------------------
    report_status = _derive_status(geo.geofence_pass, forensics_verdict)

    # --- reputation (read current for the row; update after insert) ---------
    reporter_reputation = await reputation_service.get_score(user.id)

    now = datetime.now(timezone.utc)
    report_id = str(uuid.uuid4())
    row = {
        "id": report_id,
        "project_id": project_id,
        "reporter_id": user.id,
        "description": description,
        "category": category,
        "photo_url": photo_url,
        "photo_path": photo_path,
        "latitude": latitude,
        "longitude": longitude,
        "distance_meters": geo.distance_meters,
        "geofence_pass": geo.geofence_pass,
        "ela_score": ela_score,
        "phash": phash,
        "phash_recycled": phash_recycled,
        "forensics_verdict": forensics_verdict,
        "status": report_status,
        "reporter_reputation": reporter_reputation,
        "created_at": now.isoformat(),
    }

    try:
        saved = await report_store.insert_report(row)
    except ReportStoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # --- Pillar 3: update reputation from this report's signals -------------
    try:
        updated = await reputation_service.apply_report_outcome(
            user.id,
            reputation_service.ReputationSignals(
                geofence_pass=geo.geofence_pass, forensics_verdict=forensics_verdict
            ),
        )
        reporter_reputation = updated.get("score", reporter_reputation)
    except ReportStoreError as exc:
        logger.warning("Reputation update failed (non-fatal): %s", exc.message)

    # --- Neo4j graph visibility (non-fatal) ---------------------------------
    neo4j_service.add_report_link(project_id, report_id, report_status)

    return ReportVerification(
        id=report_id,
        project_id=project_id,
        status=report_status,
        distance_meters=geo.distance_meters,
        geofence_pass=geo.geofence_pass,
        ela_score=ela_score,
        phash_recycled=phash_recycled,
        forensics_verdict=forensics_verdict,
        reporter_reputation=reporter_reputation,
        created_at=saved.get("created_at") if isinstance(saved, dict) and saved.get("created_at") else now,
    )


@router.get(
    "/summaries",
    response_model=ReportSummariesResponse,
    summary="Map-wide per-project verification counts (public, redacted)",
)
async def report_summaries() -> ReportSummariesResponse:
    """Aggregate badge tones per project for the interactive map legend.

    Public like the per-project list: returns only project_id + status counts
    (no descriptions, photos, reporter ids, or coordinates).
    """
    try:
        rows = await report_store.summarize_reports()
    except ReportStoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    # Tone buckets mirror the web client's deriveBadge():
    #   verified                    -> on_site   (On-Site Verified, violet)
    #   pending | flagged | rejected -> flagged  (Photo Flagged, rose)
    #   anything else               -> unverified (Unverified, white)
    buckets: dict[str, ProjectReportSummary] = {}
    for row in rows:
        project_id = row.get("project_id")
        if not project_id:
            continue
        summary = buckets.setdefault(project_id, ProjectReportSummary(project_id=project_id))
        status_value = row.get("status") or "pending"
        if status_value == "verified":
            summary.on_site += 1
        elif status_value in ("pending", "flagged", "rejected"):
            summary.flagged += 1
        else:
            summary.unverified += 1
        summary.total += 1

    summaries = [buckets[key] for key in sorted(buckets)]
    return ReportSummariesResponse(count=len(summaries), summaries=summaries)


@router.get(
    "/{project_id}",
    response_model=ReportListResponse,
    summary="List a project's field reports with verification badges",
)
async def list_reports(
    project_id: str = Path(..., min_length=2),
) -> ReportListResponse:
    try:
        rows = await report_store.list_reports_by_project(project_id)
    except ReportStoreError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    records = [_row_to_record(r) for r in rows]
    return ReportListResponse(project_id=project_id, count=len(records), reports=records)
