## Context

See `proposal.md` for the motivation. The existing calculator already validates a single observation, converts its selected image pixel into a WGS84/ENU viewing ray, and intersects that ray with a configured DEM. The web client already has Ant Design forms and modals, a Fabric source-pixel rectangle editor, and a standalone Cesium map engine. The installed Python dependencies do not include a numerical-optimisation package, so the first intersection solver must be small, deterministic, and testable with the existing standard-library and geodesy utilities.

## Goals / Non-Goals

**Goals:**

- Combine at least two explicitly configured, same-target image observations into one ground location only when their geometry and agreement are usable.
- Preserve an auditable per-observation input and quality record through the core, HTTP API, table UI, and map.
- Reuse the existing image rectangle editor and Cesium renderer instead of adding a second canvas or map dependency.

**Non-Goals:**

- Automatic cross-camera target matching, camera discovery, persistent observation storage, or historical PTZ integration.
- Estimating unconfigured camera calibration or repairing a rejected observation automatically.
- Treating a multi-camera result as survey-grade; the result remains an error-bounded operational estimate.

## Decisions

### Use a best-fit forward-ray intersection, then constrain it to configured terrain

For every valid observation, the core will reuse the existing pixel-to-ray and pose transformation, express the camera origin and unit ray in ECEF metres, and solve the least-squares closest point of the forward viewing rays. The solver will reject a singular/near-singular normal matrix, non-forward closest points, and pairwise separations below a configurable minimum angle. It will convert the candidate horizontal coordinate to WGS84, sample the configured DEM for the output elevation, and recalculate every ray's nearest-point residual to that terrain point. A residual beyond the configured tolerance makes the whole result `not_ready` and identifies the offending observation.

This preserves the actual geometric benefit of intersecting independent rays while ensuring a ground-fire result is tied to approved terrain data. The initial small symmetric 3×3 linear-system helper avoids a new dependency and is covered by deterministic unit tests.

Alternative considered: average the independent single-camera DEM intersections. Rejected because it does not use the cross-camera geometry and can hide a systematic pose error. Alternative considered: introduce a numerical-optimisation library. Rejected for this bounded three-dimensional problem because no installed engine is required.

### Keep the multi-camera contract separate from the single-camera response

The core will expose `calculate_multicamera_intersection(data)`. A request contains `demSourceId` and `observations`; each observation retains the familiar explicit single-camera fields plus a client-provided stable id and display name. The response has `ready`/`not_ready`, observation-scoped checks, and, on success, a `location` with coordinate, terrain elevation, horizontal uncertainty, quality level, minimum ray angle, and per-observation distance/residual data.

The FastAPI endpoint `/api/v1/geolocations/intersect` will resolve the DEM source server-side and delegate to the core. It receives no image bytes: the browser uses the existing image-inspection endpoint while editing each observation, and submits the explicit reviewed values only. This keeps the intersection request compact and avoids confusing one multipart image with a multi-image set.

Alternative considered: overload the single-camera endpoint with optional arrays. Rejected because it would make its typed location contract ambiguous and make validation failures harder to attribute.

### Treat geometry quality as a blocking validation condition

The solver will calculate pairwise ray angles and perpendicular residuals. It will classify results as high, medium, or low only after passing configured lower bounds for intersection angle and upper bounds for residual and uncertainty; conditions outside those bounds are `not_ready`. The uncertainty starts from the contributing single-observation uncertainties and is inflated by ray-angle geometry and residual disagreement. Exact thresholds remain named defaults in calculation options so they can later be calibrated against a labelled validation set.

Alternative considered: always return the best mathematical point with a warning. Rejected because nearly parallel rays or conflicting images create deceptively precise coordinates and conflict with the existing readiness-first safety model.

### Model modal edits independently from saved observations

The frontend will add a `multicamera` tab and a page-local array of observation records. The table renders saved records only. Opening add/edit creates a copied draft that owns its selected image `File`, object URL, decoded size, metadata candidates, form values, and target rectangle. Cancelling discards that draft, while saving replaces/appends one record and revokes superseded object URLs during cleanup. Image metadata hydrates only finite, supported fields, and explicit input remains authoritative.

The modal reuses `ImageAnnotationCanvas` through the existing `TargetGeometryEditor`; its two-click rectangle flow produces source-pixel coordinates and applies them only after the operator action. This retains one pixel-coordinate conversion and avoids introducing an alternative image drawing implementation.

Alternative considered: make each table row directly editable. Rejected because it cannot provide a sufficiently large image preview and makes incomplete changes difficult to distinguish from saved observations.

### Reuse Cesium annotations for multi-camera map overlays

`MapCanvas` will accept an explicit multi-camera overlay input. It will render a marker and labelled ray for each submitted observation, then reuse the current result point and uncertainty drawing conventions for the intersection. A dedicated multi-camera result panel will display quality, uncertainty, ray-angle, and residual information. Failed calculations retain camera/ray overlays but omit the successful intersection marker.

Alternative considered: create a second Cesium viewer. Rejected because it duplicates terrain, imagery, hover interaction, cleanup, and annotation behaviour already provided by the existing map component.

### Fill the multi-camera workspace with Flex layout

The desktop multi-camera page will be a vertical Flex container sized to the workspace viewport. Its toolbar does not grow; the table/map row flexes into the remaining height, and both child panels stretch to that height. The table panel owns vertical overflow, preventing extra rows from changing the map dimensions. The pre-calculation message is rendered as a compact inline status in the toolbar area rather than a full-width alert, so it cannot create a second layout row that reduces the map viewport.

Alternative considered: a fixed-height grid. Rejected because it left unused workspace beneath the map on tall viewports and did not meet the operator's need for a map that fills the available area.

## Risks / Trade-offs

- [Two cameras observe different smoke portions or different capture moments] → Require the operator to select the same target and show residual diagnostics rather than silently accepting disagreement.
- [Cameras have a small baseline or nearly parallel rays] → Reject weak geometry and ask for a better-spaced observation.
- [Camera orientation or zoom calibration has systematic error] → Retain each input in the result and use residuals to identify disagreement; camera calibration remains a separate operational prerequisite.
- [Terrain snaps the unconstrained line intersection to a materially different point] → Recompute all residuals after terrain sampling and reject a result beyond tolerance.
- [Large image files remain in browser memory] → Hold preview object URLs only in page/modal state and revoke them on replacement, cancellation, save cleanup, and component unmount.

## Migration Plan

1. Deploy the new core function and endpoint without changing single-camera requests or responses.
2. Add the separate frontend tab behind the existing web build; existing single-point and image-annotation workflows remain unchanged.
3. Validate camera pairs against known targets before making multi-camera results operationally actionable; adjust named quality thresholds from those measurements.

Rollback consists of hiding the new tab and ceasing calls to the new endpoint; no existing endpoint, input, or stored record is changed.
