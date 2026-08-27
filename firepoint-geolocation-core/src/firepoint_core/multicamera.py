from __future__ import annotations

from dataclasses import dataclass
from math import acos, degrees, sqrt
from typing import Any

from .dem import dem_from_config
from .geodesy import ecef_to_geodetic, enu_to_ecef_vector, geodetic_to_ecef, normalize
from .models import GeoPoint, ValidationError, observation_from_dict
from .pipeline import _uncertainty, _validate
from .projection import camera_ray_to_enu, pixel_to_camera_ray


Vector = tuple[float, float, float]


@dataclass(frozen=True)
class IntersectionOptions:
    min_ray_angle_deg: float = 8.0
    max_residual_m: float = 80.0

    def validate(self) -> None:
        if not 0.0 < self.min_ray_angle_deg < 90.0:
            raise ValidationError("invalid_min_ray_angle")
        if self.max_residual_m <= 0.0:
            raise ValidationError("invalid_max_residual")


@dataclass(frozen=True)
class PreparedObservation:
    identifier: str
    name: str
    parsed: dict[str, Any]
    origin: Vector
    direction: Vector
    ray_enu: Vector


def calculate_multicamera_intersection(data: dict[str, Any]) -> dict[str, Any]:
    observations_data = data.get("observations")
    if not isinstance(observations_data, list) or len(observations_data) < 2:
        return _not_ready([{"name": "observations", "status": "missing_or_invalid", "reason": "at_least_two_observations_required"}])

    try:
        dem = dem_from_config(data["dem"])
        options = _options_from(data.get("calculation", {}))
    except (KeyError, TypeError, ValueError, ValidationError) as error:
        return _not_ready([{"name": "input", "status": "missing_or_invalid", "reason": str(error)}])

    prepared: list[PreparedObservation] = []
    checks: list[dict[str, str]] = []
    for index, raw in enumerate(observations_data):
        identifier = str(raw.get("id", index + 1)) if isinstance(raw, dict) else str(index + 1)
        try:
            if not isinstance(raw, dict):
                raise ValidationError("invalid_observation")
            parsed = observation_from_dict({**raw, "dem": data["dem"]})
            _validate(parsed)
            pixel = parsed["box"].select_pixel(parsed["target_pixel_strategy"])
            camera_ray = pixel_to_camera_ray(pixel, parsed["image"], parsed["calibration"])
            ray_enu = camera_ray_to_enu(camera_ray, parsed["pose"])
            origin_point = parsed["camera"].origin
            prepared.append(
                PreparedObservation(
                    identifier=identifier,
                    name=str(raw.get("name", f"相机 {index + 1}")),
                    parsed=parsed,
                    origin=geodetic_to_ecef(origin_point),
                    direction=normalize(enu_to_ecef_vector(ray_enu, origin_point)),
                    ray_enu=ray_enu,
                )
            )
            checks.append({"name": f"observation:{identifier}", "status": "available"})
        except (KeyError, TypeError, ValueError, ValidationError) as error:
            checks.append({"name": f"observation:{identifier}", "status": "missing_or_invalid", "reason": str(error)})

    if len(prepared) < 2:
        return _not_ready(checks)

    min_ray_angle = _minimum_ray_angle(prepared)
    if min_ray_angle < options.min_ray_angle_deg:
        return _not_ready(checks + [{"name": "geometry", "status": "unavailable", "reason": "weak_geometry"}], min_ray_angle)

    candidate = _best_fit_point(prepared)
    if candidate is None:
        return _not_ready(checks + [{"name": "geometry", "status": "unavailable", "reason": "weak_geometry"}], min_ray_angle)
    candidate_geodetic = ecef_to_geodetic(*candidate)
    terrain_elevation = dem.elevation_at(candidate_geodetic.longitude, candidate_geodetic.latitude)
    if terrain_elevation is None:
        return _not_ready(checks + [{"name": "terrain_intersection", "status": "unavailable", "reason": "dem_no_data"}], min_ray_angle)
    terrain_point = GeoPoint(candidate_geodetic.longitude, candidate_geodetic.latitude, terrain_elevation)
    terrain_ecef = geodetic_to_ecef(terrain_point)

    per_observation: list[dict[str, Any]] = []
    uncertainty_parts: list[float] = []
    residuals_valid = True
    for observation in prepared:
        to_target = _subtract(terrain_ecef, observation.origin)
        slant_distance = _dot(to_target, observation.direction)
        residual = _length(_subtract(to_target, _scale(observation.direction, slant_distance)))
        if slant_distance <= 0.0:
            residuals_valid = False
        if residual > options.max_residual_m:
            residuals_valid = False
        uncertainty_parts.append(_uncertainty(slant_distance, observation.ray_enu[2], observation.parsed["options"]))
        per_observation.append({
            "id": observation.identifier,
            "name": observation.name,
            "slantDistanceM": slant_distance,
            "residualM": residual,
            "targetPixel": {"x": observation.parsed["box"].select_pixel(observation.parsed["target_pixel_strategy"])[0], "y": observation.parsed["box"].select_pixel(observation.parsed["target_pixel_strategy"])[1]},
        })
    if not residuals_valid:
        return _not_ready(
            checks + [{"name": "geometry", "status": "unavailable", "reason": "observation_disagreement"}],
            min_ray_angle,
            per_observation,
        )

    max_residual = max(item["residualM"] for item in per_observation)
    base_uncertainty = sqrt(sum(value * value for value in uncertainty_parts) / len(uncertainty_parts))
    geometry_factor = 1.0 / max(0.1, _sin_degrees(min_ray_angle))
    uncertainty = sqrt(base_uncertainty * base_uncertainty + (max_residual * geometry_factor) ** 2)
    quality = "high" if min_ray_angle >= 35.0 and uncertainty <= 30.0 else "medium" if min_ray_angle >= 20.0 and uncertainty <= 80.0 else "low"
    return {
        "status": "ready",
        "checks": checks + [{"name": "geometry", "status": "available"}, {"name": "terrain_coverage", "status": "available"}],
        "location": {
            "longitude": terrain_point.longitude,
            "latitude": terrain_point.latitude,
            "elevationM": terrain_point.elevation_m,
            "horizontalUncertaintyM": uncertainty,
            "quality": quality,
            "minRayAngleDeg": min_ray_angle,
            "observations": per_observation,
        },
        "provenance": {"coordinateReference": "WGS84", "demDatasetId": dem.dataset_id},
    }


def _options_from(raw: Any) -> IntersectionOptions:
    if not isinstance(raw, dict):
        raise ValidationError("invalid_calculation_options")
    options = IntersectionOptions(
        min_ray_angle_deg=float(raw.get("minRayAngleDeg", 8.0)),
        max_residual_m=float(raw.get("maxResidualM", 80.0)),
    )
    options.validate()
    return options


def _not_ready(checks: list[dict[str, Any]], min_ray_angle: float | None = None, observations: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    location: dict[str, Any] | None = None
    if min_ray_angle is not None or observations:
        location = None
    return {"status": "not_ready", "checks": checks, "location": location, "quality": {"minRayAngleDeg": min_ray_angle, "observations": observations or []}}


def _best_fit_point(observations: list[PreparedObservation]) -> Vector | None:
    matrix = [[0.0, 0.0, 0.0] for _ in range(3)]
    vector = [0.0, 0.0, 0.0]
    for observation in observations:
        projector = [[(1.0 if row == column else 0.0) - observation.direction[row] * observation.direction[column] for column in range(3)] for row in range(3)]
        for row in range(3):
            for column in range(3):
                matrix[row][column] += projector[row][column]
            vector[row] += sum(projector[row][column] * observation.origin[column] for column in range(3))
    return _solve_3x3(matrix, vector)


def _solve_3x3(matrix: list[list[float]], vector: list[float]) -> Vector | None:
    augmented = [matrix[row][:] + [vector[row]] for row in range(3)]
    for column in range(3):
        pivot = max(range(column, 3), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-10:
            return None
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(3):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [augmented[row][entry] - factor * augmented[column][entry] for entry in range(4)]
    return augmented[0][3], augmented[1][3], augmented[2][3]


def _minimum_ray_angle(observations: list[PreparedObservation]) -> float:
    angles = []
    for index, first in enumerate(observations):
        for second in observations[index + 1:]:
            cosine = max(-1.0, min(1.0, _dot(first.direction, second.direction)))
            angles.append(degrees(acos(cosine)))
    return min(angles)


def _sin_degrees(angle: float) -> float:
    from math import radians, sin

    return sin(radians(angle))


def _dot(left: Vector, right: Vector) -> float:
    return sum(left[index] * right[index] for index in range(3))


def _subtract(left: Vector, right: Vector) -> Vector:
    return left[0] - right[0], left[1] - right[1], left[2] - right[2]


def _scale(vector: Vector, factor: float) -> Vector:
    return vector[0] * factor, vector[1] * factor, vector[2] * factor


def _length(vector: Vector) -> float:
    return sqrt(_dot(vector, vector))
