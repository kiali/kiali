import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { isOfflineProject } from '../../utils/projects';
import { coreCachingAndOffline, coreCachingOnly } from '../../utils/suite-tags';

test.describe('App details core-caching', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(async ({ appDetailsPage }) => {
    // Offline runs serve bookinfo from the must-gather; there may be no cluster to install into.
    if (!isOfflineProject(test.info())) {
      ensureDemoApp('bookinfo');
    }
    await appDetailsPage.openApp('bookinfo', 'details');
  });

  test('See details for app', coreCachingAndOffline, async ({ appDetailsPage }) => {
    await appDetailsPage.expectDetailsForApp('details');
    await appDetailsPage.expectResourcesCard();
  });

  test('See Inbound Metrics', coreCachingAndOffline, async ({ appDetailsPage }) => {
    await appDetailsPage.expectInboundMetrics();
  });

  test('See Outbound Metrics', coreCachingAndOffline, async ({ appDetailsPage }) => {
    await appDetailsPage.expectOutboundMetrics();
  });

  test('See app Traffic information', coreCachingOnly, async ({ appDetailsPage }) => {
    await appDetailsPage.expectTrafficInformation();
  });
});
