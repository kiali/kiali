import { test } from '../../fixtures/kialiFixtures';
import { prepareBookinfoWaypoint, waitForSidecarAmbientGraphTraffic } from '../../utils/waypointHelpers';
import { waypointOnly } from '../../utils/suite-tags';

test.describe('Waypoint sidecar ambient', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    test.setTimeout(900_000);
    await prepareBookinfoWaypoint(request);
    await waitForSidecarAmbientGraphTraffic(request);
  });

  test('Sidecar Ambient traffic graph', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('test-ambient,test-sidecar');
    await graphPage.expectNamespaceInSummaryPanel('test-ambient');
    await graphPage.expectNamespaceInSummaryPanel('test-sidecar');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', true);
    await graphPage.closeTrafficMenu();
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('security', true);
    await graphPage.expectTrafficEdgesAtLeast(8);
    await graphPage.expectSecurity('appears');
    await graphPage.closeDisplayMenu();
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(4);
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('tcp', false);
    await graphPage.expectTrafficEdgesAtLeast(4);
    await graphPage.closeTrafficMenu();
  });

  test(
    'Sidecar and Ambient workloads with same name have no config issues',
    waypointOnly,
    async ({ workloadDetailsPage }) => {
      await workloadDetailsPage.open('test-sidecar', 'curl-client');
      await workloadDetailsPage.expectNoConfigIssues();
      await workloadDetailsPage.open('test-ambient', 'curl-client');
      await workloadDetailsPage.expectNoConfigIssues();
    }
  );

  test('Add to Ambient in the test-sidecar namespace', waypointOnly, async ({ namespaceDetailPage }) => {
    test.setTimeout(240_000);
    await namespaceDetailPage.open('test-sidecar');
    await namespaceDetailPage.expectActionAbsent('Add to Ambient');
    await namespaceDetailPage.removeNamespaceInjection();
    await namespaceDetailPage.expectNamespaceLabel('istio-injection');
    await namespaceDetailPage.clickAmbientAction('add');
    await namespaceDetailPage.expectNamespaceLabel('istio.io/dataplane-mode', 'ambient');
    await namespaceDetailPage.clickAmbientAction('remove');
    await namespaceDetailPage.enableNamespaceInjection();
    await namespaceDetailPage.expectNamespaceLabel('istio-injection', 'enabled');
  });
});
