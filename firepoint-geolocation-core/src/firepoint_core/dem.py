from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


class ElevationDem(Protocol):
    dataset_id: str

    def elevation_at(self, longitude: float, latitude: float) -> float | None: ...


@dataclass(frozen=True)
class ConstantDem:
    elevation_m: float
    dataset_id: str = "constant-dem"

    def elevation_at(self, longitude: float, latitude: float) -> float | None:
        return self.elevation_m


@dataclass(frozen=True)
class RegularGridDem:
    origin_longitude: float
    origin_latitude: float
    longitude_step_deg: float
    latitude_step_deg: float
    elevations_m: list[list[float | None]]
    dataset_id: str = "grid-dem"

    def elevation_at(self, longitude: float, latitude: float) -> float | None:
        if self.longitude_step_deg == 0 or self.latitude_step_deg == 0 or len(self.elevations_m) < 2 or len(self.elevations_m[0]) < 2:
            return None
        column = (longitude - self.origin_longitude) / self.longitude_step_deg
        row = (latitude - self.origin_latitude) / self.latitude_step_deg
        left, top = int(column // 1), int(row // 1)
        if left < 0 or top < 0 or top + 1 >= len(self.elevations_m) or left + 1 >= len(self.elevations_m[0]):
            return None
        weights = (column - left, row - top)
        values = (
            self.elevations_m[top][left], self.elevations_m[top][left + 1],
            self.elevations_m[top + 1][left], self.elevations_m[top + 1][left + 1],
        )
        if any(value is None for value in values):
            return None
        dx, dy = weights
        top_value = float(values[0]) * (1 - dx) + float(values[1]) * dx
        bottom_value = float(values[2]) * (1 - dx) + float(values[3]) * dx
        return top_value * (1 - dy) + bottom_value * dy


@dataclass(frozen=True)
class GeoTiffDem:
    path: str
    dataset_id: str

    def elevation_at(self, longitude: float, latitude: float) -> float | None:
        try:
            import rasterio
            from rasterio.warp import transform
        except ImportError as error:
            raise RuntimeError("GeoTIFF DEM support requires the 'geotiff' extra") from error
        with rasterio.open(self.path) as dataset:
            x, y = longitude, latitude
            if dataset.crs and dataset.crs.to_epsg() != 4326:
                x, y = transform("EPSG:4326", dataset.crs, [longitude], [latitude])
                x, y = x[0], y[0]
            value = next(dataset.sample([(x, y)]))[0]
            if dataset.nodata is not None and value == dataset.nodata:
                return None
            return float(value)


def dem_from_config(config: dict) -> ElevationDem:
    kind = config.get("kind")
    if kind == "constant":
        return ConstantDem(float(config["elevationM"]), str(config.get("datasetId", "constant-dem")))
    if kind == "grid":
        return RegularGridDem(
            origin_longitude=float(config["originLongitude"]),
            origin_latitude=float(config["originLatitude"]),
            longitude_step_deg=float(config["longitudeStepDeg"]),
            latitude_step_deg=float(config["latitudeStepDeg"]),
            elevations_m=config["elevationsM"],
            dataset_id=str(config.get("datasetId", "grid-dem")),
        )
    if kind == "geotiff":
        return GeoTiffDem(path=str(config["path"]), dataset_id=str(config.get("datasetId", Path(str(config["path"])).name)))
    raise ValueError("unsupported_dem_kind")
