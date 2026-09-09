import { test, expect } from '../../fixtures/kialiFixtures';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

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

  test(
    'Verify version information is displayed correctly',
    smokeAndCoreCaching,
    async ({ overviewPage, page, request }) => {
      const statusResponse = await request.get('/api/status');
      if (statusResponse.ok()) {
        const body = (await statusResponse.json()) as { status?: Record<string, string> };
        const coreVersion = body.status?.['Kiali version'] ?? '';
        if (!coreVersion || coreVersion === 'unknown') {
          test.skip(true, 'Kiali version is unknown in /api/status (typical for unversioned local dev builds)');
        }
      }

      await overviewPage.openHelpAndAbout();

      const assertVersionText = async (testId: string): Promise<void> => {
        const version = page.getByTestId(testId);
        await expect(version).toBeVisible();
        const text = (await version.textContent())?.trim() ?? '';
        expect(text).not.toBe('');
        expect(text).not.toBe('unknown');
        expect(text).not.toBe('null');
      };

      await assertVersionText('kiali-version');
      await assertVersionText('kiali-container-version');
    }
  );
});
