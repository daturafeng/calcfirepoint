## Purpose

Expose image-based fire-point geolocation through a safe, typed HTTP API so a browser client and future alarm integrations use the same validated calculation contract.

## ADDED Requirements

### Requirement: Calculate a location from an uploaded observation

The API SHALL accept an optional image upload and an explicit observation payload containing camera, pose, calibration, target geometry, coordinate references, and a configured DEM source identifier. It SHALL return the core calculator's `ready` or `not_ready` result without replacing explicit values with image metadata.

#### Scenario: Calculate a complete uploaded observation

- **WHEN** a client submits a valid observation and optional supported image with a configured DEM source
- **THEN** the API SHALL return the calculated location, readiness checks, uncertainty, and metadata provenance

#### Scenario: Return missing-data diagnostics

- **WHEN** the submitted observation lacks required pose, calibration, coordinate-reference, or DEM configuration
- **THEN** the API SHALL return HTTP 422 with a typed `not_ready` result that identifies each invalid or missing input

### Requirement: Restrict DEM access to configured sources

The API SHALL resolve a DEM source identifier through server-side configuration. It SHALL not accept arbitrary local file paths or unrestricted remote URLs from browser requests.

#### Scenario: Reject an unknown DEM source

- **WHEN** a client supplies a DEM source identifier not present in the server configuration
- **THEN** the API SHALL return HTTP 422 and SHALL not attempt to open a local path or network URL

### Requirement: Load server configuration from the project JSON file

The API SHALL load its server-side configuration from the project-local `config.json` file before resolving configured DEM sources. The configuration file SHALL define each DEM source by identifier, path, and vertical datum without exposing server file paths to browser requests. The implementation SHALL use the Python standard library JSON parser and SHALL not require a dotenv package.

#### Scenario: Load a configured DEM from the JSON file

- **WHEN** `config.json` defines a valid DEM source with an identifier, path, and vertical datum
- **THEN** the health endpoint SHALL inspect that DEM source and report its configured availability

### Requirement: Expose service availability

The API SHALL provide a health endpoint that identifies whether the geolocation core and at least one configured DEM source are available.

#### Scenario: Report a configured service

- **WHEN** the service starts with a valid configured local DEM source
- **THEN** the health endpoint SHALL report the service as available and identify the configured DEM source identifiers

### Requirement: Support loopback development origins

The API SHALL allow CORS requests from both `localhost` and `127.0.0.1` loopback origins, including a development-server port selected by Vite. Production origins SHALL remain configurable through environment settings.

#### Scenario: Frontend uses a loopback IP origin

- **WHEN** a browser page served from `http://127.0.0.1` submits a supported API request during local development
- **THEN** the preflight and response SHALL include a matching `Access-Control-Allow-Origin` value and the request SHALL not fail because of CORS

### Requirement: Return quality metrics for projected image geometries

The image-geometry projection endpoint SHALL return each projected vertex's longitude, latitude, elevation, slant distance, and horizontal uncertainty from the core calculation.

#### Scenario: Project a point geometry

- **WHEN** a client projects a valid single image pixel
- **THEN** the response SHALL include the projected coordinate together with its slant distance and horizontal uncertainty
