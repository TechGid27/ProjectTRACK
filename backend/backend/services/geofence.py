"""
Geofence Verification Service (Pillar 1 — Physical Presence)
============================================================
Server-authoritative proximity check. The backend NEVER trusts the client's
claim that it was on site: it recomputes the great-circle (Haversine) distance
between the reporter's device coordinates and the project's authoritative DPWH
coordinates (from Neo4j), and enforces the ≤150m geofence here.

The Haversine implementation mirrors the mobile client
(``mobile/src/core/geoUtils.ts``) so a given coordinate pair yields the same
distance on both sides.
"""

import math
from dataclasses import dataclass
from typing import Optional

# Default geofence radius in meters (matches the mobile client default).
DEFAULT_GEOFENCE_RADIUS_M = 150

_EARTH_RADIUS_KM = 6371.0


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two WGS84 coordinates, in kilometers."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return _EARTH_RADIUS_KM * c


@dataclass
class GeofenceResult:
    """Outcome of a server-authoritative proximity check."""
    geofence_pass: bool
    distance_meters: Optional[int]
    reason: Optional[str] = None  # e.g. "no_reference_coords", "no_device_coords"


def verify_proximity(
    project_lat: Optional[float],
    project_lng: Optional[float],
    user_lat: Optional[float],
    user_lng: Optional[float],
    max_radius_m: int = DEFAULT_GEOFENCE_RADIUS_M,
) -> GeofenceResult:
    """
    Recompute distance server-side and decide whether the reporter is within the
    geofence. Missing project coordinates -> fail with ``no_reference_coords``
    (we cannot verify, so we do not pass). Missing device coordinates -> fail
    with ``no_device_coords``.
    """
    if project_lat is None or project_lng is None:
        return GeofenceResult(geofence_pass=False, distance_meters=None, reason="no_reference_coords")
    if user_lat is None or user_lng is None:
        return GeofenceResult(geofence_pass=False, distance_meters=None, reason="no_device_coords")

    distance_km = haversine_distance_km(user_lat, user_lng, project_lat, project_lng)
    distance_m = round(distance_km * 1000)
    return GeofenceResult(
        geofence_pass=distance_m <= max_radius_m,
        distance_meters=distance_m,
        reason=None,
    )
