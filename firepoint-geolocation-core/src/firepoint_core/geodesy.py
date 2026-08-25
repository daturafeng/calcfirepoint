from __future__ import annotations

from math import atan2, cos, degrees, radians, sin, sqrt

from .models import GeoPoint

WGS84_A = 6_378_137.0
WGS84_F = 1 / 298.257223563
WGS84_E2 = WGS84_F * (2.0 - WGS84_F)


def geodetic_to_ecef(point: GeoPoint) -> tuple[float, float, float]:
    lat, lon = radians(point.latitude), radians(point.longitude)
    sin_lat, cos_lat = sin(lat), cos(lat)
    n = WGS84_A / sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    return (
        (n + point.elevation_m) * cos_lat * cos(lon),
        (n + point.elevation_m) * cos_lat * sin(lon),
        (n * (1.0 - WGS84_E2) + point.elevation_m) * sin_lat,
    )


def ecef_to_geodetic(x: float, y: float, z: float) -> GeoPoint:
    longitude = atan2(y, x)
    p = sqrt(x * x + y * y)
    latitude = atan2(z, p * (1.0 - WGS84_E2))
    for _ in range(10):
        sin_lat = sin(latitude)
        n = WGS84_A / sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
        elevation = p / cos(latitude) - n
        next_latitude = atan2(z, p * (1.0 - WGS84_E2 * n / (n + elevation)))
        if abs(next_latitude - latitude) < 1e-13:
            latitude = next_latitude
            break
        latitude = next_latitude
    sin_lat = sin(latitude)
    n = WGS84_A / sqrt(1.0 - WGS84_E2 * sin_lat * sin_lat)
    elevation = p / cos(latitude) - n
    return GeoPoint(longitude=degrees(longitude), latitude=degrees(latitude), elevation_m=elevation)


def enu_basis(origin: GeoPoint) -> tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]:
    lat, lon = radians(origin.latitude), radians(origin.longitude)
    east = (-sin(lon), cos(lon), 0.0)
    north = (-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat))
    up = (cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat))
    return east, north, up


def enu_to_ecef_vector(vector: tuple[float, float, float], origin: GeoPoint) -> tuple[float, float, float]:
    east, north, up = enu_basis(origin)
    return tuple(vector[0] * east[i] + vector[1] * north[i] + vector[2] * up[i] for i in range(3))


def add_scaled(origin: tuple[float, float, float], direction: tuple[float, float, float], distance_m: float) -> tuple[float, float, float]:
    return tuple(origin[i] + direction[i] * distance_m for i in range(3))


def normalize(vector: tuple[float, float, float]) -> tuple[float, float, float]:
    length = sqrt(sum(component * component for component in vector))
    if length == 0:
        raise ValueError("zero_length_vector")
    return tuple(component / length for component in vector)


def cross(left: tuple[float, float, float], right: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    )
