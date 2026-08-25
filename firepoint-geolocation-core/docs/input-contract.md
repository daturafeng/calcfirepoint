# Input contract

The CLI reads one JSON document. Explicit JSON values always override optional
values discovered in the image metadata supplied through `--image`.

```json
{
  "observation": {
    "id": "demo-001",
    "capturedAt": "2026-06-22T03:11:26.708152Z",
    "imageryType": "visible",
    "image": { "width": 4032, "height": 3024 },
    "targetBox": { "x": 1966, "y": 1462, "width": 100, "height": 100 },
    "targetPixelStrategy": "bbox_center"
  },
  "camera": {
    "longitude": 106.586110015,
    "latitude": 29.595824927,
    "absoluteElevationM": 348.71,
    "horizontalCrs": "WGS84",
    "verticalDatum": "ellipsoidal"
  },
  "pose": { "azimuthDeg": -45.2, "pitchDeg": -45.0, "rollDeg": 0.0 },
  "calibration": { "horizontalFovDeg": 84.0, "verticalFovDeg": 65.5 },
  "dem": { "kind": "constant", "elevationM": 280.2 },
  "calculation": { "maxDistanceM": 500.0, "stepM": 2.0 }
}
```

Angles use degrees. Azimuth is clockwise from true north; pitch is positive
above the horizon and negative below it. The output coordinate reference is
always WGS84 with the same height datum as the input DEM.
