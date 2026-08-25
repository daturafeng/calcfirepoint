from __future__ import annotations

from math import cos, radians, sin

from .geodesy import cross, normalize
from .models import Calibration, ImageSize, Pose


def pixel_to_camera_ray(pixel: tuple[float, float], image: ImageSize, calibration: Calibration) -> tuple[float, float, float]:
    fx, fy, cx, cy = calibration.focal_pixels(image)
    return normalize(((pixel[0] - cx) / fx, (pixel[1] - cy) / fy, 1.0))


def camera_ray_to_enu(camera_ray: tuple[float, float, float], pose: Pose) -> tuple[float, float, float]:
    yaw, pitch, roll = radians(pose.azimuth_deg), radians(pose.pitch_deg), radians(pose.roll_deg)
    forward = (sin(yaw) * cos(pitch), cos(yaw) * cos(pitch), sin(pitch))
    right = (cos(yaw), -sin(yaw), 0.0)
    down = cross(forward, right)
    right_rolled = tuple(right[i] * cos(roll) + down[i] * sin(roll) for i in range(3))
    down_rolled = tuple(down[i] * cos(roll) - right[i] * sin(roll) for i in range(3))
    enu = tuple(
        camera_ray[0] * right_rolled[i] + camera_ray[1] * down_rolled[i] + camera_ray[2] * forward[i]
        for i in range(3)
    )
    return normalize(enu)
