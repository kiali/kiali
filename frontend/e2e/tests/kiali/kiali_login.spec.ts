import { test, expect } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';
import { playwrightCredentials, submitOpenShiftLoginForm, loginOpenShift } from '../../utils/openshift-auth';

/**
 * Login smoke tests need a clean browser context (no storageState from auth.setup).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const smokeCoreCaching = { tag: ['@smoke', '@core-caching'] as const };

test.describe('Kiali login', () => {
  test('Try to log in with an invalid username', smokeCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Invalid-login smoke requires openshift auth');

    const { authProvider, password } = playwrightCredentials();
    await submitOpenShiftLoginForm(page, {
      authProvider,
      username: 'foobar',
      password
    });
    await expect(page.getByText('Invalid login or password. Please try again.')).toBeVisible({
      timeout: 60_000
    });
  });

  test('Try to log in with an invalid password', smokeCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Invalid-login smoke requires openshift auth');

    const { authProvider, username, password } = playwrightCredentials();
    await submitOpenShiftLoginForm(page, {
      authProvider,
      username,
      password: `${password.toLowerCase()}123456`
    });
    await expect(page.getByText('Invalid login or password. Please try again.')).toBeVisible({
      timeout: 60_000
    });
  });

  test('Try to log in with a valid password', smokeCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Valid-login smoke requires openshift auth');

    const creds = playwrightCredentials();
    await loginOpenShift(page, creds);
    await expect(page).toHaveURL(/overview/, { timeout: 60_000 });
  });

  test('An expiring session should show a pop up to renew', smokeCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy === 'anonymous', 'Session timeout requires a login-based auth strategy');

    // Authenticate first (empty storageState for this file)
    if (strategy === 'openshift') {
      await loginOpenShift(page, playwrightCredentials());
    } else {
      await page.goto('/console/overview?refresh=0');
    }

    await page.route('**/api/auth/info', async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = await response.json();
      body.sessionInfo = {
        ...(body.sessionInfo ?? {}),
        expiresOn: new Date(Date.now() + 10_000).toISOString()
      };
      await route.fulfill({ response, json: body });
    });

    await page.goto('/');
    await expect(page.getByTestId('session-timeout-modal')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('session-timeout-logout-btn').click();
  });
});
