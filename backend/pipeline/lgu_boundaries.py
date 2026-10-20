"""
Cebu LGU Polygon Reverse-Geocoder
=================================
Resolves a WGS84 (latitude, longitude) point to the Cebu LGU (city/municipality)
whose official boundary polygon contains it, using the same authoritative
GeoJSON the web map renders (``cebuMunicipalities.json``).

This is used to correct mislabeled ``p.municipality`` values in Neo4j by
reverse-geocoding each project's authentic DPWH/BetterGov coordinates against
the real municipal boundaries, instead of trusting a vague source address
string that defaulted many out-of-province projects to "Cebu City".
"""

import json
import os
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

# cebuMunicipalities.json lives in the web app's public data folder. Resolve it
# relative to the repo root so the pipeline can read the single source of truth.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_THIS_DIR, "..", ".."))
_DEFAULT_GEOJSON = os.path.join(
    _REPO_ROOT, "Website", "public", "data", "cebuMunicipalities.json"
)

# Ring = list of [lng, lat] pairs. Polygon = list of rings (first = outer).
Ring = List[List[float]]
Polygon = List[Ring]


def _point_in_ring(lng: float, lat: float, ring: Ring) -> bool:
    """Ray-casting point-in-polygon test for a single ring. Point is [lng, lat]."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        # Does the horizontal ray at `lat` cross the edge (i, j)?
        intersect = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


def _point_in_polygon(lng: float, lat: float, polygon: Polygon) -> bool:
    """Point is inside if it is in the outer ring and not in any hole ring."""
    if not polygon:
        return False
    if not _point_in_ring(lng, lat, polygon[0]):
        return False
    # Subsequent rings are holes.
    for hole in polygon[1:]:
        if _point_in_ring(lng, lat, hole):
            return False
    return True


@lru_cache(maxsize=1)
def _load_features(geojson_path: str) -> List[Tuple[str, List[Polygon], Tuple[float, float, float, float]]]:
    """
    Load LGU features as (name, multipolygon, bbox) tuples.
    bbox = (min_lng, min_lat, max_lng, max_lat) for a fast pre-filter.
    """
    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = []
    for feat in data.get("features", []):
        name = feat.get("properties", {}).get("name")
        geom = feat.get("geometry", {})
        gtype = geom.get("type")
        coords = geom.get("coordinates", [])

        # Normalize to a list of polygons (MultiPolygon == list of Polygon).
        if gtype == "Polygon":
            polygons: List[Polygon] = [coords]
        elif gtype == "MultiPolygon":
            polygons = coords
        else:
            continue

        # Compute bounding box across all rings.
        min_lng = min_lat = float("inf")
        max_lng = max_lat = float("-inf")
        for poly in polygons:
            for ring in poly:
                for lng, lat in ring:
                    min_lng = min(min_lng, lng)
                    max_lng = max(max_lng, lng)
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)

        features.append((name, polygons, (min_lng, min_lat, max_lng, max_lat)))
    return features


def resolve_lgu(
    latitude: Optional[float],
    longitude: Optional[float],
    geojson_path: str = _DEFAULT_GEOJSON,
) -> Optional[str]:
    """
    Return the Cebu LGU name whose boundary contains (latitude, longitude),
    or None if the point lies outside every Cebu LGU (e.g. Bohol, Negros, sea).
    """
    if latitude is None or longitude is None:
        return None
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return None

    for name, polygons, (min_lng, min_lat, max_lng, max_lat) in _load_features(geojson_path):
        # Fast bbox reject before the expensive ray-cast.
        if not (min_lng <= lng <= max_lng and min_lat <= lat <= max_lat):
            continue
        for poly in polygons:
            if _point_in_polygon(lng, lat, poly):
                return name
    return None


def all_lgu_names(geojson_path: str = _DEFAULT_GEOJSON) -> List[str]:
    """Return all LGU names defined in the boundary file."""
    return [name for name, _, _ in _load_features(geojson_path)]
