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
  filterSpansByApp,
  openTracesTab,
  selectTrace,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('App details multi-cluster', () => {
  test.describe.configure({ timeout: 180_000 });

  test('See details for remote reviews app on west', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await expect(appDetailsPage.getBySel('app-resources-card')).toContainText('reviews-v1');
    await expectLinksContainCluster(page, WEST);
    await expectClusterBadge(page, WEST, 'App');
  });

  test('See traffic with cluster columns for west reviews', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await expectDetailsTrafficTab(page, { inboundListContent: /productpage/i });
    await expectTrafficClusterColumns(page);
  });

  test('See inbound metrics for west reviews', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await expectMetricsChartsLoaded(page, 'Inbound Metrics', '/api/namespaces/bookinfo/apps/reviews/dashboard');
  });

  test('See outbound metrics for west reviews', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await expectMetricsChartsLoaded(page, 'Outbound Metrics', '/api/namespaces/bookinfo/apps/reviews/dashboard');
  });

  test('See tracing info for west reviews', multiClusterOnly, async ({ appDetailsPage, page, request }) => {
    const traces = await waitForTracesViaApi(request, 'app', 'bookinfo', 'reviews', 0, 180_000, WEST);
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTrace(page, traces[0]?.traceID);
    await expectTraceDetails(page);
  });

  test('See span info for west reviews', multiClusterOnly, async ({ appDetailsPage, page, request }) => {
    const traces = await waitForTracesViaApi(request, 'app', 'bookinfo', 'reviews', 6, 180_000, WEST);
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 6, traces[0]?.traceID);
    await expectSpanDetails(page);
    await filterSpansByApp(page, 'productpage');
  });

  test('No traces for west details app', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'details', { clusterName: WEST });
    await expectNoTraces(page);
  });

  test('See details for east ratings app not deployed remotely', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'ratings', { clusterName: EAST });
    await expectLinksContainCluster(page, EAST);
    await expectClusterBadge(page, EAST, 'App');
  });

  test('Empty traffic for east ratings', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'ratings', { clusterName: EAST });
    await expectEmptyTrafficTab(page);
  });

  test('No inbound metrics data for east ratings', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'ratings', { clusterName: EAST });
    await expectMetricsChartsNoData(page, 'Inbound Metrics', '/api/namespaces/bookinfo/apps/ratings/dashboard');
  });

  test('No outbound metrics data for east ratings', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'ratings', { clusterName: EAST });
    await expectMetricsChartsNoData(page, 'Outbound Metrics', '/api/namespaces/bookinfo/apps/ratings/dashboard');
  });
});
