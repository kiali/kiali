import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { skipUnlessBookinfoTrafficUsesIngress } from '../../utils/trafficGenerator';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Service details core-caching', () => {
  test.beforeEach(async ({ serviceDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await serviceDetailsPage.open('bookinfo', 'productpage');
  });

  test('See details for productpage', coreCachingOnly, async ({ serviceDetailsPage }) => {
    await serviceDetailsPage.expectTabs('Overview', 'Traffic', 'Inbound Metrics', 'Traces');
    await serviceDetailsPage.expectServiceActionsMenu();
  });

  test('See details for service', coreCachingOnly, async ({ serviceDetailsPage }) => {
    await serviceDetailsPage.expectDetailsForService('productpage', 'v1');
    await serviceDetailsPage.expectResourcesCard();
    await serviceDetailsPage.expectNetworkCard();
    await serviceDetailsPage.expectIstioConfigCard();
    await serviceDetailsPage.expectLabelsCard();
    await serviceDetailsPage.expectAnnotationsCard();
  });

  test('See service Traffic information', coreCachingOnly, async ({ serviceDetailsPage }) => {
    test.setTimeout(180_000);
    skipUnlessBookinfoTrafficUsesIngress();
    await serviceDetailsPage.expectTrafficInformation();
  });

  test('See Inbound Metrics for productpage service details', coreCachingOnly, async ({ serviceDetailsPage }) => {
    await serviceDetailsPage.expectInboundMetricGraphs();
  });

  test(
    'See Graph data for productpage service details Inbound Metrics graphs',
    coreCachingOnly,
    async ({ serviceDetailsPage }) => {
      await serviceDetailsPage.expectInboundMetricGraphHasData('Request volume');
    }
  );
});
