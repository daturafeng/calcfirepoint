## Purpose

Define a pre-calculation readiness assessment so operations can see exactly which camera, telemetry, calibration, and terrain inputs are available or missing for each alarm observation.

## ADDED Requirements

### Requirement: Validate camera origin and absolute elevation

The system SHALL validate a camera origin consisting of longitude, latitude, a configured horizontal coordinate reference system, and an absolute camera elevation. It SHALL permit absolute elevation to be derived from terrain elevation at the camera plus installation height only when the vertical datum is configured.

#### Scenario: Derive camera elevation from mount height

- **WHEN** a camera has a valid terrain elevation, installation height, and compatible vertical datum
- **THEN** the readiness assessment SHALL report an absolute camera elevation as available

#### Scenario: Installation height has no ground elevation

- **WHEN** a camera has only installation height above ground
- **THEN** the readiness assessment SHALL report absolute camera elevation as missing

### Requirement: Validate synchronized PTZ pose

The system SHALL validate a camera pose containing north-referenced azimuth, pitch, and the active zoom/focal-length or field-of-view profile. It SHALL associate telemetry to the normalized capture instant using a configured maximum time offset and report the actual offset.

#### Scenario: Match telemetry within the configured interval

- **WHEN** pose telemetry is available within the configured maximum time offset of an alarm capture instant
- **THEN** the readiness assessment SHALL report PTZ pose as available and record the offset and telemetry source

#### Scenario: Telemetry is too old

- **WHEN** the nearest pose telemetry exceeds the configured maximum time offset
- **THEN** the readiness assessment SHALL report PTZ pose as unavailable and SHALL identify the nearest telemetry timestamp

### Requirement: Validate camera calibration and orientation convention

The system SHALL validate that each camera/zoom profile has either calibrated intrinsic parameters and lens-distortion parameters or a calibrated horizontal and vertical field of view. It SHALL also validate the transformation between PTZ axes and the north/east/up convention used for calculation.

#### Scenario: Accept a calibrated field-of-view profile

- **WHEN** a camera zoom profile has calibrated horizontal and vertical field-of-view values and a defined orientation convention
- **THEN** the readiness assessment SHALL report calibration as available

#### Scenario: Reject an uncalibrated zoom profile

- **WHEN** the alarm zoom profile cannot be resolved to camera calibration or field-of-view data
- **THEN** the readiness assessment SHALL report calibration as unavailable

### Requirement: Validate terrain coverage

The system SHALL validate that the configured terrain dataset covers the camera and the permitted ray-intersection area, and SHALL identify the terrain dataset version, resolution, and vertical datum.

#### Scenario: Terrain covers the observation area

- **WHEN** terrain data covers the camera origin and expected viewing area with a configured vertical datum
- **THEN** the readiness assessment SHALL report terrain as available

#### Scenario: Terrain has a coverage gap

- **WHEN** a required terrain sample is outside coverage or has no-data elevation
- **THEN** the readiness assessment SHALL report terrain as unavailable for the observation

### Requirement: Return a complete readiness report

The system SHALL return an overall `ready` status only when camera origin, absolute elevation, synchronized PTZ pose, calibration, target geometry, coordinate references, and terrain coverage are all valid. Otherwise, it SHALL return `not_ready` with individually addressable checks and remediation-oriented reasons.

#### Scenario: Identify the exact missing data

- **WHEN** an alarm observation lacks PTZ pose and calibration data
- **THEN** the readiness report SHALL be `not_ready` and list both missing checks separately
