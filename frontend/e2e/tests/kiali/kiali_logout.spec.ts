import { test } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';

test.describe('Kiali logout', () => {
  test('Kiali logout successfully @smoke @core-caching', async ({ overviewPage, page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Logout UI is openshift-only in Cypress');

    await overviewPage.open();
    await overviewPage.openUserDropdown();
    await overviewPage.logout();
  });
});
