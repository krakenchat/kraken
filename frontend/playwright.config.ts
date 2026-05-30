import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Absolute path to the committed fake-media WAV samples (e2e/assets).
 * Resolved from cwd (Playwright always runs from the frontend dir) so this
 * works whether the config is loaded as ESM or CJS — `__dirname` is undefined
 * under ESM.
 */
export const VOICE_ASSET_DIR = path.resolve(process.cwd(), 'e2e/assets');

/**
 * Playwright E2E Test Configuration
 *
 * Run tests with: npm run test:e2e
 * Debug with UI: npm run test:e2e:ui
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup — runs once, saves storageState for reuse
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Main tests — use saved auth state (skip auth.spec.ts which tests auth itself)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /auth\.spec\.ts/,
    },

    // Auth tests — run without saved state so they can test login/register flows
    {
      name: 'auth-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/,
    },

    // Voice tests — real LiveKit + fake media. Each participant launches its own
    // browser in the fixture (so distinct fake audio files can be used), but the
    // project still sets the Chromium flags + a longer timeout for WebRTC setup.
    // Run via scripts/run-voice-e2e.sh (real LiveKit server required).
    {
      name: 'voice',
      testMatch: /voice\/.*\.spec\.ts/,
      retries: process.env.CI ? 1 : 0,
      timeout: 90 * 1000,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone', 'camera'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
            // Default fake audio; per-participant browsers override with their own wav.
            `--use-file-for-fake-audio-capture=${VOICE_ASSET_DIR}/sample-a.wav`,
          ],
        },
      },
    },
  ],

  // Start the dev server before running tests (local development)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },

  // Global test timeout
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
});
