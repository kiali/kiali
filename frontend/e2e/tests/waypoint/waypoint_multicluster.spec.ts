import { test } from '../../fixtures/kialiFixtures';
import { EAST, WEST } from '../../utils/multiCluster';
import {
  expectTraceDetails,
  expectTraceScatterplot,
  openTracesTab,
  selectTrace,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';
import { prepareBookinfoWaypointsMulticluster } from '../../utils/waypointHelpers';
import { waypointMulticlusterOnly } from '../../utils/suite-tags';

const BOOKINFO_WAYPOINTS_NS = 'bookinfo-waypoints';

test.describe('Waypoint multicluster (ambient multi-primary)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    // The setup chains four sequential helpers with 600s budgets each (healthy waypoints on
    // east and west, graph traffic, waypoint in both clusters) = 2400s worst case. Budget the
    // beforeAll above that sum so a slow helper's descriptive error surfaces instead of the
    // generic timeout cutting off the serial file.
    test.setTimeout(2400_000);
    await prepareBookinfoWaypointsMulticluster(request, BOOKINFO_WAYPOINTS_NS);
  });

  test(
    'Waypoint proxies are hidden by default and can be shown across clusters',
    waypointMulticlusterOnly,
    async ({ graphPage }) => {
      test.setTimeout(180_000);
      await graphPage.graphNamespaces(BOOKINFO_WAYPOINTS_NS);
      await graphPage.selectGraphType('WORKLOAD');
      await graphPage.expectNamespaceInSummaryPanel(BOOKINFO_WAYPOINTS_NS);
      await graphPage.expectWorkloadNodeExists('waypoint', false);

      await graphPage.openTrafficMenu();
      await graphPage.setTrafficOption('ambient', true);
      await graphPage.setTrafficOption('ambientTotal', true);
      await graphPage.closeTrafficMenu();

      await graphPage.openDisplayMenu();
      await graphPage.setDisplayOption('waypoint proxies', true);
      await graphPage.closeDisplayMenu();

      await graphPage.expectWaypointNodeInCluster('waypoint', EAST, BOOKINFO_WAYPOINTS_NS);
      await graphPage.expectWaypointNodeInCluster('waypoint', WEST, BOOKINFO_WAYPOINTS_NS);
      await graphPage.expectWorkloadClustersAtLeast(2);
    }
  );

  test('Verify L7 waypoint traffic across clusters', waypointMulticlusterOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces(BOOKINFO_WAYPOINTS_NS);
    await graphPage.selectGraphType('WORKLOAD');
    await graphPage.expectNamespaceInSummaryPanel(BOOKINFO_WAYPOINTS_NS);

    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('ambientWaypoint', true);
    await graphPage.closeTrafficMenu();

    await graphPage.expectTrafficEdgesAtLeast(7);
    await graphPage.expectTrafficFromClusters(EAST, WEST);
  });

  test(
    'productpage-v1 workload is enrolled in east cluster',
    waypointMulticlusterOnly,
    async ({ workloadDetailsPage }) => {
      await workloadDetailsPage.open(BOOKINFO_WAYPOINTS_NS, 'productpage-v1', { clusterName: EAST });
      await workloadDetailsPage.expectL7WaypointLink('waypoint');
    }
  );

  test('ratings-v1 workload is enrolled in west cluster', waypointMulticlusterOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open(BOOKINFO_WAYPOINTS_NS, 'ratings-v1', { clusterName: WEST });
    await workloadDetailsPage.expectL7WaypointLink('waypoint');
    await workloadDetailsPage.expectL7WaypointLinkPointsToCluster(WEST);
  });

  test(
    // Uses reviews-v1: an east-only workload in the bookinfo-waypoints split whose traces
    // proved stable under waypoint L7 attribution.
    'Traces for reviews-v1 in east cluster',
    waypointMulticlusterOnly,
    async ({ page, request, workloadDetailsPage }) => {
      test.setTimeout(240_000);
      const traces = await waitForTracesViaApi(
        request,
        'workload',
        BOOKINFO_WAYPOINTS_NS,
        'reviews-v1',
        0,
        180_000,
        EAST
      );
      await workloadDetailsPage.open(BOOKINFO_WAYPOINTS_NS, 'reviews-v1', { clusterName: EAST });
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await selectTrace(page, traces[0]?.traceID);
      await expectTraceDetails(page);
    }
  );
});
