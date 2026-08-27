import json
import math
from pathlib import Path

from firepoint_core.geodesy import enu_basis, geodetic_to_ecef
from firepoint_core.models import GeoPoint
from firepoint_core.pipeline import calculate_location


def _dot(left, right):
    return sum(left[index] * right[index] for index in range(3))


def compatible_observations():
    example = Path(__file__).parents[1] / "examples" / "dji_m4td_demo.json"
    first = json.loads(example.read_text(encoding="utf-8"))
    first["id"] = "camera-a"
    first["name"] = "相机 A"
    location = calculate_location(first)["location"]
    target = GeoPoint(location["longitude"], location["latitude"], location["elevationM"])
    origin = GeoPoint(target.longitude - 0.002, target.latitude, 348.71)
    direction = tuple(target_value - camera_value for target_value, camera_value in zip(geodetic_to_ecef(target), geodetic_to_ecef(origin)))
    length = math.sqrt(_dot(direction, direction))
    direction = tuple(value / length for value in direction)
    east, north, up = enu_basis(origin)
    second = {
        "id": "camera-b",
        "name": "相机 B",
        "observation": {"id": "camera-b", "capturedAt": "2026-06-22T03:11:26.708152Z", "image": {"width": 4032, "height": 3024}, "targetBox": {"x": 2015.5, "y": 1511.5, "width": 1, "height": 1}},
        "camera": {"longitude": origin.longitude, "latitude": origin.latitude, "absoluteElevationM": origin.elevation_m, "horizontalCrs": "WGS84", "verticalDatum": "ellipsoidal"},
        "pose": {"azimuthDeg": math.degrees(math.atan2(_dot(direction, east), _dot(direction, north))), "pitchDeg": math.degrees(math.asin(_dot(direction, up))), "rollDeg": 0.0},
        "calibration": {"horizontalFovDeg": 84.0, "verticalFovDeg": 65.5},
        "calculation": {"positionErrorM": 0.5, "angleErrorDeg": 0.5, "demVerticalErrorM": 1.0},
    }
    return first, second, target
