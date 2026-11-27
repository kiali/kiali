import { test, expect } from '../../fixtures/kialiFixtures';
import { smokeAndCoreCaching } from '../../utils/suite-tags';
import { kialiUrl } from '../../utils/kialiUrl';

test.describe('Kiali help about', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali about page', smokeAndCoreCaching, async ({ overviewPage, page }) => {
    await overviewPage.openHelpAndAbout();

    await expect(page.getByText('Kiali', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Kiali Container')).toBeVisible();
    await expect(page.getByText('Visit the Mesh page')).toBeVisible();
    await expect(page.locator('[href="https://www.kiali.io"]')).toHaveAttribute('href', 'https://www.kiali.io');
    await expect(page.locator('[href="https://github.com/kiali"]')).toHaveAttribute('href', 'https://github.com/kiali');
  });

  test('Verify version information is displayed correctly', smokeAndCoreCaching, async ({ overviewPage, page }) => {
    // Use page.request (shares the page context's cookies) so the check works under cookie auth.
    const statusResponse = await page.request.get(kialiUrl('/api/status'));
    if (statusResponse.ok()) {
      const body = (await statusResponse.json()) as { status?: Record<string, string> };
      const coreVersion = body.status?.['Kiali version'] ?? '';
      if (!coreVersion || coreVersion === 'unknown') {
        test.skip(true, 'Kiali version is unknown in /api/status (typical for unversioned local dev builds)');
      }
    }

    await overviewPage.openHelpAndAbout();

    await expect(page.getByTestId('kiali-version')).toHaveText(/^v?\d+\.\d+\.\d+/);
    // The container version is the image name (e.g. kiali:2.31.0-SNAPSHOT), so the version is
    // embedded in a longer string — match unanchored.
    await expect(page.getByTestId('kiali-container-version')).toHaveText(/v?\d+\.\d+\.\d+/);
  });
});
