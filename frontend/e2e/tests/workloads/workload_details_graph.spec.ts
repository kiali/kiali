import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Workload details graph core-caching', () => {
  test.beforeEach(async ({ workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.open('bookinfo', 'details-v1');
  });

  test('See minigraph for workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.expectMinigraphVisible();
  });
});
