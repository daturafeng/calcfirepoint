## 1. Data-source confirmation

- [ ] 1.1 Confirm the horizontal CRS of every camera-inventory coordinate and the vertical datum used by the selected DEM.
- [ ] 1.2 Identify and document the authoritative historical PTZ telemetry source, including device identifier, timestamp, azimuth, pitch, zoom, units, and axis convention.
- [ ] 1.3 Confirm alarm/export, image-overlay, and PTZ-telemetry time zones; define the configured matching tolerance.
- [ ] 1.4 Obtain each camera's model, sensor/image dimensions, calibration data or calibrated field-of-view profiles, lens distortion, and installation axis offsets.
- [ ] 1.5 Select a versioned DEM that covers all camera locations and expected monitoring ranges; document resolution and no-data behavior.
- [ ] 1.6 Define the operational accuracy threshold, maximum valid range, and treatment of smoke-plume versus thermal targets.

## 2. Data model and readiness capability

- [x] 2.0 Set up the Python core package, JSON command-line entry point, and reproducible development dependencies.
- [ ] 2.1 Create versioned camera-inventory, calibration-profile, terrain-dataset, PTZ-pose, alarm-observation, and calculation-result schemas.
- [ ] 2.2 Implement camera-name/device-ID matching from alarm exports to the camera inventory.
- [ ] 2.3 Implement timestamp normalization and PTZ association with explicit freshness and provenance reporting.
- [ ] 2.4 Implement readiness checks and machine-readable `ready` / `not_ready` reasons defined by `camera-observation-readiness`.

## 3. Geolocation calculation

- [x] 3.0 Implement metadata inspection for supported DJI images, retaining image metadata as non-authoritative provenance.
- [x] 3.1 Implement bounding-box target-pixel selection, defaulting to `bbox_center`, with configured smoke and thermal alternatives.
- [ ] 3.2 Implement image undistortion and pixel-to-ray conversion for calibrated camera/zoom profiles.
- [x] 3.3 Implement camera-pose transformation into a local ENU frame with explicit CRS conversion.
- [x] 3.4 Implement DEM ray intersection, no-data handling, range limits, and conversion to the configured output CRS.
- [ ] 3.5 Implement uncertainty estimation and complete result provenance.

## 4. Interfaces and operations

- [x] 4.1 Add rasterio-based GeoTIFF DEM reading, metadata validation, and configured local DEM source registration.
- [x] 4.2 Expose health, metadata-inspection, readiness, and fire-point-location FastAPI endpoints with typed success, warning, and failure responses.
- [x] 4.3 Build the React/Cesium operator workspace with the dock-compatible imagery and terrain configuration.
- [x] 4.4 Add map presentation of target point, uncertainty area, camera-to-target ray, and missing-data diagnostics.
- [ ] 4.5 Transplant the dock Cesium viewer bootstrap and imagery/terrain resource adapter into the standalone Vite frontend.
- [ ] 4.6 Add configuration workflows for camera inventory, calibration profiles, coordinate references, PTZ integrations, and DEM versions.
  - [x] 4.6.1 Add a committed project-local JSON configuration file for named DEM sources and load it without a dotenv dependency.
- [x] 4.7 Build the image-annotation page with point, line, polygon, undo, and clear interactions.
- [x] 4.8 Add multi-pixel geometry projection and Cesium geometry synchronization.
- [x] 4.9 Allow local loopback CORS origins for both localhost and 127.0.0.1, including Vite-selected ports.
- [x] 4.10 Redesign the single-point workspace as a balanced responsive left-control/right-map operator view.
- [x] 4.11 Render the editable target box and centre marker on the observation image preview.
- [x] 4.12 Add Ant Design and migrate single-point navigation, observation form, and result feedback to its component system.
- [x] 4.13 Hydrate valid DJI image metadata into observation inputs and compact the image-selection control.
- [x] 4.14 Render projected image geometries through the migrated Cesium annotation engine; record the engine-first annotation rule.
- [x] 4.15 Return and display geometry-projection distance and uncertainty metrics.
- [x] 4.16 Replace source-image SVG drawing with a Fabric canvas preview for points, lines, and polygons.
- [x] 4.17 Configure Fabric's optional Node canvas dependency as intentionally not built for the browser-only frontend.
- [x] 4.18 Preserve Fabric source-image aspect ratio and convert display click coordinates back to original pixels.
- [x] 4.19 Compact the desktop header, remove outer scrolling, make result overlays translucent, simplify the target marker, and add single-point large-image preview.
- [x] 4.20 Use a single non-nested large-image preview and make image annotation a three-column independent-metadata workspace.
- [x] 4.21 Apply the established control-panel scrollbar style to the annotation metadata column.
- [x] 4.22 Keep the Fabric source image stable while only annotation geometry redraws during drawing.
- [x] 4.23 Fly to the active camera pose only after image switches, with explicit pose recall and map hover coordinates.
- [x] 4.24 Keep map markers stable during hover updates and preview the first line/polygon vertex in Fabric.
- [x] 4.25 Move non-critical image and drawing operation guidance into accessible Ant Design hover/focus tooltips.
- [x] 4.26 Add Fabric two-click rectangle drawing to the single-point large preview and explicitly apply its original-pixel bounding box to the form.
- [x] 4.27 Make the single-point rectangle editor a dominant-image left/right modal and retain pixel alignment after layout sizing.
- [x] 4.28 Align Fabric pointer/overlay mapping to the actual canvas dimensions and preserve the first rectangle corner marker.
- [x] 4.29 Keep the pending rectangle and first-corner marker in one atomic Fabric selection state.
- [x] 4.30 Render Fabric target rectangles with an explicit left/top origin matching target-box coordinates.

## 5. Verification and rollout

- [ ] 5.1 Create deterministic unit tests for target-pixel selection, time normalization, coordinate transformations, and invalid-input handling.
- [ ] 5.2 Build a labelled validation set of known camera/target locations and measure error by distance, zoom, terrain, and imagery type.
- [ ] 5.3 Run shadow-mode evaluation against manually verified incidents and tune uncertainty thresholds.
- [ ] 5.4 Document operating limits, calibration procedures, and incident-user interpretation of uncertainty.
- [ ] 5.5 Validate the completed OpenSpec change, synchronize final specifications, and archive only after accepted verification results.
