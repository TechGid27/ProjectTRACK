"""
Geofence Verifier Tests (Pillar 1)
==================================
Server-authoritative proximity checks. The known coordinate pairs mirror the
mobile client's geoUtils.test.ts so the two Haversine implementations agree.
"""

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.geofence import (
    verify_proximity,
    haversine_distance_km,
    DEFAULT_GEOFENCE_RADIUS_M,
)

# Project centroid used across the mobile tests (Bogo River flood control).
TARGET = (11.0505, 124.0055)


class TestHaversine(unittest.TestCase):
    def test_bogo_to_danao_distance(self):
        # Mobile test asserts ~58km (between 50 and 70).
        dist = haversine_distance_km(11.0505, 124.0055, 10.528, 123.938)
        self.assertGreater(dist, 50)
        self.assertLess(dist, 70)

    def test_zero_distance_for_same_point(self):
        self.assertAlmostEqual(haversine_distance_km(*TARGET, *TARGET), 0.0, places=6)


class TestGeofenceProximity(unittest.TestCase):
    def test_inside_geofence(self):
        # ~45m north (mirrors mobile inside case).
        res = verify_proximity(TARGET[0], TARGET[1], 11.0509, 124.0055)
        self.assertTrue(res.geofence_pass)
        self.assertLessEqual(res.distance_meters, 150)
        self.assertIsNone(res.reason)

    def test_outside_geofence(self):
        # ~300m+ north (mirrors mobile outside case).
        res = verify_proximity(TARGET[0], TARGET[1], 11.0535, 124.0055)
        self.assertFalse(res.geofence_pass)
        self.assertGreater(res.distance_meters, 150)

    def test_edge_at_radius_passes(self):
        # Construct a point ~140m away; must pass at the 150m boundary.
        # 0.00126 deg latitude ≈ 140m.
        res = verify_proximity(TARGET[0], TARGET[1], TARGET[0] + 0.00126, TARGET[1])
        self.assertLessEqual(res.distance_meters, DEFAULT_GEOFENCE_RADIUS_M)
        self.assertTrue(res.geofence_pass)

    def test_custom_radius(self):
        res = verify_proximity(TARGET[0], TARGET[1], 11.0509, 124.0055, max_radius_m=10)
        self.assertFalse(res.geofence_pass)  # ~45m > 10m

    def test_missing_project_coords(self):
        res = verify_proximity(None, None, 11.0509, 124.0055)
        self.assertFalse(res.geofence_pass)
        self.assertIsNone(res.distance_meters)
        self.assertEqual(res.reason, "no_reference_coords")

    def test_missing_device_coords(self):
        res = verify_proximity(TARGET[0], TARGET[1], None, None)
        self.assertFalse(res.geofence_pass)
        self.assertEqual(res.reason, "no_device_coords")


if __name__ == "__main__":
    unittest.main()
