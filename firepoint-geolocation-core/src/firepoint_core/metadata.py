from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path
from typing import Any


DJI_PATTERN = re.compile(rb"drone-dji:([A-Za-z0-9_]+)=\"([^\"]+)\"")


def extract_dji_xmp_tags(raw: bytes) -> dict[str, str]:
    return {key.decode("ascii"): value.decode("utf-8") for key, value in DJI_PATTERN.findall(raw)}


def inspect_image_metadata(path: str | Path) -> dict[str, Any]:
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("Image metadata inspection requires Pillow") from error
    path = Path(path)
    return _inspect_image(Image, path.read_bytes(), str(path))


def inspect_image_bytes(raw: bytes, filename: str = "uploaded-image") -> dict[str, Any]:
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError("Image metadata inspection requires Pillow") from error
    return _inspect_image(Image, raw, filename)


def _inspect_image(Image, raw: bytes, source: str) -> dict[str, Any]:
    with Image.open(BytesIO(raw)) as image:
        width, height = image.size
        exif = image.getexif()
        metadata: dict[str, Any] = {
            "path": source,
            "format": image.format,
            "width": width,
            "height": height,
            "make": exif.get(271),
            "model": exif.get(272),
            "datetime": exif.get(306),
            "provenance": "image_metadata",
        }
    tags = extract_dji_xmp_tags(raw)
    if tags:
        metadata["dji"] = tags
        exposure_time = tags.get("UTCAtExposure")
        if exposure_time:
            metadata["capturedAt"] = f"{exposure_time}Z" if not exposure_time.endswith("Z") else exposure_time
        for target, source in (("longitude", "GpsLongitude"), ("latitude", "GpsLatitude"), ("absoluteElevationM", "AbsoluteAltitude"), ("azimuthDeg", "GimbalYawDegree"), ("pitchDeg", "GimbalPitchDegree"), ("rollDeg", "GimbalRollDegree")):
            if source in tags:
                metadata[target] = float(tags[source])
    return metadata
