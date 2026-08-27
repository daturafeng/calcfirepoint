## Why

Single-camera terrain intersections become increasingly sensitive to camera pose, calibration, target-pixel, and terrain errors as the optical axis approaches the horizon. Operators need a way to combine independent image observations of the same fire point, assess their agreement, and use the resulting intersection with an auditable confidence measure.

## What Changes

- Add a server-side multi-camera intersection calculation that converts validated image observations into local ENU rays and determines the best-fit three-dimensional point shared by at least two cameras.
- Add readiness checks, residual diagnostics, and an uncertainty estimate that communicate weak camera geometry, incompatible observations, and failed intersections without presenting an actionable coordinate.
- Add a Multi-camera Intersection workspace with an observation table and an add/edit modal. Operators can select an image, inspect and edit its camera position, PTZ pose, calibration, and target box, and draw the target rectangle in an image preview before saving.
- Render all participating cameras, viewing rays, the calculated intersection, and its uncertainty on the existing Cesium map.

## Capabilities

### New Capabilities

- `multicamera-firepoint-intersection`: Validate multiple camera observations and calculate a traceable best-fit spatial fire point with quality diagnostics.
- `multicamera-intersection-workspace`: Provide an operator workspace for managing image observations, configuring each camera, drawing target boxes, and reviewing multi-camera results on the map.
- `multicamera-intersection-api`: Expose the validated multi-camera intersection contract through the existing typed API boundary.

### Modified Capabilities

- None.

## Impact

- Python calculation core, API request/response models and routes, and calculation tests.
- React TypeScript API client, app navigation, observation-modal UI, image rectangle editor reuse, Cesium result overlays, and frontend styles.
- No new third-party dependency is required; the implementation reuses the existing Fabric, Ant Design, and Cesium capabilities.
