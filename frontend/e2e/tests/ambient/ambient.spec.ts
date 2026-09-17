import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { selectNamespace } from '../../utils/namespace';
import { ambientOnly } from '../../utils/suite-tags';

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

  test('User sees tcp traffic', ambientOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo', '0', '600s');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficVisible('tcp');
    await graphPage.expectTrafficProtocol('http', false);
    await graphPage.expectSummaryPanelTrafficRate('TCP');
  });

  test('User sees http traffic', ambientOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo', '0', '600s');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('tcp', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficVisible('http');
    await graphPage.expectTrafficProtocol('tcp', false);
    await graphPage.expectSummaryPanelTrafficRate('HTTP');
  });

  test('Filter services table by health', ambientOnly, async ({ page, servicesPage }) => {
    ensureDemoApp('bookinfo');
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Health', 'Healthy');
    await servicesPage.expectServicesInTable('something');
    await servicesPage.expectOnlyHealthyServices();
  });

  test('Out of mesh', ambientOnly, async ({ page, workloadsPage }) => {
    ensureDemoApp('sleep');
    await workloadsPage.openList();
    await selectNamespace(page, 'sleep');
    await workloadsPage.expectTextInTable('Out of mesh');
  });

  test('See ambient label for workload', ambientOnly, async ({ workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await workloadDetailsPage.expectAmbientBadge();
    await workloadDetailsPage.expectMissingSidecarBadge(false, 'bookinfo', 'details-v1');
  });
});
