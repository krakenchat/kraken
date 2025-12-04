# health

> **Location:** `backend/src/health/`
> **Type:** NestJS Module
> **Category:** Infrastructure

## Overview

Provides health check endpoint for load balancers and monitoring systems. Publicly accessible without authentication.

## Key Exports

- `HealthController` - Single GET endpoint at `/health`
- `HealthService` - Returns instance metadata and status

## Usage

```bash
# Check instance health
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Related

- Docker healthcheck configuration
- Kubernetes readiness probes
