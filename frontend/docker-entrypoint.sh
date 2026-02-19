#!/bin/sh
set -e

# Generate API client from OpenAPI spec if not already generated
if [ -f /spec/openapi.json ] && [ ! -f src/api-client/client.gen.ts ]; then
  echo "Generating API client from OpenAPI spec..."
  OPENAPI_SPEC_PATH=/spec/openapi.json pnpm exec openapi-ts
fi

exec "$@"
