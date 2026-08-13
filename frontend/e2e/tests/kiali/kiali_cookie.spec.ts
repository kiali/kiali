import { test, expect } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

test.describe('Kiali login cookie', () => {
  test('Console is visible after login', smokeAndCoreCaching, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Cookie/console URL smoke is openshift-oriented in Cypress');

    await page.goto('/');
    await expect(page).toHaveURL(/console/, { timeout: 60_000 });
  });
});
