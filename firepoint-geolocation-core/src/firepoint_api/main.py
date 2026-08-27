from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from firepoint_core.metadata import inspect_image_bytes
from firepoint_core.multicamera import calculate_multicamera_intersection
from firepoint_core.pipeline import calculate_location

from .dem_sources import inspect_source, resolve_dem
from .settings import configured_dem_sources, cors_origin_regex, cors_origins

app = FastAPI(title="Fire-point Geolocation API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=cors_origin_regex(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    available = True
    for identifier in configured_dem_sources():
        try:
            sources.append(inspect_source(identifier))
        except (FileNotFoundError, KeyError, Exception) as error:
            available = False
            sources.append({"id": identifier, "available": False, "reason": str(error)})
    return {"status": "available" if available else "degraded", "demSources": sources}


@app.post("/api/v1/images/inspect")
async def inspect_image(image: Annotated[UploadFile, File(...)]) -> dict[str, Any]:
    return {"metadata": inspect_image_bytes(await image.read(), image.filename or "uploaded-image")}


@app.post("/api/v1/geolocations/calculate")
async def calculate(
    payload: Annotated[str, Form(...)],
    image: Annotated[UploadFile | None, File()] = None,
) -> JSONResponse:
    try:
        data = json.loads(payload)
        dem_source_id = str(data.pop("demSourceId"))
        data["dem"] = resolve_dem(dem_source_id)
    except (json.JSONDecodeError, KeyError, FileNotFoundError) as error:
        raise HTTPException(status_code=422, detail={"status": "not_ready", "reason": str(error)}) from error
    metadata = inspect_image_bytes(await image.read(), image.filename or "uploaded-image") if image else None
    result = calculate_location(data, metadata)
    return JSONResponse(status_code=200 if result["status"] == "ready" else 422, content=result)


@app.post("/api/v1/geolocations/intersect")
async def intersect(payload: Annotated[str, Form(...)]) -> JSONResponse:
    try:
        data = json.loads(payload)
        dem_source_id = str(data.pop("demSourceId"))
        data["dem"] = resolve_dem(dem_source_id)
    except (json.JSONDecodeError, KeyError, FileNotFoundError) as error:
        raise HTTPException(status_code=422, detail={"status": "not_ready", "reason": str(error)}) from error
    result = calculate_multicamera_intersection(data)
    return JSONResponse(status_code=200 if result["status"] == "ready" else 422, content=result)


@app.post("/api/v1/geometries/project")
async def project_geometry(payload: Annotated[str, Form(...)]) -> JSONResponse:
    """Project ordered image pixels to ordered WGS84 geometry coordinates."""
    try:
        data = json.loads(payload)
        pixels = data.pop("pixels")
        dem_source_id = str(data.pop("demSourceId"))
        if not isinstance(pixels, list) or not pixels:
            raise ValueError("pixels_required")
        data["dem"] = resolve_dem(dem_source_id)
    except (json.JSONDecodeError, KeyError, ValueError, FileNotFoundError) as error:
        raise HTTPException(status_code=422, detail={"status": "not_ready", "reason": str(error)}) from error
    coordinates = []
    for pixel in pixels:
        observation = data.setdefault("observation", {})
        observation["targetBox"] = {"x": pixel["x"] - 0.5, "y": pixel["y"] - 0.5, "width": 1, "height": 1}
        observation["targetPixelStrategy"] = "bbox_center"
        result = calculate_location(data)
        if result["status"] != "ready":
            return JSONResponse(status_code=422, content=result)
        location = result["location"]
        coordinates.append(
            {
                "longitude": location["longitude"],
                "latitude": location["latitude"],
                "elevationM": location["elevationM"],
                "slantDistanceM": location["slantDistanceM"],
                "horizontalUncertaintyM": location["horizontalUncertaintyM"],
            }
        )
    return JSONResponse(content={"status": "ready", "geometryType": data.get("geometryType", "point"), "coordinates": coordinates})


def run() -> None:
    import uvicorn

    uvicorn.run("firepoint_api.main:app", host="0.0.0.0", port=8990, reload=True)
