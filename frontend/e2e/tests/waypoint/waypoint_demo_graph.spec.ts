import { test } from '../../fixtures/kialiFixtures';
import { prepareBookinfoWaypoint } from '../../utils/waypointHelpers';
import { waypointOnly } from '../../utils/suite-tags';

/**
 * Demo-namespace waypoint graph matrix (install-waypoints.sh namespaces).
 * Shares ambient cluster readiness with the bookinfo suite.
 */
test.describe('Waypoint demo-namespace graph', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    test.setTimeout(900_000);
    await prepareBookinfoWaypoint(request);
  });

  test('differentns without waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-differentns');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-differentns');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('ambientTotal', true);
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', false);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.expectWorkloadNodeExists('echo-server', true);
    await graphPage.expectWorkloadNodeExists('curl-client', true);
  });

  test('differentns with waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-differentns');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-differentns');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(4);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
  });

  test('forall without waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-forall');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-forall');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', false);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.expectWorkloadNodeExists('echo-server', true);
    await graphPage.expectWorkloadNodeExists('curl-client', true);
  });

  test('forall with waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-forall');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-forall');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(4);
    await graphPage.expectWorkloadNodeExists('cgw', true);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
  });

  test('fornone without waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-fornone');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-fornone');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', false);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.expectWorkloadNodeExists('echo-server', true);
    await graphPage.expectWorkloadNodeExists('curl-client', true);
  });

  test('fornone with waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-fornone');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-fornone');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(0);
  });

  test('forservice without waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-forservice');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-forservice');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', false);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.expectWorkloadNodeExists('echo-server', true);
    await graphPage.expectWorkloadNodeExists('curl-client', true);
  });

  test('forservice with waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-forservice');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-forservice');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(4);
    await graphPage.expectWorkloadNodeExists('waypoint', true);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
  });

  test('forworkload without waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-forworkload');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-forworkload');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', false);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(1);
    await graphPage.expectServiceNodeExists('unknown', true);
    await graphPage.expectWorkloadNodeExists('curl-client', true);
  });

  test('forworkload with waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-forworkload');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-forworkload');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(3);
    await graphPage.expectWorkloadNodeExists('bwaypoint', true);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
  });

  test('override without waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-override');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-override');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', false);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.expectWorkloadNodeExists('echo-server', true);
    await graphPage.expectWorkloadNodeExists('curl-client', true);
  });

  test('override with waypoint proxies', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('waypoint-override');
    await graphPage.expectNamespaceInSummaryPanel('waypoint-override');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.expectTrafficEdgesAtLeast(4);
    await graphPage.expectWorkloadNodeExists('use-this', true);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
  });
});
