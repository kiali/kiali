import { test, expect } from '../../fixtures/kialiFixtures';
import { gotoConsolePage } from '../../utils/navigation';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Manual Refresh option', () => {
  test('Overview page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'overview', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });

  test('Namespaces page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'namespaces', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });

  test('Graph page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'graph/namespaces', { namespaces: 'bookinfo', refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });

  test('Applications page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'applications', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });

  test('Services page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'services', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });

  test('Workloads page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'workloads', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });

  test('Istio page does not show manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'istio', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toHaveCount(0);
  });

  test('Mesh page shows manual', coreCachingOnly, async ({ page }) => {
    await gotoConsolePage(page, 'mesh', { refresh: '1' });
    await expect(page.getByTestId('manual-refresh')).toBeVisible();
  });
});
