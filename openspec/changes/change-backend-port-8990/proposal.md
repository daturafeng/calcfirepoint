## Why

The API service currently starts on port 8000, which does not match the required local service port. Standardizing the default to 8990 removes the need for a per-run override.

## What Changes

- Change the API service's default listening port to 8990.

## Capabilities

### New Capabilities

- `backend-runtime-configuration`: Defines the default network endpoint used when starting the API service locally.

### Modified Capabilities

- None.

## Impact

- Affects the Uvicorn startup configuration in `firepoint-geolocation-core/src/firepoint_api/main.py`.
- Local clients and run instructions must connect to port 8990 instead of 8000 when using the default startup entry point.
