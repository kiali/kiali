import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { tracingOnly } from '../../utils/suite-tags';
import { waitForLoadingComplete } from '../../utils/transition';

test.describe('Graph side panel tracing', () => {
  test.describe.configure({ timeout: 180_000 });

  test('Traces tab contains traces', tracingOnly, async ({ graphPage, page }) => {
    ensureDemoApp('bookinfo');
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.clickGraphNode('reviews', 'service');
    await expect(page.locator('#pfbadge-S')).toBeVisible();
    await page.locator('#graph_summary_tabs').getByText('Traces').click();
    await waitForLoadingComplete(page);
    await expect(page.getByTestId('traces-list')).toBeVisible({ timeout: 60_000 });
  });
});
