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
  expectTraceScatterplot,
  filterSpansByWorkload,
  openTracesTab,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('Workload details multi-cluster', () => {
  test.describe.configure({ timeout: 180_000 });

  test('See details for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await expect(workloadDetailsPage.getBySel('workload-resources-card')).toBeVisible();
    await expectLinksContainCluster(page, WEST);
    await expectClusterBadge(page, WEST);
  });

  test(
    'See traffic with cluster columns for west reviews-v2',
    multiClusterOnly,
    async ({ workloadDetailsPage, page }) => {
      await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
      await expectDetailsTrafficTab(page);
      await expectTrafficClusterColumns(page);
    }
  );

  test('See inbound metrics for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await expectMetricsChartsLoaded(page, 'Inbound Metrics', '/api/namespaces/bookinfo/workloads/reviews-v2/dashboard');
  });

  test('See outbound metrics for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await expectMetricsChartsLoaded(
      page,
      'Outbound Metrics',
      '/api/namespaces/bookinfo/workloads/reviews-v2/dashboard'
    );
  });

  test('See span info for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage, page, request }) => {
    const traces = await waitForTracesViaApi(request, 'workload', 'bookinfo', 'reviews-v2', 6, 180_000, WEST);
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 6, traces[0]?.traceID);
    await expectSpanDetails(page);
    await filterSpansByWorkload(page, 'details-v1');
  });

  test('No traces for west reviews-v3', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v3', { clusterName: WEST });
    await expectNoTraces(page);
  });

  test('See Envoy clusters for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.filterEnvoyTab('Port', '9080', 'Clusters');
    await workloadDetailsPage.expectClustersTable();
  });

  test('See Envoy listeners for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.filterEnvoyTab('Destination', 'Route: 9090', 'Listeners');
    await workloadDetailsPage.expectListenersTable();
  });

  test('See Envoy routes for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.filterEnvoyTab('Domains', 'details', 'Routes');
    await workloadDetailsPage.expectRoutesTable();
  });

  test('See Envoy bootstrap for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.openBootstrapTab();
    await workloadDetailsPage.expectBootstrapEditor();
  });

  test('See Envoy config for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.openConfigTab();
    await workloadDetailsPage.expectConfigEditor();
  });

  test('See Envoy metrics tab for west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.expectEnvoyMetrics();
  });

  test(
    'See details for east ratings-v1 not present remotely',
    multiClusterOnly,
    async ({ workloadDetailsPage, page }) => {
      await workloadDetailsPage.open('bookinfo', 'ratings-v1', { clusterName: EAST });
      await expectLinksContainCluster(page, EAST);
      await expectClusterBadge(page, EAST);
    }
  );

  test('Empty traffic for east ratings-v1', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'ratings-v1', { clusterName: EAST });
    await expectEmptyTrafficTab(page);
  });

  test('No inbound metrics data for east ratings-v1', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'ratings-v1', { clusterName: EAST });
    await expectMetricsChartsNoData(page, 'Inbound Metrics', '/api/namespaces/bookinfo/workloads/ratings-v1/dashboard');
  });

  test('No outbound metrics data for east ratings-v1', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'ratings-v1', { clusterName: EAST });
    await expectMetricsChartsNoData(
      page,
      'Outbound Metrics',
      '/api/namespaces/bookinfo/workloads/ratings-v1/dashboard'
    );
  });

  test('Envoy tab hidden for east ratings-v1', multiClusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'ratings-v1', { clusterName: EAST });
    await workloadDetailsPage.expectEnvoyTabVisible(false);
  });
});
