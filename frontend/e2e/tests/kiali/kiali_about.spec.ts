import { test, expect } from '../../fixtures/kialiFixtures';

const smokeCoreCaching = { tag: ['@smoke', '@core-caching'] as const };

test.describe('Kiali help about', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali about page', smokeCoreCaching, async ({ overviewPage, page }) => {
    await overviewPage.openHelpAndAbout();

    await expect(page.getByText('Kiali', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Kiali Container')).toBeVisible();
    await expect(page.getByText('Visit the Mesh page')).toBeVisible();
    await expect(page.locator('[href="https://www.kiali.io"]')).toHaveAttribute('href', 'https://www.kiali.io');
    await expect(page.locator('[href="https://github.com/kiali"]')).toHaveAttribute('href', 'https://github.com/kiali');
  });

  test('Verify version information is displayed correctly', smokeCoreCaching, async ({ overviewPage, page }) => {
    await overviewPage.openHelpAndAbout();

    const kialiVersion = page.getByTestId('kiali-version');
    await expect(kialiVersion).toBeVisible();
    await expect(kialiVersion).not.toBeEmpty();
    await expect(kialiVersion).not.toContainText('undefined');
    const versionText = (await kialiVersion.innerText()).trim();
    expect(versionText).not.toEqual('');
    expect(versionText).not.toEqual('unknown');
    expect(versionText).not.toEqual('null');
    expect(versionText.length).toBeGreaterThan(0);

    const containerVersion = page.getByTestId('kiali-container-version');
    await expect(containerVersion).toBeVisible();
    await expect(containerVersion).not.toBeEmpty();
    await expect(containerVersion).not.toContainText('undefined');
    const containerText = (await containerVersion.innerText()).trim();
    expect(containerText).not.toEqual('');
    expect(containerText).not.toEqual('unknown');
    expect(containerText).not.toEqual('null');
    expect(containerText.length).toBeGreaterThan(0);
  });
});
