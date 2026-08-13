import { test, expect } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';

test.describe('Kiali login cookie', () => {
  test('Console is visible after login', { tag: ['@smoke', '@core-caching'] }, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Cookie/console URL smoke is openshift-oriented in Cypress');

    await page.goto('/');
    await expect(page).toHaveURL(/console/, { timeout: 60_000 });
  });
});
