from __future__ import annotations

from functools import lru_cache
from typing import Any

import rasterio

from .settings import DemSource, configured_dem_sources


@lru_cache(maxsize=8)
def inspect_source(identifier: str) -> dict[str, Any]:
    source = configured_dem_sources().get(identifier)
    if not source:
        raise KeyError("unknown_dem_source")
    if not source.path.is_file():
        raise FileNotFoundError("dem_source_unavailable")
    with rasterio.open(source.path) as raster:
        return {
            "id": identifier,
            "path": str(source.path),
            "available": True,
            "crs": str(raster.crs),
            "width": raster.width,
            "height": raster.height,
            "bounds": {"west": raster.bounds.left, "south": raster.bounds.bottom, "east": raster.bounds.right, "north": raster.bounds.top},
            "resolution": {"x": raster.res[0], "y": raster.res[1]},
            "nodata": raster.nodata,
            "verticalDatum": source.vertical_datum,
        }


def resolve_dem(identifier: str) -> dict[str, Any]:
    source = configured_dem_sources().get(identifier)
    if not source:
        raise KeyError("unknown_dem_source")
    details = inspect_source(identifier)
    return {"kind": "geotiff", "path": str(source.path), "datasetId": identifier, "verticalDatum": source.vertical_datum, "metadata": details}
