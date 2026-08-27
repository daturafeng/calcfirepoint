import json
import unittest

from firepoint_core.multicamera import calculate_multicamera_intersection
from multicamera_fixture import compatible_observations


class MultiCameraTests(unittest.TestCase):
    def setUp(self):
        self.first, self.second, self.target = compatible_observations()

    def request(self, observations, calculation=None):
        return {"dem": self.first["dem"], "observations": observations, "calculation": calculation or {}}

    def test_intersects_two_compatible_observations(self):
        result = calculate_multicamera_intersection(self.request([self.first, self.second]))
        self.assertEqual(result["status"], "ready")
        self.assertAlmostEqual(result["location"]["longitude"], self.target.longitude, places=4)
        self.assertAlmostEqual(result["location"]["latitude"], self.target.latitude, places=4)
        self.assertEqual(len(result["location"]["observations"]), 2)

    def test_requires_two_observations(self):
        result = calculate_multicamera_intersection(self.request([self.first]))
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["checks"][0]["reason"], "at_least_two_observations_required")

    def test_rejects_weak_geometry(self):
        duplicate = json.loads(json.dumps(self.first))
        duplicate["id"] = "camera-b"
        result = calculate_multicamera_intersection(self.request([self.first, duplicate]))
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["checks"][-1]["reason"], "weak_geometry")

    def test_rejects_conflicting_observations(self):
        conflicting = json.loads(json.dumps(self.second))
        conflicting["pose"]["azimuthDeg"] += 45.0
        result = calculate_multicamera_intersection(self.request([self.first, conflicting], {"maxResidualM": 1.0}))
        self.assertEqual(result["status"], "not_ready")
        self.assertEqual(result["checks"][-1]["reason"], "observation_disagreement")
