import { test } from '../../fixtures/kialiFixtures';
import { offlineOnly } from '../../utils/suite-tags';

test.describe('Kiali offline mode status', () => {
  test('Offline status icon is visible in offline mode', offlineOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.expectOfflineStatusVisible();
  });

  test('Minigraph displays offline on workload details page', offlineOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await workloadDetailsPage.expectMinigraphOffline();
  });
});
