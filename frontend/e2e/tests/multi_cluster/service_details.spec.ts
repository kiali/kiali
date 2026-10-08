import { expect, test } from '../../fixtures/kialiFixtures';
import {
  expectClusterBadge,
  expectEmptyTrafficTab,
  expectLinksContainCluster,
  expectMetricsChartsLoaded,
  expectMetricsChartsNoData,
  expectNoTraces,
  expectTrafficClusterColumns
} from '../../utils/detailsPage';
import { expectDetailsTrafficTab } from '../../utils/detailsTraffic';
import { EAST, WEST } from '../../utils/multiCluster';
import { multiClusterOnly } from '../../utils/suite-tags';
import {
  expectSpanDetails,
  expectTraceDetails,
  expectTraceScatterplot,
  openTracesTab,
  selectTrace,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('Service details multi-cluster', () => {
  test.describe.configure({ timeout: 180_000 });

  test('See details for west ratings service', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
    await expect(serviceDetailsPage.getBySel('service-resources-card')).toBeVisible();
    await expectLinksContainCluster(page, WEST);
    await expectClusterBadge(page, WEST, 'Service');
  });

  test('See traffic with cluster columns for west ratings', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
    await expectDetailsTrafficTab(page, { requireBothTrafficGrids: true, scopeInboundToTrafficCard: true });
    await expectTrafficClusterColumns(page);
  });

  test('See inbound metrics for west ratings', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
    await expectMetricsChartsLoaded(page, 'Inbound Metrics', '/api/namespaces/bookinfo/services/ratings/dashboard');
  });

  test('See tracing info for west ratings', multiClusterOnly, async ({ serviceDetailsPage, page, request }) => {
    const traces = await waitForTracesViaApi(request, 'service', 'bookinfo', 'ratings', 0, 180_000, WEST);
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTrace(page, traces[0]?.traceID);
    await expectTraceDetails(page);
  });

  test('See span info for west ratings', multiClusterOnly, async ({ serviceDetailsPage, page, request }) => {
    const traces = await waitForTracesViaApi(request, 'service', 'bookinfo', 'ratings', 6, 180_000, WEST);
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 6, traces[0]?.traceID);
    await expectSpanDetails(page);
  });

  test('No traces for west productpage service', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'productpage', { clusterName: WEST });
    await expectNoTraces(page);
  });

  test(
    'See details for east ratings service not present remotely',
    multiClusterOnly,
    async ({ serviceDetailsPage, page }) => {
      await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: EAST });
      await expectLinksContainCluster(page, EAST);
      await expectClusterBadge(page, EAST, 'Service');
    }
  );

  test('Empty traffic for east ratings service', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: EAST });
    await expectEmptyTrafficTab(page);
  });

  test('No inbound metrics data for east ratings service', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: EAST });
    await expectMetricsChartsNoData(page, 'Inbound Metrics', '/api/namespaces/bookinfo/services/ratings/dashboard');
  });
});
