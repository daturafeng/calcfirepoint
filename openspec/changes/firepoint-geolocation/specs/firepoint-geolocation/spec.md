## Purpose

Define how a fire-alarm observation becomes a traceable terrain-referenced fire-point location, or a clear explanation of why a location cannot yet be calculated.

## ADDED Requirements

### Requirement: Normalize an alarm observation

The system SHALL accept an observation containing an alarm identifier, camera identifier, capture timestamp and time-zone source, image dimensions, target bounding box, imagery type, and coordinate-reference metadata. It SHALL normalize the capture timestamp to UTC before associating the observation with PTZ telemetry.

#### Scenario: Normalize a time-zone-qualified alarm

- **WHEN** an alarm timestamp is supplied with an explicit UTC offset
- **THEN** the system records the equivalent UTC instant and retains the supplied timestamp and offset as provenance

#### Scenario: Reject an ambiguous alarm time

- **WHEN** an alarm timestamp has no configured or supplied time-zone source
- **THEN** the system SHALL not calculate a fire-point location and SHALL report the missing time-zone configuration

### Requirement: Inspect supplied image metadata without overriding explicit inputs

The system SHALL inspect supported image metadata and expose discovered image dimensions, capture timestamp, camera position, and camera-pose values as input candidates. Explicit caller-supplied values SHALL take precedence over image metadata, and missing metadata SHALL not prevent calculation when equivalent explicit inputs are valid.

#### Scenario: Read DJI image metadata for a test observation

- **WHEN** a supported DJI image contains position and gimbal metadata
- **THEN** the system SHALL expose those values with image-metadata provenance for use in an observation

#### Scenario: Explicit pose overrides image metadata

- **WHEN** an observation supplies explicit pose values that differ from image metadata
- **THEN** the system SHALL use the explicit values and retain the metadata values only as provenance

### Requirement: Derive the target pixel from an algorithm bounding box

The system SHALL derive the default observation pixel from the centre of the algorithm-produced target box: `u = x + width / 2` and `v = y + height / 2`. It SHALL record the target-pixel strategy used. A configured smoke strategy MAY use the box bottom centre, and a thermal-imagery strategy MAY use a supplied highest-temperature pixel.

#### Scenario: Use the default bounding-box centre

- **WHEN** a valid target box is supplied without an alternate configured or supplied target pixel
- **THEN** the system SHALL use the bounding-box centre and label the result `bbox_center`

#### Scenario: Reject a target box outside the image

- **WHEN** any portion of a target box lies outside the declared image dimensions
- **THEN** the system SHALL not calculate a fire-point location and SHALL report the invalid target geometry

### Requirement: Calculate a terrain-referenced fire-point location

The system SHALL calculate a viewing ray from the validated camera pose, calibration, image target pixel, and image dimensions. It SHALL intersect that ray with the configured terrain elevation model and return the intersection in the configured output coordinate reference system.

#### Scenario: Produce a location from complete observation data

- **WHEN** the camera observation is ready and the viewing ray intersects the configured terrain model
- **THEN** the system SHALL return longitude, latitude, estimated elevation, camera-to-target distance, capture instant, target pixel, and all coordinate-reference identifiers

#### Scenario: Ray has no valid terrain intersection

- **WHEN** a viewing ray does not intersect valid terrain within the configured search limit
- **THEN** the system SHALL return no fire-point coordinates and SHALL report `no_terrain_intersection`

### Requirement: Report uncertainty and provenance

Every successful fire-point location SHALL include an estimated horizontal uncertainty and the provenance of the camera configuration, PTZ telemetry, calibration/field-of-view profile, target-pixel strategy, and terrain dataset used. The system SHALL identify results derived from stale or interpolated PTZ telemetry.

#### Scenario: Return a traceable result

- **WHEN** a fire-point location is successfully calculated
- **THEN** the response SHALL identify all source records and configuration versions used in the calculation

### Requirement: Prevent unsupported coordinate results

The system SHALL not return a calculated location when required observation data is missing, invalid, or uses an unconfigured horizontal or vertical reference system. It SHALL return machine-readable missing or invalid input reasons instead of synthetic coordinates.

#### Scenario: Camera coordinate reference is not configured

- **WHEN** camera longitude and latitude are present but their coordinate reference system is unknown
- **THEN** the system SHALL return no fire-point coordinates and SHALL report `unconfigured_coordinate_reference`
