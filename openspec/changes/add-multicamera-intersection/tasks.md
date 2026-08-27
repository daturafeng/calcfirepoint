## 1. Multi-camera calculation core

- [x] 1.1 Add typed multi-camera observation/options parsing and observation-scoped readiness diagnostics.
- [x] 1.2 Implement deterministic ECEF forward-ray least-squares intersection, ray-angle checks, terrain constraint, residual checks, uncertainty, and quality classification.
- [x] 1.3 Add core tests for successful intersecting rays, insufficient observations, weak geometry, and conflicting observations.

## 2. HTTP API

- [x] 2.1 Add the typed multi-camera intersection endpoint with configured DEM resolution and ready/not-ready HTTP responses.
- [x] 2.2 Add API tests for a successful request and typed weak-geometry validation response.

## 3. Multi-camera observation workspace

- [x] 3.1 Add frontend multi-camera types and API client request/response mapping.
- [x] 3.2 Add the page, observation table, add/edit/delete controls, calculation state, and accessible success/failure feedback.
- [x] 3.3 Implement the add/edit modal with independent draft state, image selection and metadata inspection, editable camera/pose/calibration inputs, and safe preview URL cleanup.
- [x] 3.4 Reuse the source-image rectangle editor in the modal and save explicit target-box values to its observation.

## 4. Map presentation and verification

- [x] 4.1 Extend the existing Cesium map presentation to render participating cameras, viewing rays, the successful intersection, and result uncertainty without altering the single-camera workflow.
- [x] 4.2 Add multi-camera result quality and residual presentation, responsive layout, and styles consistent with the existing Ant Design workspace.
- [x] 4.3 Run core/API tests and the frontend production build; inspect the page interaction and record any verification limits.

## 5. Workspace layout refinement

- [x] 5.1 Use a vertical Flex workspace so the table/map row fills the available viewport height, keep table scrolling internal, compact the pre-calculation guidance, and verify the production build.
