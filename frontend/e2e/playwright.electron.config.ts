import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
  // No webServer — Electron launches its own Vite dev server via concurrently
  // The Electron main process handles starting Vite
});
