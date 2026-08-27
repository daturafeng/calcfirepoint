## Purpose

Provide a dedicated operator workspace for building, reviewing, and calculating a shared fire-point intersection from multiple camera images without losing the input provenance of any camera.

## ADDED Requirements

### Requirement: Manage a set of camera observations

The interface SHALL provide a Multi-camera Intersection page with a tabular list of the current observations and controls to add, edit, remove, and calculate the set. The table SHALL show each observation's identity, selected image name, camera position, PTZ pose, target-box status, and validation state without relying on colour alone.

#### Scenario: Add a second observation

- **WHEN** an operator activates the add-observation control and saves a valid observation
- **THEN** the table SHALL append that observation and enable calculation once at least two valid observations exist

### Requirement: Configure one observation in a modal

The add/edit observation modal SHALL let an operator select an image, inspect any discovered metadata candidates, and explicitly enter or change capture time, camera longitude, latitude, absolute elevation, azimuth, pitch, roll, and horizontal and vertical field of view. Explicit operator values SHALL be the values submitted for calculation.

#### Scenario: Edit the pose reported by an image

- **WHEN** image metadata supplies a PTZ pose and an operator changes the pitch in the modal
- **THEN** the saved observation SHALL use the edited pitch while retaining the image metadata only as review information

### Requirement: Draw an observation target box in the modal

After an image is selected, the modal SHALL provide an image preview where an operator can draw a rectangular target area using the source-image pixel coordinate system. It SHALL display the rectangle's pixel values and apply them to that observation only after explicit operator action.

#### Scenario: Apply a target rectangle to an observation

- **WHEN** an operator draws a rectangle in the selected image preview and applies it
- **THEN** the modal SHALL save the rectangle as that observation's target box and the table SHALL show the target-box state as complete

### Requirement: Review a multi-camera result on the map

After a successful calculation, the page SHALL show every participating camera, its viewing ray, the calculated fire point, and the horizontal uncertainty area on the Cesium map. It SHALL present overall quality and per-observation residual diagnostics alongside the result.

#### Scenario: Review a successful intersection

- **WHEN** a multi-camera calculation succeeds
- **THEN** the map SHALL retain all contributing camera and ray overlays while the result panel identifies the quality level and each observation's residual

### Requirement: Preserve incomplete work and communicate failures

The interface SHALL keep unsaved modal edits and existing table observations separate, show loading and calculation failures accessibly, and retain the input table when a calculation returns not-ready diagnostics.

#### Scenario: Calculation is rejected for weak geometry

- **WHEN** the API reports weak camera geometry
- **THEN** the page SHALL keep all submitted observations visible and show the returned diagnostic without presenting a successful fire-point marker

### Requirement: Keep the map viewport stable while observations grow

The Multi-camera Intersection page SHALL use a vertical Flex workspace whose observation table and map row fills the remaining viewport height below the toolbar. The observation table SHALL scroll within its own panel when rows exceed the available height, the adjacent map SHALL stretch to the same available height, and pre-calculation guidance SHALL use compact presentation without expanding the workspace height materially.

#### Scenario: Add many observations

- **WHEN** an operator adds enough observations to exceed the table panel height
- **THEN** the table SHALL become independently scrollable while the adjacent map continues to fill the available workspace height
