import asyncio
import json
import unittest
from unittest.mock import patch

from firepoint_api.main import intersect
from multicamera_fixture import compatible_observations


def observation(identifier, longitude, latitude, azimuth, pitch):
    return {
        "id": identifier,
        "name": identifier,
        "observation": {"id": identifier, "capturedAt": "2026-06-22T03:11:26.708152Z", "image": {"width": 4032, "height": 3024}, "targetBox": {"x": 2015.5, "y": 1511.5, "width": 1, "height": 1}},
        "camera": {"longitude": longitude, "latitude": latitude, "absoluteElevationM": 348.71, "horizontalCrs": "WGS84", "verticalDatum": "ellipsoidal"},
        "pose": {"azimuthDeg": azimuth, "pitchDeg": pitch, "rollDeg": 0.0},
        "calibration": {"horizontalFovDeg": 84.0, "verticalFovDeg": 65.5},
    }


class MultiCameraApiTests(unittest.TestCase):
    def test_intersection_api_returns_successful_result(self):
        first, second, _ = compatible_observations()
        payload = {"demSourceId": "test-dem", "observations": [first, second]}
        with patch("firepoint_api.main.resolve_dem", return_value=first["dem"]):
            response = asyncio.run(intersect(json.dumps(payload)))
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.body)
        self.assertEqual(body["status"], "ready")
        self.assertEqual(len(body["location"]["observations"]), 2)

    def test_intersection_api_returns_typed_weak_geometry(self):
        payload = {
            "demSourceId": "test-dem",
            "observations": [
                observation("a", 106.586110015, 29.595824927, -45.2, -45.0),
                observation("b", 106.586110015, 29.595824927, -45.2, -45.0),
            ],
        }
        with patch("firepoint_api.main.resolve_dem", return_value={"kind": "constant", "elevationM": 280.2}):
            response = asyncio.run(intersect(json.dumps(payload)))
        self.assertEqual(response.status_code, 422)
        body = json.loads(response.body)
        self.assertEqual(body["status"], "not_ready")
        self.assertEqual(body["checks"][-1]["reason"], "weak_geometry")
