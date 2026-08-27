## Purpose

Combine two or more independently configured camera observations into a terrain-referenced fire-point result whose agreement, uncertainty, and input provenance can be reviewed by an operator.

## ADDED Requirements

### Requirement: Validate a multi-camera observation set

The system SHALL accept a named set of at least two camera observations of one target. Each observation SHALL include its image dimensions, target bounding box, camera position and coordinate references, PTZ pose, camera calibration, and capture timestamp. It SHALL report observation-specific validation failures and SHALL not calculate a result until at least two observations are valid.

#### Scenario: Reject an incomplete observation set

- **WHEN** a submitted set contains fewer than two valid observations
- **THEN** the system SHALL return no intersection coordinate and identify every observation that is missing or has invalid input

### Requirement: Calculate a terrain-referenced multi-camera intersection

The system SHALL derive a viewing ray from each valid observation and calculate a single terrain-referenced point that best fits the participating rays. It SHALL use only configured terrain data and compatible coordinate references, and return longitude, latitude, elevation, and a distance for every observation used.

#### Scenario: Intersect two compatible camera observations

- **WHEN** two or more valid viewing rays observe the same terrain target with usable geometric separation
- **THEN** the system SHALL return one best-fit fire-point coordinate and identify all observations used

### Requirement: Assess intersection geometry and disagreement

The system SHALL calculate a geometric quality assessment for the intersection, including the angle between each contributing ray and the final point-to-ray residual for every observation. It SHALL return no actionable coordinate when ray geometry is degenerate, observations disagree beyond configured tolerance, or no valid terrain-constrained solution exists.

#### Scenario: Reject near-parallel rays

- **WHEN** the contributing camera rays have insufficient angular separation to constrain a stable intersection
- **THEN** the system SHALL return a not-ready result with a machine-readable weak-geometry diagnostic

#### Scenario: Surface conflicting observations

- **WHEN** a submitted observation's ray is inconsistent with the best-fit point beyond the configured residual tolerance
- **THEN** the result SHALL identify that observation and mark the intersection as not ready rather than silently treating it as a valid match

### Requirement: Report a traceable uncertainty result

Every successful multi-camera result SHALL include an estimated horizontal uncertainty, a quality level, the contributing observations, per-observation residuals, and the camera, pose, calibration, target-pixel, and terrain provenance used for each contribution.

#### Scenario: Return an auditable intersection result

- **WHEN** an intersection succeeds
- **THEN** the response SHALL include its quality metrics and enough source identifiers and values for an operator to audit every contributing observation
