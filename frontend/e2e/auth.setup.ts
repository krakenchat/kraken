import { test as setup } from '@playwright/test';
import { TEST_USER, loginViaApi, setAuthToken } from './fixtures';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page, request }) => {
  const { accessToken } = await loginViaApi(request, TEST_USER);
  await page.goto('/');
  await setAuthToken(page, accessToken);
  await page.context().storageState({ path: authFile });
});
