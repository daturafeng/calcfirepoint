## Why

The current fire-alarm exports contain identifiable target boxes and camera installation coordinates, but do not yet produce a defensible ground location for an alarm. Operations need each alarm image to be traceable to a calculated fire-point longitude, latitude, estimated elevation, and uncertainty after the necessary PTZ and terrain inputs are available.

## What Changes

- Define a fire-point geolocation workflow that associates an alarm image with its camera and the camera pose at capture time.
- Define validation for the required camera, PTZ, image-target, coordinate-reference, and terrain-elevation inputs.
- Define default target-pixel selection from an algorithm-produced bounding box, with source-specific alternatives for smoke and thermal imagery.
- Define a terrain-ray intersection result that includes coordinates, distance, uncertainty, provenance, and failure reasons.
- Define time-zone normalization so image overlays, alarm records, and PTZ telemetry resolve to the same instant.
- Define configuration and calibration requirements without beginning implementation in this change.
- Provide a Python HTTP API that accepts an alarm image and explicit geolocation inputs, returning the same typed readiness or location result as the core calculator.
- Provide a React/Cesium operator interface to upload an image, enter or inspect inputs, calculate a result, and review the camera, ray, uncertainty, and fire-point location on a map.
- Support a configured local GeoTIFF DEM now and configured network-backed DEM sources later, without making the source path part of the browser contract.

## Capabilities

### New Capabilities

- `firepoint-geolocation`: Calculate and report a terrain-referenced fire-point location from an alarm target and synchronized PTZ camera data.
- `camera-observation-readiness`: Validate and expose the readiness of camera configuration, telemetry, target pixels, and terrain data required for geolocation.
- `firepoint-geolocation-api`: Expose the core calculation through a typed HTTP interface with controlled image upload and configured DEM sources.
- `firepoint-geolocation-map`: Provide an accessible React/Cesium workspace for entering observations and reviewing geolocation results on the configured imagery and terrain map.

### Modified Capabilities

None.

## Impact

- Future backend geolocation API, camera/PTZ telemetry integration, and DEM data access.
- Camera inventory and calibration/configuration management.
- Alarm-image ingestion and target-detection output schema.
- Map-based alarm presentation, including uncertainty and diagnostic status.
- Python FastAPI runtime and a standalone React/Cesium frontend.
