import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: process.env.OPENAPI_SPEC_PATH || '../backend/openapi.json',
  output: 'src/api-client',
  plugins: [
    {
      name: '@hey-api/typescript',
      enums: 'javascript',
    },
    {
      name: '@hey-api/sdk',
    },
    {
      name: '@hey-api/client-fetch',
    },
    {
      name: '@tanstack/react-query',
    },
  ],
});
