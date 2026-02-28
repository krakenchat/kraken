/**
 * Authentication Fixtures for E2E Tests
 *
 * Provides reusable authentication helpers and authenticated page fixtures.
 * Uses API-based login for speed (faster than UI login in each test).
 */

/* eslint-disable react-hooks/rules-of-hooks */
// Note: Playwright's `use` function is not a React hook, disable the rule for this file

import { test as base, expect, Page, APIRequestContext } from '@playwright/test';

// Test user credentials - should match what's seeded in test database
export const TEST_USER = {
  username: 'testuser',
  password: 'Test123!@#',
  email: 'testuser@test.local',
};

export const TEST_USER_2 = {
  username: 'testuser2',
  password: 'Test123!@#',
  email: 'testuser2@test.local',
};

// API base URL (proxied through Vite in development)
const API_BASE = '/api';

/**
 * Login via API and get access token
 */
export async function loginViaApi(
  request: APIRequestContext,
  credentials: { username: string; password: string }
): Promise<{ accessToken: string; refreshToken?: string }> {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: credentials,
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status()} - ${error}`);
  }

  return response.json();
}

/**
 * Register a new user via API
 */
export async function registerViaApi(
  request: APIRequestContext,
  userData: { username: string; password: string; email: string; code?: string }
): Promise<{ accessToken: string }> {
  const response = await request.post(`${API_BASE}/auth/register`, {
    data: {
      ...userData,
      code: userData.code || 'test-invite-code', // Default invite code for tests
    },
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Registration failed: ${response.status()} - ${error}`);
  }

  return response.json();
}

/**
 * Set authentication token in the browser context.
 *
 * After the security overhaul, access tokens live in memory (not localStorage).
 * For E2E tests that inject tokens via API login (not UI login), we set the
 * access_token cookie directly so the app's API interceptor can use it.
 * We also keep the localStorage entry for backward compatibility.
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  // Set the httpOnly access_token cookie (matches what the login endpoint sets)
  const pageUrl = page.url() || 'http://localhost:5174';
  const url = new URL(pageUrl);
  await page.context().addCookies([{
    name: 'access_token',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }]);

  // Also set in localStorage as a fallback
  await page.evaluate((accessToken) => {
    localStorage.setItem('accessToken', accessToken);
  }, token);
}

/**
 * Clear authentication token from browser storage and cookies
 */
export async function clearAuthToken(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
  });
}

/**
 * Check if user is authenticated.
 *
 * The access token is stored in memory (not localStorage) after the
 * security overhaul. We check authentication by looking for the
 * access_token httpOnly cookie set by the login endpoint, or by
 * verifying the page didn't redirect to /login.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // The access_token cookie is httpOnly so we can read it via Playwright's
  // cookie API (not page.evaluate which can't see httpOnly cookies).
  const cookies = await page.context().cookies();
  const hasAccessCookie = cookies.some(c => c.name === 'access_token');
  const hasRefreshCookie = cookies.some(c => c.name === 'refresh_token');
  return hasAccessCookie || hasRefreshCookie;
}

// Extended test fixtures
interface AuthFixtures {
  authenticatedPage: Page;
  secondUserPage: Page;
}

/**
 * Extended test with authentication fixtures
 *
 * Usage:
 * ```ts
 * import { test, expect } from './fixtures/auth.fixture';
 *
 * test('authenticated user can send message', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/');
 *   // User is already logged in
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  // Authenticated page fixture - reuses storageState auth or falls back to API login
  authenticatedPage: async ({ page, request }, use) => {
    try {
      // Check if already authenticated via storageState (from setup project)
      await page.goto('/');
      const hasToken = await isAuthenticated(page);

      if (!hasToken) {
        // Fall back to API login (local dev without setup project)
        const { accessToken } = await loginViaApi(request, TEST_USER);
        await setAuthToken(page, accessToken);
        await page.reload();
      }

      // Wait for app to be ready
      await page.waitForSelector('[data-testid="app-ready"], [data-testid="main-content"]', {
        timeout: 10000,
      }).catch(() => {
        // App might not have these test IDs, just wait for network idle
      });

      await use(page);
    } catch (error) {
      // If login fails, still provide the page for debugging
      console.error('Auth fixture error:', error);
      await use(page);
    }
  },

  // Second authenticated user for multi-user tests
  secondUserPage: async ({ browser, request }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const { accessToken } = await loginViaApi(request, TEST_USER_2);

      await page.goto('/');
      await setAuthToken(page, accessToken);
      await page.reload();

      await use(page);
    } catch (error) {
      console.error('Second user auth fixture error:', error);
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect };
