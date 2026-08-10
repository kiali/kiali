import { expect, type Page } from '@playwright/test';

type OpenShiftLoginOptions = {
  authProvider?: string;
  password: string;
  username: string;
};

/**
 * OpenShift OAuth login (htpasswd IdP). Follows cross-origin redirects natively.
 *
 * Prefer page.request (shares browser cookies) over the standalone request fixture,
 * which has no session and gets 401 on /api/status after login.
 */
export async function loginOpenShift(
  page: Page,
  { authProvider, password, username }: OpenShiftLoginOptions
): Promise<void> {
  if (!password) {
    throw new Error('Password is required for openshift auth. Set PLAYWRIGHT_PASSWD (or PASSWD).');
  }

  await page.goto('/');

  // IdP picker (multi-provider clusters)
  if (authProvider) {
    const idp = page.getByText(authProvider, { exact: true });
    if (await idp.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await idp.click();
    }
  }

  await page.locator('#inputUsername').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('#inputUsername').fill(username);
  await page.locator('#inputPassword').fill(password);
  await page.locator('button[type="submit"]').click();

  // Land back on Kiali console after OAuth redirect
  await expect(page).toHaveURL(/\/(console|kiali)/, { timeout: 120_000 });
  const status = await page.request.get('/api/status');
  expect(status.ok(), `Expected /api/status OK after openshift login, got ${status.status()}`).toBeTruthy();
}

export function playwrightCredentials(): {
  authProvider: string;
  password: string;
  username: string;
} {
  return {
    username: process.env.PLAYWRIGHT_USERNAME ?? process.env.USERNAME ?? 'jenkins',
    password: process.env.PLAYWRIGHT_PASSWD ?? process.env.PASSWD ?? '',
    authProvider: process.env.PLAYWRIGHT_AUTH_PROVIDER ?? process.env.AUTH_PROVIDER ?? ''
  };
}
