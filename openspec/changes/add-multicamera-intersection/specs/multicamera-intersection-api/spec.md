## Purpose

Expose multi-camera fire-point intersection through the existing safe typed HTTP boundary so browser clients receive the same validation, result, and diagnostic contract as direct calculation callers.

## ADDED Requirements

### Requirement: Submit a multi-camera intersection request

The API SHALL accept a request containing a configured DEM source identifier and an ordered collection of multi-camera observations. Each observation SHALL contain its explicit camera, pose, calibration, image, target geometry, and coordinate-reference inputs. The API SHALL return the multi-camera calculation result and SHALL not derive camera inputs from unsubmitted local file paths.

#### Scenario: Calculate from multiple browser observations

- **WHEN** a client submits two or more complete observations and a configured DEM source identifier
- **THEN** the API SHALL return the best-fit coordinate, quality metrics, and per-observation diagnostics

### Requirement: Return typed intersection diagnostics

The API SHALL return HTTP 422 with a typed not-ready body when an observation is invalid, the DEM source is unknown, camera geometry is weak, observations disagree, or terrain-constrained intersection is unavailable.

#### Scenario: Report geometric rejection to the browser

- **WHEN** the server rejects an intersection because its viewing rays are near parallel
- **THEN** the response SHALL identify the weak-geometry reason in a typed not-ready result
