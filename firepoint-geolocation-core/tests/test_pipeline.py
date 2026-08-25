import json
import unittest
from pathlib import Path

from firepoint_core.pipeline import calculate_location


class PipelineTests(unittest.TestCase):
    def setUp(self):
        path = Path(__file__).parents[1] / "examples" / "dji_m4td_demo.json"
        self.data = json.loads(path.read_text(encoding="utf-8"))

    def test_dji_metadata_geometry_fixture_hits_simulated_dem(self):
        result = calculate_location(self.data)
        self.assertEqual(result["status"], "ready")
        point = result["location"]
        self.assertAlmostEqual(point["longitude"], 106.5856074, places=4)
        self.assertAlmostEqual(point["latitude"], 29.5962415, places=4)
        self.assertAlmostEqual(point["elevationM"], 280.2, places=3)
        self.assertAlmostEqual(point["slantDistanceM"], 96.983, delta=2.0)

    def test_unknown_coordinate_reference_returns_not_ready(self):
        self.data["camera"]["horizontalCrs"] = "UNKNOWN"
        result = calculate_location(self.data)
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["location"], None)

    def test_timestamp_without_time_zone_returns_not_ready(self):
        self.data["observation"]["capturedAt"] = "2026-06-22T11:11:08"
        result = calculate_location(self.data)
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["checks"][0]["reason"], "missing_time_zone_configuration")
