from __future__ import annotations

from math import radians, sqrt, tan
from typing import Any

from .dem import ElevationDem, dem_from_config
from .geodesy import add_scaled, ecef_to_geodetic, enu_to_ecef_vector, geodetic_to_ecef
from .models import CalculationOptions, ValidationError, observation_from_dict, validate_capture_timestamp
from .projection import camera_ray_to_enu, pixel_to_camera_ray


def calculate_location(data: dict[str, Any], metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        parsed = observation_from_dict(data)
        readiness = _validate(parsed)
        dem = dem_from_config(parsed["dem_config"])
        pixel = parsed["box"].select_pixel(parsed["target_pixel_strategy"])
        camera_ray = pixel_to_camera_ray(pixel, parsed["image"], parsed["calibration"])
        ray_enu = camera_ray_to_enu(camera_ray, parsed["pose"])
    except (ValidationError, KeyError, TypeError, ValueError) as error:
        return {"status": "not_ready", "checks": [{"name": "input", "status": "missing_or_invalid", "reason": str(error)}], "location": None}

    try:
        hit = intersect_terrain(parsed["camera"].origin, ray_enu, dem, parsed["options"])
    except (RuntimeError, ValueError) as error:
        hit = None
        terrain_reason = str(error)
    else:
        terrain_reason = "no_terrain_intersection"
    result: dict[str, Any] = {
        "status": "ready" if hit else "not_ready",
        "checks": readiness if hit else readiness + [{"name": "terrain_intersection", "status": "unavailable", "reason": terrain_reason}],
        "location": None,
        "provenance": {
            "coordinateReference": "WGS84",
            "verticalDatum": parsed["camera"].vertical_datum,
            "targetPixelStrategy": parsed["target_pixel_strategy"],
            "demDatasetId": dem.dataset_id,
            "metadataCandidates": metadata or {},
        },
    }
    if not hit:
        return result
    point, distance_m = hit
    result["location"] = {
        "longitude": point.longitude,
        "latitude": point.latitude,
        "elevationM": point.elevation_m,
        "slantDistanceM": distance_m,
        "horizontalUncertaintyM": _uncertainty(distance_m, ray_enu[2], parsed["options"]),
        "targetPixel": {"x": pixel[0], "y": pixel[1]},
        "capturedAt": parsed["captured_at"],
    }
    return result


def _validate(parsed: dict[str, Any]) -> list[dict[str, str]]:
    validate_capture_timestamp(parsed["captured_at"])
    parsed["image"].validate()
    parsed["box"].validate(parsed["image"])
    parsed["camera"].validate()
    parsed["pose"].validate()
    parsed["calibration"].focal_pixels(parsed["image"])
    parsed["options"].validate()
    return [
        {"name": "camera_origin", "status": "available"},
        {"name": "camera_pose", "status": "available"},
        {"name": "camera_calibration", "status": "available"},
        {"name": "target_geometry", "status": "available"},
        {"name": "coordinate_reference", "status": "available"},
        {"name": "terrain_coverage", "status": "available"},
    ]


def intersect_terrain(origin, ray_enu: tuple[float, float, float], dem: ElevationDem, options: CalculationOptions):
    origin_ecef = geodetic_to_ecef(origin)
    ray_ecef = enu_to_ecef_vector(ray_enu, origin)
    previous_distance = 0.0
    previous_delta = origin.elevation_m - _dem_height(origin, dem)
    if previous_delta <= 0:
        return None
    distance = options.step_m
    while distance <= options.max_distance_m:
        point = ecef_to_geodetic(*add_scaled(origin_ecef, ray_ecef, distance))
        try:
            delta = point.elevation_m - _dem_height(point, dem)
        except ValueError:
            return None
        if delta <= 0:
            return _bisect(origin_ecef, ray_ecef, previous_distance, distance, dem)
        previous_distance, previous_delta = distance, delta
        distance += options.step_m
    return None


def _dem_height(point, dem: ElevationDem) -> float:
    elevation = dem.elevation_at(point.longitude, point.latitude)
    if elevation is None:
        raise ValueError("dem_no_data")
    return elevation


def _bisect(origin_ecef, ray_ecef, lower: float, upper: float, dem: ElevationDem):
    for _ in range(40):
        middle = (lower + upper) / 2.0
        point = ecef_to_geodetic(*add_scaled(origin_ecef, ray_ecef, middle))
        if point.elevation_m > _dem_height(point, dem):
            lower = middle
        else:
            upper = middle
    distance = (lower + upper) / 2.0
    point = ecef_to_geodetic(*add_scaled(origin_ecef, ray_ecef, distance))
    return point, distance


def _uncertainty(distance_m: float, vertical_direction: float, options: CalculationOptions) -> float:
    vertical = max(abs(vertical_direction), 0.05)
    angular = distance_m * tan(radians(options.angle_error_deg))
    terrain = options.dem_vertical_error_m / vertical
    return sqrt(options.position_error_m ** 2 + angular ** 2 + terrain ** 2)
