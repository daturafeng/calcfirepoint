## Context

The standard API entry point currently supplies a fixed Uvicorn port. See `proposal.md` for the change motivation and `specs/backend-runtime-configuration/spec.md` for the required observable behavior.

## Goals / Non-Goals

**Goals:**
- Set the default API listening port to 8990 while preserving the existing host and reload behavior.

**Non-Goals:**
- Change API routes, CORS behavior, host binding, or environment-based configuration.

## Decisions

- Update only the existing fixed startup-port value. This preserves the current startup path and requires no new configuration surface. An environment variable was considered but is unnecessary for this narrowly scoped default-port change.

## Risks / Trade-offs

- [Existing local clients still target port 8000] → Update local client configuration or invocation URLs to use 8990.

## Migration Plan

1. Deploy the updated API entry point.
2. Start the service through the standard entry point and verify the health endpoint on port 8990.
3. Roll back by restoring the prior port value if dependent clients cannot yet be updated.
