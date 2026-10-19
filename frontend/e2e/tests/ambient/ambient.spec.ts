import { test } from '../../fixtures/kialiFixtures';
import { waitForAnyServiceHealthStatus } from '../../utils/health';
import { ambientAndOffline, ambientOnly } from '../../utils/suite-tags';

test.describe('Ambient mesh', () => {
  test('Ambient badge is visible on namespaces list', ambientOnly, async ({ namespacesPage }) => {
    await namespacesPage.openList();
    await namespacesPage.expectNamespaceVisible('istio-system');
    await namespacesPage.expectBadgeOnNamespace('istio-system', 'Ambient');
  });

  test('Open traffic dropdown for ambient', ambientOnly, async ({ graphPage }) => {
    await graphPage.graphNamespaces('');
    await graphPage.openTrafficMenu();
    await graphPage.expectTrafficMenuVisible();
  });

  test('Close traffic dropdown for ambient', ambientOnly, async ({ graphPage }) => {
    await graphPage.graphNamespaces('');
    await graphPage.openTrafficMenu();
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficMenuHidden();
  });

  test('User sees tcp traffic', ambientAndOffline, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo', '0', '600s');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    // At least 6 edges with traffic when HTTP is disabled.
    await graphPage.expectTrafficEdgesAtLeast(6);
    await graphPage.expectTrafficProtocol('http', false);
    await graphPage.expectSummaryPanelTrafficRate('TCP');
  });

  test('User sees http traffic', ambientAndOffline, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo', '0', '600s');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('tcp', false);
    await graphPage.closeTrafficMenu();
    // At least 2 edges with traffic when TCP is disabled.
    await graphPage.expectTrafficEdgesAtLeast(2);
    await graphPage.expectTrafficProtocol('tcp', false);
    await graphPage.expectSummaryPanelTrafficRate('HTTP');
  });

  test('Filter services table by health', ambientOnly, async ({ request, servicesPage }) => {
    test.setTimeout(240_000);
    // The Healthy filter only needs one healthy row, so wait for whichever bookinfo service
    // settles first. productpage takes the external traffic and can sit in Degraded while
    // generator errors age out of the health rate window.
    await waitForAnyServiceHealthStatus(
      request,
      'bookinfo',
      ['details', 'ratings', 'reviews', 'productpage'],
      'Healthy',
      180_000
    );
    await servicesPage.openListWithNamespace('bookinfo');
    await servicesPage.filterBy('Health', 'Healthy');
    await servicesPage.expectServicesInTable('something');
    await servicesPage.expectOnlyHealthyServices();
  });

  test('Out of mesh', ambientOnly, async ({ workloadsPage }) => {
    await workloadsPage.openListWithNamespace('sleep');
    await workloadsPage.expectTextInTable('Out of mesh');
  });

  test('See ambient label for workload', ambientOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await workloadDetailsPage.expectAmbientBadge();
    await workloadDetailsPage.expectMissingSidecarBadge(false, 'bookinfo', 'details-v1');
  });

  test('The logs tab should show the ztunnel logs for a pod', ambientOnly, async ({ workloadDetailsPage }) => {
    // Wider duration so sparse ztunnel lines are present (default Last 1m is often empty).
    await workloadDetailsPage.openLogsTab('bookinfo', 'ratings-v1');
    await workloadDetailsPage.expectContainerListed('ztunnel');
    await workloadDetailsPage.expectContainerListed('ratings');
    await workloadDetailsPage.selectContainer('ztunnel-ratings', { bodyMustInclude: 'ztunnel' });
    await workloadDetailsPage.expectContainerChecked('ztunnel-ratings');
    await workloadDetailsPage.expectContainerChecked('container-ratings');
    await workloadDetailsPage.expectPodSelected('ratings-v1');
    await workloadDetailsPage.expectSomeLogLinesContain('ztunnel');
  });
});
