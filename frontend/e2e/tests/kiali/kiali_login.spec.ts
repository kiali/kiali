import { test, expect } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';
import { playwrightCredentials, submitOpenShiftLoginForm, loginOpenShift } from '../../utils/openshift-auth';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

/**
 * Login smoke tests need a clean browser context (no storageState from auth.setup).
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Kiali login', () => {
  test('Try to log in with an invalid username', smokeAndCoreCaching, async ({ page }) => {
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

  test('Try to log in with an invalid password', smokeAndCoreCaching, async ({ page }) => {
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

  test('Try to log in with a valid password', smokeAndCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Valid-login smoke requires openshift auth');

    const creds = playwrightCredentials();
    await loginOpenShift(page, creds);
    await expect(page).toHaveURL(/overview/, { timeout: 60_000 });
  });

  test('OpenShift login shows an error when the code exchange fails', smokeAndCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Code-exchange failure requires openshift auth');

    // The callback request is a redirect-following navigation, so route interception
    // never sees it and its query cannot be rewritten directly. Intercept the
    // credential POST instead and fulfill it with a redirect straight to the OAuth
    // redirect_uri carrying a corrupted authorization code, so Kiali's token
    // exchange fails. The state parameter is omitted: Kiali's callback only reads
    // the code and the nonce cookie.
    await page.route('**/*', async route => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch({ maxRedirects: 0 });
      const location = response.headers()['location'];
      if (!location) {
        await route.fulfill({ response });
        return;
      }
      const url = new URL(location, request.url());
      let callbackUrl: URL | undefined;
      if (url.pathname.endsWith('/api/auth/callback')) {
        // The IdP redirects straight back to the callback
        callbackUrl = url;
      } else {
        // OpenShift's IdP redirects back to its authorize endpoint first; the
        // callback URL is the redirect_uri it carries
        const redirectUri = url.searchParams.get('redirect_uri');
        if (redirectUri?.endsWith('/api/auth/callback')) {
          callbackUrl = new URL(redirectUri);
        }
      }
      if (callbackUrl) {
        callbackUrl.searchParams.set('code', 'invalidcode');
        await route.fulfill({ status: 302, headers: { location: callbackUrl.toString() }, body: '' });
        return;
      }
      await route.fulfill({ response });
    });

    await submitOpenShiftLoginForm(page, playwrightCredentials());

    await expect(page.getByText('Openshift authentication failed.')).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/openshift_error/, { timeout: 60_000 });
  });

  test('An expiring session should show a pop up to renew', smokeAndCoreCaching, async ({ page }) => {
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
