import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { core1, smokeAndCore1 } from '../../utils/suite-tags';

test.describe('Kiali appearance settings', () => {
  test.beforeEach(async ({ overviewPage, appearancePage }) => {
    await overviewPage.open();
    await appearancePage.resetToDefaults();
  });

  test('User can switch between light and dark color schemes', smokeAndCore1, async ({
    page,
    appearancePage
  }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/pf-v6-theme-dark/);

    await appearancePage.selectColorScheme('Dark');
    await expect(html).toHaveClass(/pf-v6-theme-dark/);

    await appearancePage.selectColorScheme('Light');
    await expect(html).not.toHaveClass(/pf-v6-theme-dark/);
  });

  test('User can switch contrast modes', core1, async ({ page, appearancePage }) => {
    const html = page.locator('html');

    await appearancePage.selectContrastMode('Glass');
    await expect(html).toHaveClass(/pf-v6-theme-glass/);
    await expect(html).not.toHaveClass(/pf-v6-theme-high-contrast/);

    await appearancePage.selectContrastMode('High contrast');
    await expect(html).toHaveClass(/pf-v6-theme-high-contrast/);
    await expect(html).not.toHaveClass(/pf-v6-theme-glass/);

    await appearancePage.selectContrastMode('Default');
    await expect(html).not.toHaveClass(/pf-v6-theme-glass/);
    await expect(html).not.toHaveClass(/pf-v6-theme-high-contrast/);
  });

  test('User can switch between default and project felt themes', core1, async ({ page, appearancePage }) => {
    const html = page.locator('html');

    await appearancePage.selectTheme('Project Felt');
    await expect(html).toHaveClass(/pf-v6-theme-felt/);

    await appearancePage.selectTheme('Default');
    await expect(html).not.toHaveClass(/pf-v6-theme-felt/);
  });
});
