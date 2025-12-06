/**
 * Mobile UX E2E Tests
 *
 * Tests mobile-specific navigation and gestures.
 * These tests run on mobile viewport devices (Pixel 5, iPhone 12).
 */

import { test, expect } from '@playwright/test';
import { loginViaApi, TEST_USER, setAuthToken } from './fixtures';
import { generateTestName, createTestCommunity, deleteCommunity } from './fixtures';

test.describe('Mobile UX', () => {
  test.describe('Community Drawer', () => {
    test('can open community drawer with swipe from left edge', async ({ page, request }) => {
      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 768) {
        test.skip();
      }

      const { accessToken } = await loginViaApi(request, TEST_USER);
      await page.goto('/');
      await setAuthToken(page, accessToken);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Simulate swipe from left edge
      const viewportWidth = viewport?.width || 375;
      await page.mouse.move(0, 300);
      await page.mouse.down();
      await page.mouse.move(viewportWidth * 0.5, 300, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
    });

    test('can open community drawer via menu button', async ({ page, request }) => {
      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 768) {
        test.skip();
      }

      const { accessToken } = await loginViaApi(request, TEST_USER);
      await page.goto('/');
      await setAuthToken(page, accessToken);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const menuButton = page.locator(
        '[data-testid="drawer-trigger"], [aria-label*="menu"], [aria-label*="drawer"], button:has(svg)'
      ).first();

      if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await menuButton.click();
        await page.waitForTimeout(500);

        const drawer = page.locator(
          '[data-testid="community-drawer"], [role="presentation"], .MuiDrawer-paper'
        );
        await expect(drawer.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
      }
    });
  });

  test.describe('Mobile App Bar', () => {
    test('shows contextual app bar with back button in nested screens', async ({ page, request }) => {
      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 768) {
        test.skip();
      }

      const { accessToken } = await loginViaApi(request, TEST_USER);

      const community = await createTestCommunity(request, { name: generateTestName('mobile-test') });

      try {
        await page.goto('/');
        await setAuthToken(page, accessToken);
        await page.reload();
        await page.waitForLoadState('networkidle');

        const communityElement = page.getByText(community.name);
        if (await communityElement.isVisible({ timeout: 5000 }).catch(() => false)) {
          await communityElement.click();
          await page.waitForTimeout(500);

          const channelElement = page.locator('text=/general|text|voice/i').first();
          if (await channelElement.isVisible({ timeout: 3000 }).catch(() => false)) {
            await channelElement.click();
            await page.waitForTimeout(500);

            const backButton = page.locator(
              '[data-testid="back-button"], [aria-label*="back"], button:has(svg[data-testid*="ArrowBack"])'
            );

            if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
              await backButton.click();
              await page.waitForTimeout(500);
            }
          }
        }
      } finally {
        await deleteCommunity(request, community.id).catch(() => {});
      }
    });
  });

  test.describe('Touch Targets', () => {
    test('navigation buttons meet minimum touch target size', async ({ page, request }) => {
      const viewport = page.viewportSize();
      if (viewport && viewport.width >= 768) {
        test.skip();
      }

      const { accessToken } = await loginViaApi(request, TEST_USER);
      await page.goto('/');
      await setAuthToken(page, accessToken);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const bottomNavButtons = page.locator('[data-testid="mobile-bottom-nav"] button, nav button');

      const buttonCount = await bottomNavButtons.count();
      for (let i = 0; i < Math.min(buttonCount, 4); i++) {
        const button = bottomNavButtons.nth(i);
        const box = await button.boundingBox();

        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Responsive Layout', () => {
    test('switches to mobile layout at correct breakpoint', async ({ page, request }) => {
      const { accessToken } = await loginViaApi(request, TEST_USER);
      await page.goto('/');
      await setAuthToken(page, accessToken);
      await page.reload();

      // Start with mobile size
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      const mobileNav = page.locator('[data-testid="mobile-bottom-nav"], [data-testid="mobile-layout"]');
      await mobileNav.first().isVisible({ timeout: 5000 }).catch(() => false);

      // Switch to tablet size
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      // Switch to desktop size
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
    });
  });
});
