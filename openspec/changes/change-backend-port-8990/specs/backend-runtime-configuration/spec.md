## Purpose

Defines the default local API endpoint so operators and local clients use a consistent service port without supplying a runtime override.

## ADDED Requirements

### Requirement: Default API listening port
When the API service is started through its standard application entry point without a port override, the service SHALL listen on TCP port 8990 on all network interfaces.

#### Scenario: Default service startup
- **WHEN** an operator starts the API service using its standard application entry point without overriding its port
- **THEN** the API health endpoint is reachable through port 8990
