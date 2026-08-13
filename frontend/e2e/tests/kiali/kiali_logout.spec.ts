import { test } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';
import { loginOpenShift, playwrightCredentials } from '../../utils/openshift-auth';

/**
 * Logout must not use the shared auth.setup storageState: /api/logout invalidates
 * that session server-side and breaks later projects (e.g. core-caching) that reuse AUTH_FILE.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Kiali logout', () => {
  test('Kiali logout successfully @smoke @core-caching', async ({ overviewPage, page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Logout UI is openshift-only in Cypress');

    await loginOpenShift(page, playwrightCredentials());
    await overviewPage.open();
    await overviewPage.openUserDropdown();
    await overviewPage.logout();
  });
});
