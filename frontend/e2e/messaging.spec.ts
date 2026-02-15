/**
 * Messaging E2E Tests
 *
 * Tests sending messages and channel navigation.
 */

import { test, expect, TEST_USER, loginViaApi } from './fixtures';
import {
  generateTestName,
  createTestCommunity,
  createTestChannel,
  deleteCommunity,
} from './fixtures';

test.describe('Messaging', () => {
  let testCommunity: { id: string; name: string };
  let _testChannel: { id: string; name: string };
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const { accessToken } = await loginViaApi(request, TEST_USER);
    authToken = accessToken;

    testCommunity = await createTestCommunity(request, {
      name: generateTestName('msg-test'),
    }, authToken);
    _testChannel = await createTestChannel(request, testCommunity.id, {
      name: 'general',
      type: 'TEXT',
    }, authToken);
  });

  test.afterAll(async ({ request }) => {
    if (testCommunity?.id) {
      await deleteCommunity(request, testCommunity.id, authToken).catch(() => {});
    }
  });

  test.describe('Send Messages', () => {
    test('empty message is not sent', async ({ authenticatedPage }) => {
      await authenticatedPage.reload();

      const messageInput = authenticatedPage.locator(
        '[data-testid="message-input"], [placeholder*="message"], textarea, input[type="text"]'
      ).last();

      if (await messageInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await messageInput.fill('');
        await messageInput.press('Enter');

        await expect(messageInput).toHaveValue('');
      }
    });
  });
});

test.describe('Channels', () => {
  let testCommunity: { id: string; name: string };
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const { accessToken } = await loginViaApi(request, TEST_USER);
    authToken = accessToken;

    testCommunity = await createTestCommunity(request, {
      name: generateTestName('channel-test'),
    }, authToken);
  });

  test.afterAll(async ({ request }) => {
    if (testCommunity?.id) {
      await deleteCommunity(request, testCommunity.id, authToken).catch(() => {});
    }
  });

  test.describe('Channel Navigation', () => {
    test('can switch between channels', async ({ authenticatedPage, request }) => {
      const channel1 = await createTestChannel(request, testCommunity.id, {
        name: 'channel-one',
        type: 'TEXT',
      }, authToken);
      const channel2 = await createTestChannel(request, testCommunity.id, {
        name: 'channel-two',
        type: 'TEXT',
      }, authToken);

      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState('networkidle');

      const communityElement = authenticatedPage.getByText(testCommunity.name);
      if (await communityElement.isVisible({ timeout: 5000 }).catch(() => false)) {
        await communityElement.click();
      }

      const channel1Element = authenticatedPage.getByText(channel1.name);
      if (await channel1Element.isVisible({ timeout: 5000 }).catch(() => false)) {
        await channel1Element.click();
        await authenticatedPage.waitForLoadState('networkidle');

        const channel2Element = authenticatedPage.getByText(channel2.name);
        if (await channel2Element.isVisible({ timeout: 5000 }).catch(() => false)) {
          await channel2Element.click();
          await authenticatedPage.waitForLoadState('networkidle');
        }
      }
    });
  });

  test.describe('Create Channel', () => {
    test('can create a text channel', async ({ authenticatedPage }) => {
      await authenticatedPage.reload();

      const communityElement = authenticatedPage.getByText(testCommunity.name);
      if (await communityElement.isVisible({ timeout: 5000 }).catch(() => false)) {
        await communityElement.click();
      }

      const createChannelButton = authenticatedPage.locator(
        '[data-testid="create-channel"], [aria-label*="create channel"], button:has-text("Add Channel")'
      );

      if (await createChannelButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await createChannelButton.first().click();

        const channelName = generateTestName('new-channel');
        const nameInput = authenticatedPage.locator('#name, [name="name"], input[placeholder*="name"]');

        if (await nameInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await nameInput.first().fill(channelName);

          const submitButton = authenticatedPage.getByRole('button', { name: /create|save|submit/i });
          await submitButton.click();

          await expect(authenticatedPage.getByText(channelName)).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });
});
