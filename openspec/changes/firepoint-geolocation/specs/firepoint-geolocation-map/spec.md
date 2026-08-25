## Purpose

Provide an operator-focused React and Cesium workspace that makes image-to-terrain fire-point calculations understandable, reviewable, and easy to correct before operational use.

## ADDED Requirements

### Requirement: Enter and inspect a geolocation observation

The interface SHALL allow an operator to choose an image, inspect discovered metadata candidates, enter explicit camera, pose, calibration, target-box, and DEM-source values, and select a target-pixel strategy. It SHALL make clear that explicit values are used for calculation.

#### Scenario: Image metadata is available

- **WHEN** an operator selects a supported DJI image
- **THEN** the interface SHALL display the discovered metadata candidates and clearly distinguish them from the editable calculation inputs

### Requirement: Preview the calculated target pixel on the source image

When an image preview is available, the interface SHALL display the active target-box centre over the source image. The marker SHALL update as the operator edits the box position or dimensions, using the original image-pixel coordinate system and preserving the image aspect ratio.

#### Scenario: Operator edits a target box

- **WHEN** an operator changes any target-box coordinate or dimension
- **THEN** the image preview SHALL move its target marker to the resulting box centre before calculation is submitted

#### Scenario: Operator opens an image preview

- **WHEN** an operator activates the source-image preview on the single-point page
- **THEN** the interface SHALL open a single large, proportionally fitted preview without changing the target-pixel coordinate system or requiring a second preview action

### Requirement: Draw a single-point target geometry in the large preview

The single-point large-image preview SHALL reuse the Fabric image-pixel drawing canvas to let an operator define one rectangular target box with two clicks: the first click sets the start corner and the second click sets the opposite corner. It SHALL calculate that rectangle's original-pixel `x`, `y`, `width`, and `height`, display those values before confirmation, and apply them to the single-point observation only after explicit operator action.

#### Scenario: Apply a two-click rectangle as the calculation target box

- **WHEN** an operator clicks the two opposite rectangle corners in the large preview and activates the apply control
- **THEN** the form's target-box `x`, `y`, `width`, and `height` SHALL become the two-click rectangle's original-image-pixel bounds and the compact preview marker SHALL update

#### Scenario: Preview a rectangle before its second click

- **WHEN** an operator moves the pointer after selecting the first corner
- **THEN** the interface SHALL preview the pending rectangle without completing it until the second click

#### Scenario: Preserve the selected first corner

- **WHEN** the pointer moves to the upper-left of the first selected corner
- **THEN** the pending rectangle SHALL retain a visible marker at that first corner while its normalised bounding-box origin changes

#### Scenario: Keep the pending rectangle and first corner synchronized

- **WHEN** the first corner or pending rectangle changes during Fabric pointer interaction
- **THEN** the displayed rectangle and first-corner marker SHALL update from one atomic selection state so the marker is always a rectangle diagonal endpoint

#### Scenario: Render from the first corner as the top-left rectangle origin

- **WHEN** a target-box rectangle is rendered from its normalised `x` and `y` origin
- **THEN** the Fabric rectangle SHALL use its left/top origin so the displayed left-top corner equals the source-pixel box origin instead of its centre

#### Scenario: Resize the drawing modal

- **WHEN** the large-preview modal is rendered at a different viewport size
- **THEN** its main image pane SHALL remain the dominant left column, the pixel-value/actions pane SHALL remain at the right, and the drawn rectangle SHALL stay aligned with the original-image pixels

### Requirement: Display calculation state and diagnostics

The interface SHALL show loading, successful, and not-ready states without relying on colour alone. It SHALL display missing-data reasons and the complete calculated coordinate, elevation, distance, and uncertainty when a result is available.

#### Scenario: Result is not ready

- **WHEN** the API returns a `not_ready` result
- **THEN** the interface SHALL display every returned diagnostic and SHALL not show a fire-point marker as a successful result

### Requirement: Keep the desktop workspace within the viewport

The desktop workspace SHALL fit within the browser viewport without an outer page scrollbar. Its result overlay SHALL remain legible while using a translucent background that preserves contextual map visibility.

#### Scenario: Operator reviews a calculated result

- **WHEN** a result overlay is displayed on a desktop viewport
- **THEN** it SHALL be visually translucent and the document itself SHALL not require vertical scrolling

### Requirement: Visualize the observation on a Cesium map

The interface SHALL show the camera origin, calculated fire point, camera-to-target ray, and horizontal uncertainty area on a Cesium map. It SHALL use the deployment-configured imagery and terrain URLs, with values compatible with the existing dock frontend map configuration.

#### Scenario: Location calculation succeeds

- **WHEN** the API returns a `ready` location
- **THEN** the map SHALL place the camera and fire-point markers, render their connecting ray and uncertainty area, and provide a control to focus the view on the result

### Requirement: Preserve usable keyboard and responsive interaction

The interface SHALL use labelled native form controls, visible keyboard focus, and an accessible result announcement. It SHALL remain usable with the map and input panel arranged vertically on narrow viewports.

#### Scenario: Operator submits using keyboard

- **WHEN** an operator completes the form and activates the calculate control using the keyboard
- **THEN** the interface SHALL submit the observation and announce the resulting state

### Requirement: Present a balanced desktop operator workspace

On desktop-sized viewports, the single-point workspace SHALL present the observation controls as a fixed-width left column and the map as the dominant right column. It SHALL keep the header, page controls, input panel, map, and result state visually distinct without excessive outer whitespace. On narrow viewports it SHALL stack into one usable column.

#### Scenario: Operator opens the desktop workspace

- **WHEN** the viewport is at least 900 CSS pixels wide
- **THEN** the left input column and right map workspace SHALL be visible together, with the map occupying the majority of the available width

### Requirement: Use a consistent component system

The React workspace SHALL use Ant Design components for navigation, forms, cards, buttons, feedback, and descriptions where applicable. Cesium shall remain responsible only for the map canvas and its overlays.

#### Scenario: Operator reviews or submits input

- **WHEN** the operator interacts with the workspace controls
- **THEN** controls, validation presentation, and result feedback SHALL use the shared Ant Design visual and interaction patterns

### Requirement: Keep non-critical operation guidance unobtrusive

The interface SHALL present non-critical guidance for image selection, metadata inspection, image preview, and image drawing through Ant Design hover/focus tooltips instead of persistent instructional text. Calculation results, validation failures, and error diagnostics SHALL remain visibly available without requiring hover.

#### Scenario: Operator needs image-drawing guidance

- **WHEN** an operator hovers or keyboard-focuses a contextual help control in the image-annotation workspace
- **THEN** the relevant drawing or projection guidance SHALL be displayed in a tooltip

### Requirement: Capture image geometries as pixel coordinates

The interface SHALL provide a separate image-annotation page where an operator can create point, line, and polygon geometries over an uploaded image using Fabric's canvas interaction and preview capabilities. It SHALL retain each geometry as ordered image-pixel coordinates and allow the operator to undo or clear the current drawing.

#### Scenario: Draw a polygon on an image

- **WHEN** an operator selects polygon mode and clicks three or more image positions before confirming
- **THEN** the interface SHALL retain the ordered pixel coordinates and render the polygon over the image

#### Scenario: Preview the first line or polygon vertex

- **WHEN** an operator selects line or polygon mode and clicks the first image position
- **THEN** the interface SHALL immediately display that active vertex before a second position is added

### Requirement: Maintain an independent image-annotation observation

The image-annotation workspace SHALL maintain its own selected image, recognised metadata, image dimensions, and editable observation values independently from the single-point workspace. It SHALL present these inputs in a left metadata column, with the Fabric image canvas in the centre and Cesium map on the right.

#### Scenario: Operator selects an image from the annotation workspace

- **WHEN** an operator selects a supported DJI image on the annotation workspace
- **THEN** the application SHALL hydrate the annotation workspace inputs before projecting pixels, and the operator SHALL be able to review and edit the active metadata in the left column without affecting the single-point workspace

### Requirement: Preserve image aspect ratio and source-pixel coordinates

The Fabric image canvas SHALL fit the source image proportionally inside its available panel without stretching. It SHALL convert click and drawing coordinates between the displayed canvas and original image-pixel coordinate systems using the same scale factor before projection.

#### Scenario: Image panel aspect differs from source image

- **WHEN** the available image panel has a different aspect ratio from the selected image
- **THEN** the image SHALL be letterboxed rather than stretched, and a drawn point SHALL be submitted using its correct original-image pixel coordinate

### Requirement: Preserve stable source-image rendering during drawing

The annotation workspace SHALL keep the selected source image visibly stable while an operator previews, adds, or edits point, line, and polygon vertices. It SHALL redraw only the transparent annotation layer for geometry changes and SHALL not asynchronously reload or visibly blank the source image for each drawing interaction.

#### Scenario: Operator adds an annotation vertex

- **WHEN** an operator clicks the source image to add a point or a vertex to a line or polygon
- **THEN** the source image SHALL remain continuously visible while the updated geometry is rendered over it

### Requirement: Display image-geometry projection results

After an image geometry is projected, the annotation page SHALL display the resulting longitude, latitude, elevation, slant distance, and horizontal uncertainty. For multi-vertex geometries it SHALL identify the displayed vertex or summary.

#### Scenario: Project an image point

- **WHEN** the operator projects a valid image point
- **THEN** the map result panel SHALL show a successful location state including coordinate, elevation, distance, and uncertainty

### Requirement: Synchronize projected geometries to the map

The interface SHALL submit each geometry's pixel coordinates using the active camera and DEM inputs, then render the returned geographic point, line, or polygon through the migrated Cesium annotation engine alongside the source image annotation. Image-space pixel annotation MAY use a local overlay only because the map engine does not provide image-pixel drawing.

#### Scenario: Confirm a line geometry

- **WHEN** an operator confirms a line with two or more pixel coordinates and the projection succeeds
- **THEN** the map SHALL render a corresponding geographic line and the result panel SHALL identify its projected coordinates

### Requirement: Prefer migrated Cesium engine capabilities

For map drawing, annotation, geometry rendering, and related interactions, the frontend SHALL first use a capability from `src/utils/cesium`. A local extension SHALL be added only when the engine lacks the capability, and its reason and boundary SHALL be recorded in the OpenSpec design.

#### Scenario: A map annotation feature is implemented

- **WHEN** a developer adds or changes map annotation behavior
- **THEN** the implementation SHALL use the existing Cesium engine drawing or annotation manager when it supports the required behavior

### Requirement: Provide a standalone Cesium engine boundary

The migrated Cesium engine SHALL be importable without dock cloud-service clients, dock authentication constants, dock scene registries, or dock user-preference storage. Standard Cesium Viewer, imagery, standard 3D Tiles, drawing, annotation, camera, coordinate, and height capabilities SHALL receive resource URLs and options from their caller rather than loading dock runtime scenes internally.

#### Scenario: Standalone project imports the engine

- **WHEN** the fire-point frontend imports a Cesium engine capability
- **THEN** its transitive engine imports SHALL not reference dock cloud-service modules, dock authentication constants, or the browser storage keys used by dock scene preferences

### Requirement: Hydrate observation inputs from supported image metadata

After an operator selects an image, the interface SHALL apply valid recognised image metadata, including an explicitly timezone-qualified capture timestamp when available, to the corresponding observation inputs. If a field is not present, invalid, or unsupported, the interface SHALL retain its configured default or current value and identify that metadata could not be used for that field.

#### Scenario: A DJI image includes camera and pose metadata

- **WHEN** a selected DJI image supplies a valid UTC capture timestamp, longitude, latitude, elevation, yaw, pitch, or roll metadata
- **THEN** the corresponding input fields SHALL be populated before the operator submits the calculation

### Requirement: Preserve operator map view while supporting camera-pose recall

When an operator switches the source image, the map SHALL use the active image's camera position and pose metadata to fly to the camera viewpoint. After that image-switch operation, form edits, drawing interactions, geometry projection, and calculation results SHALL update map overlays without changing the operator-selected map view. The map SHALL provide a control to explicitly return to the active camera viewpoint.

#### Scenario: Image selection hydrates camera metadata

- **WHEN** an operator selects a new image and its camera metadata has been applied to the active observation
- **THEN** the map SHALL fly to the active camera longitude, latitude, elevation, heading, pitch, and roll once

#### Scenario: Geometry projection succeeds after the operator adjusts the map

- **WHEN** an operator manually changes the map view and then projects an image geometry
- **THEN** the projected map geometry SHALL be displayed without moving the current map viewpoint

#### Scenario: Operator recalls the camera viewpoint

- **WHEN** an operator activates the map's camera-location control
- **THEN** the map SHALL fly to the current active camera position and pose

### Requirement: Display hover coordinates and camera height

The map SHALL display the longitude and latitude under the pointer together with the current camera-view height while the pointer is over valid terrain or imagery.

#### Scenario: Operator hovers over the map

- **WHEN** an operator moves the pointer over a resolvable location on the map
- **THEN** the map footer SHALL display formatted longitude, latitude, and camera-view height

### Requirement: Preserve smooth camera interaction during pointer feedback

The map SHALL bound presentation-layer hover-coordinate updates and terrain/ellipsoid coordinate picking so raw pointer events do not trigger an unbounded number of React renders or scene-depth reads while the operator rotates, pans, or zooms the Cesium camera. It SHALL continue to present the latest resolvable location after the bounded refresh interval.

#### Scenario: Operator rotates the map while pointer feedback is active

- **WHEN** Cesium emits high-frequency pointer-move events during camera rotation
- **THEN** the map SHALL pause terrain picking and footer updates while the drag is active, retain responsive camera interaction, and resolve the latest pointer position after the interaction ends

### Requirement: Keep map overlays stable during pointer feedback

The map SHALL update pointer-coordinate feedback without clearing and recreating unchanged camera or calculation markers.

#### Scenario: Operator moves the pointer over a single-point result

- **WHEN** the map updates hover coordinates while a single-point result is visible
- **THEN** its camera and fire-point markers SHALL remain continuously rendered without flashing
