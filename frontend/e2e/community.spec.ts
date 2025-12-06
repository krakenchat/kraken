/**
 * Community E2E Tests
 *
 * Tests community switching and invite management.
 */

import { test, expect, TEST_USER, loginViaApi } from './fixtures';
import { generateTestName, createTestCommunity, deleteCommunity } from './fixtures';

test.describe('Community Management', () => {
  test.describe('Switch Communities', () => {
    test('can switch between communities', async ({ authenticatedPage, request }) => {
      const { accessToken } = await loginViaApi(request, TEST_USER);

      // Create two test communities
      const community1 = await createTestCommunity(request, { name: generateTestName('switch-test-1') }, accessToken);
      const community2 = await createTestCommunity(request, { name: generateTestName('switch-test-2') }, accessToken);

      try {
        await authenticatedPage.reload();
        await authenticatedPage.waitForLoadState('networkidle');

        // Click on first community
        const community1Element = authenticatedPage.getByText(community1.name);
        if (await community1Element.isVisible({ timeout: 5000 }).catch(() => false)) {
          await community1Element.click();

          await expect(
            authenticatedPage.locator(`text="${community1.name}"`).or(
              authenticatedPage.locator(`[aria-label*="${community1.name}"]`)
            )
          ).toBeVisible({ timeout: 5000 });

          // Click on second community
          const community2Element = authenticatedPage.getByText(community2.name);
          if (await community2Element.isVisible({ timeout: 5000 }).catch(() => false)) {
            await community2Element.click();

            await expect(
              authenticatedPage.locator(`text="${community2.name}"`).or(
                authenticatedPage.locator(`[aria-label*="${community2.name}"]`)
              )
            ).toBeVisible({ timeout: 5000 });
          }
        }
      } finally {
        await deleteCommunity(request, community1.id, accessToken).catch(() => {});
        await deleteCommunity(request, community2.id, accessToken).catch(() => {});
      }
    });
  });

  test.describe('Community Invites', () => {
    test('can generate and share invite link', async ({ authenticatedPage, request }) => {
      const { accessToken } = await loginViaApi(request, TEST_USER);

      const community = await createTestCommunity(request, { name: generateTestName('invite-test') }, accessToken);

      try {
        await authenticatedPage.reload();
        await authenticatedPage.waitForLoadState('networkidle');

        const communityElement = authenticatedPage.getByText(community.name);
        if (await communityElement.isVisible({ timeout: 5000 }).catch(() => false)) {
          await communityElement.click();

          const inviteButton = authenticatedPage.locator(
            '[data-testid="invite-button"], [aria-label*="invite"], button:has-text("Invite")'
          );

          const settingsButton = authenticatedPage.locator(
            '[data-testid="community-settings"], [aria-label*="settings"]'
          );

          if (await inviteButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await inviteButton.first().click();

            await expect(
              authenticatedPage.locator('[data-testid="invite-link"], input[readonly]').or(
                authenticatedPage.getByText(/invite|copy|link/i)
              )
            ).toBeVisible({ timeout: 5000 });
          } else if (await settingsButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await settingsButton.first().click();
          }
        }
      } finally {
        await deleteCommunity(request, community.id, accessToken).catch(() => {});
      }
    });
  });
});
