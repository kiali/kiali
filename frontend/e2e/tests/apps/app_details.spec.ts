import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('App details core-caching', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(async ({ appDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await appDetailsPage.openApp('bookinfo', 'details');
  });

  test('See details for app', coreCachingOnly, async ({ appDetailsPage }) => {
    await appDetailsPage.expectDetailsForApp('details');
    await appDetailsPage.expectResourcesCard();
  });

  test('See Inbound Metrics', coreCachingOnly, async ({ appDetailsPage }) => {
    await appDetailsPage.expectInboundMetrics();
  });

  test('See Outbound Metrics', coreCachingOnly, async ({ appDetailsPage }) => {
    await appDetailsPage.expectOutboundMetrics();
  });

  test('See app Traffic information', coreCachingOnly, async ({ appDetailsPage }) => {
    await appDetailsPage.expectTrafficInformation();
  });
});
