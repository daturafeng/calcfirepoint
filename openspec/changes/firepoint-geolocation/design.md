## Context

See `proposal.md` for the motivation. The supplied alarm export associates images with camera names; the camera inventory supplies fixed longitude, latitude, and installation height for the four observed cameras. The JPEG files contain no usable EXIF camera pose or calibration metadata, and image-overlay time differs from the alarm-export time by eight hours. The future system therefore needs authoritative configuration, telemetry, and terrain sources rather than inference from the exported JPEG alone.

## Goals / Non-Goals

**Goals:**

- Produce a repeatable single-camera terrain-intersection calculation with auditable inputs and a numerical uncertainty estimate.
- Keep alarm detection, camera inventory, PTZ telemetry, calibration, DEM access, calculation, and map presentation separable.
- Prevent a coordinate from being presented when the inputs are incomplete or ambiguous.

**Non-Goals:**

- Infer PTZ pose, focal length, or camera coordinates from image content alone.
- Determine the exact ignition source from the centre of an airborne smoke plume.
- Replace the existing smoke/fire-detection algorithm or provide dispatch workflow automation in this change.
- Promise survey-grade accuracy from a single image.

## Decisions

### Implement the first core as a Python package with a JSON command-line boundary

The first deliverable will be a Python package that accepts a JSON observation and DEM definition, then emits a JSON readiness report and calculation result. It will use Pillow to inspect JPEG EXIF/XMP metadata, `pyproj` for geodetic transformations, and `rasterio`/GDAL for production GeoTIFF DEM access. The initial demo will additionally provide a constant-elevation DEM fixture so the supplied DJI image can validate the core without downloading external terrain data. A service or user interface is deferred until the pure calculation contract is verified.

Alternative considered: begin with a browser or full web-service application. Rejected because it makes the ray/terrain mathematics and GIS dependencies harder to verify independently.

### Add a FastAPI boundary after the core contract

The API will be a separate Python application package that calls the existing core rather than duplicating geometry. The browser will submit a multipart request containing an optional image and JSON payload. DEMs will be resolved by a configured source ID, initially mapping `chongqing-nanan` to the supplied local GeoTIFF. This keeps server file-system and future network credentials out of the browser contract.

Alternative considered: let the browser submit local DEM paths or URLs. Rejected because browser values cannot safely control server file or network access.

### Load local server settings from a committed JSON file

The backend will load `firepoint-geolocation-core/config.json` before constructing configured DEM sources. The file contains named DEM sources with a path and vertical datum, plus optional CORS settings. It is intentionally committed for this local, user-managed deployment because its paths are not considered sensitive; browser clients continue to send only a configured DEM source identifier. The backend uses the Python standard library JSON parser, with no dotenv package or shell environment setup.

Alternative considered: keep configuration solely in shell environment variables or a `.env` file. Rejected because a structured JSON file is easier to inspect, supports multiple named DEM sources, and avoids an additional configuration format.

### Build a standalone React/Cesium operator workspace

The frontend will use React, TypeScript, Vite, and Cesium. It will use `VITE_CESIUM_IMAGERY_URL`, `VITE_CESIUM_VECTOR_IMAGERY_URL`, and `VITE_CESIUM_TERRAIN_URL` configuration with the same default service pattern used in `D:\WebCode\dock\dock-fe`. The UI will keep form state local, use a typed API client, and avoid runtime mock fallbacks. Cesium owns only the map lifecycle and receives derived camera/result state from React.

The implementation will copy the dock frontend's complete `src/utils/cesium` directory into the standalone Vite project, then add a local compatibility boundary for dock-specific aliases and cloud-service dependencies. This preserves the verified viewer bootstrap, interaction limits, imagery layering, terrain fallback, drawing, annotation, and resource-management capabilities for subsequent integration.

Alternative considered: modify the existing dock frontend directly. Rejected because this project is currently independent and the user requested a separately organised project.

### Permit both loopback hostname forms during development

The FastAPI CORS policy will accept `localhost` and `127.0.0.1` loopback origins with an optional port, so a Vite port shift does not break local API requests. Deployment-specific origins remain configurable with environment variables; this does not create a permissive cross-origin policy for non-loopback hosts.

### Use a compact two-column workstation on desktop

The main calculation page will reserve a scrollable, fixed-width control rail at the left and assign the remaining width to the map and result overlay. The design uses one dark visual system with restrained cyan and amber status accents, compact labels, grouped form sections, and consistent radii. At narrow widths it collapses to a vertical layout.

The desktop document is viewport-locked: the workspace computes its content height below a compact header, while only the input rail may scroll internally when necessary. Result panels use a lower-alpha glass surface rather than an opaque card. The source-image target indicator uses a centre dot and horizontal guide only; its vertical guide is intentionally omitted.

### Overlay the target-box centre on image previews

The single-point image preview will use an SVG overlay whose view box is the original image size. The visible target box and its centre marker are therefore derived from the same editable `x`, `y`, `width`, and `height` values sent to the API, without a second coordinate conversion or an image-display scaling error.

### Adopt Ant Design for operator controls

The standalone frontend will add Ant Design and its icon package. Page-level React composition and custom map/image geometry components remain local; Ant Design supplies the stable controls, feedback, form layout, tabs, and result descriptions. This gives the workspace a cohesive interaction system without replacing the Cesium integration.

The existing Ant Design `Tooltip` component is the preferred presentation for non-critical operation guidance. It is attached to keyboard-focusable icon controls or the interactive image preview, reducing persistent page chrome without hiding result, failure, or validation content.

### Make the migrated Cesium engine the first annotation dependency

Map-space annotations use the copied engine's `CesiumAnnotationGeometryManager` for persistent point, route, and polygon presentation. The engine's `Draw` class remains the interaction-session dependency for future direct-on-map drawing. The source-image panel keeps a small SVG pixel overlay because the engine has no image-pixel-coordinate drawing capability; it only creates pixels sent to the projection API. New map annotation work must reuse the engine first and document any missing capability before adding a local extension.

### Use Fabric for source-image pixel drawing

The source-image canvas will use Fabric for interactive point, line, and polygon preview because the migrated Cesium engine does not expose image-pixel-coordinate drawing. Fabric owns only the left image canvas and returns original-image pixel coordinates; Cesium continues to own geographic geometry rendering. The projection API returns full calculation metrics per vertex so the annotation page can show a location-complete result overlay.

Fabric's optional Node `canvas` package is not required by this browser-only Vite application. The package-manager build allowlist explicitly rejects that native build while continuing to allow the existing browser tooling builds.

The Fabric canvas computes one fit scale from the available panel size and the original image dimensions. Background imagery and preview objects are scaled to that display size; pointer locations are divided by the same scale before being retained and sent to the projection API. This prevents both image stretching and incorrect ground-location offsets caused by display-space pixels.

The selected image is rendered once as the stable CSS background of the fitted image frame. Fabric owns a transparent canvas above that frame and clears/redraws only geometry objects as the drawing state changes. This prevents the asynchronous source-image reload that otherwise visibly blanks the left panel for each click, while retaining the same displayed-to-original pixel scale.

Fabric's active line and polygon previews render their vertex handles independently of whether there are enough vertices to create a polyline or polygon. Therefore, the first click is immediately visible and subsequent clicks extend the preview geometry.

The single-point large-image preview reuses this same Fabric component rather than introducing a second image coordinate system. Fabric supplies rectangle primitives, but the existing shared canvas only supported vertex clicks; it is extended with a two-click rectangle interaction. The first click stores the start corner, pointer movement previews the second corner, and the next click commits it; both displayed corners are converted through the existing fit scale. A small local pure transformation floors the origin, uses a one-pixel minimum width/height for a zero-span selection, and clamps the result to the decoded image bounds before the operator explicitly applies it to the form.

The Fabric render path maps source pixels to the canvas with its actual post-layout width and height, and reverses pointer coordinates using those same dimensions instead of a theoretical pre-rounding scale. While the second corner is pending, a marker renders at the first selected corner separately from the normalised rectangle; this makes the fixed first click unambiguous when the pointer crosses above or left of it.

The pending target rectangle and its first-corner marker are represented as one selection object owned by the rectangle editor, rather than separate local-canvas and parent callback states. Each Fabric event emits that single object, preventing React scheduling from rendering a new anchor against a stale rectangle.

Fabric 7 rectangle objects are rendered with centre origins unless explicitly configured. The rectangle overlay therefore sets `originX: 'left'` and `originY: 'top'`, matching the target-box contract where `x` and `y` are the normalised upper-left pixel coordinate.

The rectangle editor modal uses an explicit two-column layout: the left source-image canvas flexes to fill the modal and the right sidebar holds the computed pixel values and actions. It overrides the legacy centred preview-body rule, so the Fabric host receives its real available size; its existing `ResizeObserver` recalculates the one fit scale after layout, keeping the rectangle and source image aligned.

The annotation workspace owns its own image, decoded dimensions, metadata result, and editable observation form state. It initialises its values from the single-point defaults only as a convenience; subsequently, selecting an annotation image hydrates and updates annotation-local values without affecting the single-point workspace. Its three columns are metadata inputs, Fabric pixel drawing, and Cesium geographic output. This prevents annotation image selections from using stale pose parameters while preserving two independent workflows.

### Preserve map view after an explicit image-switch camera flight

The migrated Cesium engine supplies the `Viewer`, normal camera operations, and map-space annotation managers but does not supply a ready-made camera-pose recall control or a pointer-coordinate footer for this standalone workspace. `MapCanvas` therefore uses Cesium's native `camera.flyTo` and `ScreenSpaceEventHandler` at the presentation boundary: a monotonically increasing image-switch request triggers exactly one flight to the active camera longitude, latitude, elevation, yaw/heading, pitch, and roll. Overlay updates intentionally do not issue camera commands, so a user-adjusted view remains fixed. A local right-bottom control reissues the same camera-pose flight only on explicit user action, and the footer uses terrain/ellipsoid picking to show pointer longitude/latitude plus current view height.

Pointer feedback is local React state and must not cause unchanged Cesium overlay inputs to receive a new collection reference. The map uses a module-level immutable empty geometry collection when none is supplied, so hover updates do not clear/recreate the existing camera or fire-point entities.

### Prefer mature capabilities after explicit analysis

Before adding a new implementation, analyse the migrated engine, installed libraries, and available plugins or integrations. Prefer a supported existing capability when it satisfies the requirement; only implement locally after recording why the capability is missing or unsuitable in OpenSpec.

### Apply valid image metadata without erasing defaults

Image inspection returns recognised DJI UTC exposure time, longitude, latitude, absolute elevation, gimbal yaw, pitch, and roll fields. The frontend updates only an explicitly timezone-qualified timestamp and finite numeric values for those keys; any absent or invalid image property leaves the existing default input untouched. Image dimensions are also applied from the browser's decoded image, independently of metadata.

### Use a local ENU calculation frame and explicit CRS transformations

The calculator will transform the configured camera origin to a local east-north-up (ENU) frame, construct and intersect the ray in metres, then transform the solution to the configured output CRS. This avoids applying Euclidean ray geometry directly to longitude/latitude degrees and makes distances and uncertainty understandable.

Alternative considered: calculate directly in WGS84 longitude/latitude. Rejected because angular units and local terrain distances are not interchangeable.

### Separate static camera configuration from per-alarm observations

Static inventory data will hold camera identifier, coordinate reference, mount height, axis-alignment offsets, and calibration profiles. Each alarm observation will hold the image dimensions, detected box, source time, normalized UTC instant, PTZ pose, and selected target pixel. This allows calibration updates to be versioned and lets historical results state exactly which configuration was used.

Alternative considered: store all fields only in an alarm record. Rejected because fixed data would be duplicated and historical provenance would be harder to audit.

### Treat bounding-box centre as the default observation point

For the current algorithm output, the default pixel is the supplied target-box centre. Smoke and thermal strategies remain explicit configuration options: smoke can use the bottom centre when the detection represents a plume, and thermal sources can provide their hottest pixel. The selected strategy must remain in the output provenance.

Alternative considered: always use the smoke-box centre. Rejected because it can be materially displaced above the ground source.

### Obtain pose from synchronized PTZ telemetry

The integration boundary will request north-referenced azimuth, pitch, and zoom/focal information for the normalized alarm instant. A configurable freshness interval governs direct matches; any interpolation or stale sample is surfaced in the result and uncertainty.

Alternative considered: read the on-screen timestamp and infer direction from visible landmarks. Rejected as non-repeatable and not suitable for automated incident coordinates.

### Model each calibrated zoom profile explicitly

The calculator will use intrinsic matrix and distortion parameters when supplied; otherwise it will use calibrated horizontal/vertical field-of-view values for the active zoom profile. PTZ axis conventions and fixed camera offsets are part of this calibration record.

Alternative considered: assume a constant field of view for all images. Rejected because PTZ zoom changes the pixel-to-angle conversion substantially.

### Intersect the view ray with a versioned DEM

The calculator will sample a DEM along the ENU ray and numerically solve for the first valid terrain crossing within a configured range. It will return no coordinate on data gaps or no intersection. Terrain and camera vertical references must be compatible before use.

Alternative considered: assume a flat ground plane. Rejected because the observed terrain is mountainous and would introduce large errors.

### Estimate and expose uncertainty

The result will combine configurable errors for camera position, elevation, PTZ azimuth/pitch, focal/field-of-view calibration, target-pixel selection, and DEM elevation. A perturbation-based estimate is preferred because it reflects the nonlinear terrain intersection; the response will expose a horizontal uncertainty and warnings rather than a falsely precise point.

Alternative considered: return coordinates without uncertainty. Rejected because downstream users cannot judge operational reliability.

## Risks / Trade-offs

- [PTZ telemetry cannot be queried historically] → Obtain a platform export/API that retains azimuth, pitch, and zoom per event; otherwise mark observations not ready.
- [Inventory coordinates are in GCJ-02 or another unconfirmed CRS] → Record and validate the source CRS before enabling calculation; do not assume WGS84.
- [Installation height is relative rather than absolute elevation] → Sample a compatible DEM at the camera origin and record the vertical datum.
- [Smoke centroid does not represent ground ignition] → Use an explicit target strategy and report the result as a visual-line terrain estimate.
- [DEM resolution or occlusion hides the real source] → Record DEM resolution, add uncertainty, and support later multi-camera intersection.
- [Eight-hour timestamp difference leads to wrong PTZ association] → Configure the timestamp source and time zone per source system; retain both raw and UTC timestamps.
- [GeoTIFF reader is unavailable or input DEM uses an unknown CRS] → Validate raster metadata at application startup and surface source availability through the API health endpoint.
- [Map service is unavailable from a deployment] → Use environment configuration compatible with the dock frontend and expose a visible Cesium load failure, never silently substitute an unrelated basemap.

## Migration Plan

1. Create camera inventory records from the supplied spreadsheet without assuming the coordinate reference system.
2. Add calibration, axis-alignment, and terrain-dataset configuration records.
3. Integrate read-only historical PTZ telemetry and validate time normalization against known alarm samples.
4. Enable a shadow mode that produces readiness reports and compares calculated points against manually verified incidents.
5. Enable coordinate display only after acceptance accuracy thresholds are met; retain a feature flag to disable calculation and return readiness status only.

Rollback consists of disabling the calculation feature flag while preserving source observations, readiness diagnostics, and audit records.

## Open Questions

- Which platform/API exposes historic pan, tilt, and zoom for camera IDs such as `53040200401310070301`, and what are its units and reference directions?
- Are the inventory coordinates WGS84, GCJ-02, or another coordinate reference system, and what vertical datum applies to the DEM and camera elevation?
- What operational accuracy threshold and maximum range are acceptable before a location can be shown as actionable?
