import { test, expect } from '../../fixtures/kialiFixtures';

/**
 * Migrated from cypress/integration/featureFiles/kiali_about.feature (@smoke).
 * Feature is @skip-ossmc in Cypress — keep that in mind for OSSMC suites.
 */
test.describe('Kiali help about', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali about page @smoke @core-caching', async ({ overviewPage, page }) => {
    await overviewPage.openHelpAndAbout();

    await expect(page.getByText('Kiali', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Kiali Container')).toBeVisible();
    await expect(page.getByText('Visit the Mesh page')).toBeVisible();
    await expect(page.locator('[href="https://www.kiali.io"]')).toHaveAttribute('href', 'https://www.kiali.io');
    await expect(page.locator('[href="https://github.com/kiali"]')).toHaveAttribute('href', 'https://github.com/kiali');
  });

  test('Verify version information is displayed correctly @smoke @core-caching', async ({ overviewPage, page }) => {
    await overviewPage.openHelpAndAbout();

    const kialiVersion = page.getByTestId('kiali-version');
    await expect(kialiVersion).toBeVisible();
    const versionText = (await kialiVersion.innerText()).trim();
    expect(versionText).not.toEqual('');
    expect(versionText).not.toEqual('undefined');
    expect(versionText).not.toEqual('unknown');
    expect(versionText).not.toEqual('null');
    expect(versionText.length).toBeGreaterThan(0);

    const containerVersion = page.getByTestId('kiali-container-version');
    await expect(containerVersion).toBeVisible();
    const containerText = (await containerVersion.innerText()).trim();
    expect(containerText).not.toEqual('');
    expect(containerText).not.toEqual('undefined');
    expect(containerText).not.toEqual('unknown');
    expect(containerText).not.toEqual('null');
    expect(containerText.length).toBeGreaterThan(0);
  });
});
