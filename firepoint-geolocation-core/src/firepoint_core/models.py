from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


class ValidationError(ValueError):
    """Raised when an observation cannot produce a safe geographic result."""


@dataclass(frozen=True)
class GeoPoint:
    longitude: float
    latitude: float
    elevation_m: float

    def validate(self) -> None:
        if not -180.0 <= self.longitude <= 180.0:
            raise ValidationError("invalid_longitude")
        if not -90.0 <= self.latitude <= 90.0:
            raise ValidationError("invalid_latitude")


@dataclass(frozen=True)
class ImageSize:
    width: int
    height: int

    def validate(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValidationError("invalid_image_dimensions")


@dataclass(frozen=True)
class BoundingBox:
    x: float
    y: float
    width: float
    height: float

    def validate(self, image: ImageSize) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValidationError("invalid_target_geometry")
        if self.x < 0 or self.y < 0 or self.x + self.width > image.width or self.y + self.height > image.height:
            raise ValidationError("invalid_target_geometry")

    def select_pixel(self, strategy: str) -> tuple[float, float]:
        if strategy == "bbox_center":
            return self.x + self.width / 2.0, self.y + self.height / 2.0
        if strategy == "smoke_bottom_center":
            return self.x + self.width / 2.0, self.y + self.height
        raise ValidationError("unsupported_target_pixel_strategy")


@dataclass(frozen=True)
class Camera:
    origin: GeoPoint
    horizontal_crs: str
    vertical_datum: str

    def validate(self) -> None:
        self.origin.validate()
        if self.horizontal_crs.upper() not in {"WGS84", "EPSG:4326"}:
            raise ValidationError("unconfigured_coordinate_reference")
        if not self.vertical_datum:
            raise ValidationError("unconfigured_vertical_datum")


@dataclass(frozen=True)
class Pose:
    azimuth_deg: float
    pitch_deg: float
    roll_deg: float = 0.0

    def validate(self) -> None:
        if not -90.0 <= self.pitch_deg <= 90.0:
            raise ValidationError("invalid_pitch")


@dataclass(frozen=True)
class Calibration:
    horizontal_fov_deg: float | None = None
    vertical_fov_deg: float | None = None
    fx_px: float | None = None
    fy_px: float | None = None
    cx_px: float | None = None
    cy_px: float | None = None

    def focal_pixels(self, image: ImageSize) -> tuple[float, float, float, float]:
        if self.fx_px and self.fy_px:
            return self.fx_px, self.fy_px, self.cx_px or image.width / 2.0, self.cy_px or image.height / 2.0
        if not self.horizontal_fov_deg or not self.vertical_fov_deg:
            raise ValidationError("uncalibrated_camera")
        if not 0.0 < self.horizontal_fov_deg < 180.0 or not 0.0 < self.vertical_fov_deg < 180.0:
            raise ValidationError("invalid_field_of_view")
        from math import radians, tan

        fx = image.width / (2.0 * tan(radians(self.horizontal_fov_deg) / 2.0))
        fy = image.height / (2.0 * tan(radians(self.vertical_fov_deg) / 2.0))
        return fx, fy, image.width / 2.0, image.height / 2.0


@dataclass(frozen=True)
class CalculationOptions:
    max_distance_m: float = 20_000.0
    step_m: float = 5.0
    position_error_m: float = 2.0
    angle_error_deg: float = 0.5
    dem_vertical_error_m: float = 5.0

    def validate(self) -> None:
        if self.max_distance_m <= 0 or self.step_m <= 0 or self.step_m > self.max_distance_m:
            raise ValidationError("invalid_search_parameters")


def required(mapping: dict[str, Any], key: str) -> Any:
    if key not in mapping:
        raise ValidationError(f"missing_{key}")
    return mapping[key]


def observation_from_dict(data: dict[str, Any]) -> dict[str, Any]:
    observation = required(data, "observation")
    image_data = required(observation, "image")
    image = ImageSize(width=int(required(image_data, "width")), height=int(required(image_data, "height")))
    box_data = required(observation, "targetBox")
    box = BoundingBox(**{key: float(required(box_data, key)) for key in ("x", "y", "width", "height")})
    camera_data = required(data, "camera")
    camera = Camera(
        origin=GeoPoint(
            longitude=float(required(camera_data, "longitude")),
            latitude=float(required(camera_data, "latitude")),
            elevation_m=float(required(camera_data, "absoluteElevationM")),
        ),
        horizontal_crs=str(required(camera_data, "horizontalCrs")),
        vertical_datum=str(required(camera_data, "verticalDatum")),
    )
    pose_data = required(data, "pose")
    pose = Pose(
        azimuth_deg=float(required(pose_data, "azimuthDeg")),
        pitch_deg=float(required(pose_data, "pitchDeg")),
        roll_deg=float(pose_data.get("rollDeg", 0.0)),
    )
    calibration_data = required(data, "calibration")
    calibration = Calibration(
        horizontal_fov_deg=_number_or_none(calibration_data.get("horizontalFovDeg")),
        vertical_fov_deg=_number_or_none(calibration_data.get("verticalFovDeg")),
        fx_px=_number_or_none(calibration_data.get("fxPx")),
        fy_px=_number_or_none(calibration_data.get("fyPx")),
        cx_px=_number_or_none(calibration_data.get("cxPx")),
        cy_px=_number_or_none(calibration_data.get("cyPx")),
    )
    options_data = data.get("calculation", {})
    options = CalculationOptions(
        max_distance_m=float(options_data.get("maxDistanceM", 20_000.0)),
        step_m=float(options_data.get("stepM", 5.0)),
        position_error_m=float(options_data.get("positionErrorM", 2.0)),
        angle_error_deg=float(options_data.get("angleErrorDeg", 0.5)),
        dem_vertical_error_m=float(options_data.get("demVerticalErrorM", 5.0)),
    )
    return {
        "id": str(observation.get("id", "unnamed-observation")),
        "captured_at": str(required(observation, "capturedAt")),
        "image": image,
        "box": box,
        "target_pixel_strategy": str(observation.get("targetPixelStrategy", "bbox_center")),
        "camera": camera,
        "pose": pose,
        "calibration": calibration,
        "options": options,
        "dem_config": required(data, "dem"),
    }


def _number_or_none(value: Any) -> float | None:
    return None if value is None else float(value)


def validate_capture_timestamp(value: str) -> None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValidationError("invalid_capture_timestamp") from error
    if parsed.tzinfo is None:
        raise ValidationError("missing_time_zone_configuration")
