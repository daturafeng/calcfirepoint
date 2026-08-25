# Fire-point geolocation core

This project calculates the terrain intersection of a pixel viewing ray. It is
the algorithm core only: it has no web service, map UI, PTZ integration, or
alarm-detection model.

## Input and output

The command accepts a JSON observation with:

- image dimensions and an algorithm target box;
- camera longitude, latitude, and absolute elevation;
- north-referenced azimuth, pitch, and roll;
- camera intrinsics or horizontal/vertical field of view;
- a DEM definition (constant elevation, JSON grid, or optional GeoTIFF).

It returns a JSON readiness report and, when ready, WGS84 longitude, latitude,
terrain elevation, slant distance, uncertainty estimate, and provenance.

The algorithm uses the target-box centre by default. Use `smoke_bottom_center`
only when the box represents an airborne smoke plume and the bottom edge is a
better terrain proxy.

## Quick start

From this directory:

```powershell
$env:PYTHONPATH = "src"
python -m firepoint_core --input examples/dji_m4td_demo.json
```

To inspect metadata from a DJI image while keeping explicit JSON values as the
calculation source:

```powershell
python -m firepoint_core --input examples/dji_m4td_demo.json --image "C:\path\to\image.jpg"
```

`examples/dji_m4td_demo.json` uses a simulated flat DEM. It is a geometry
verification fixture, not a real fire-point result.

## DEM support

- `constant`: only for tests and controlled demos.
- `grid`: regular WGS84 longitude/latitude grid with bilinear interpolation.
- `geotiff`: optional; install the `geotiff` extra and provide a WGS84 GeoTIFF.

All camera and DEM heights must use the same vertical datum. The core rejects
missing or unsupported coordinate-reference information rather than inventing a
coordinate.

## Validation

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests -v
```
