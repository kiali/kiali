import { expect } from '@playwright/test';
import { test } from '../../fixtures/kialiFixtures';
import { expectColumnTextOnRow, expectHealthIconInRow, getColWithRowText } from '../../utils/table';
import { linkSelector } from '../../utils/linkSelector';
import {
  enableUseWaypointNameIfNeeded,
  prepareBookinfoWaypoint,
  waitForZtunnelWorkloadReady
} from '../../utils/waypointHelpers';
import {
  expectTraceDetails,
  expectTraceScatterplot,
  openTracesTab,
  selectTrace,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';
import { openDetailsTab } from '../../utils/detailsPage';
import { waypointOnly } from '../../utils/suite-tags';

test.describe('Waypoint (bookinfo)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    test.setTimeout(900_000);
    await prepareBookinfoWaypoint(request);
  });

  test('Setup: namespace labeled and use_waypoint_name if needed', waypointOnly, async ({ request }) => {
    test.setTimeout(300_000);
    await enableUseWaypointNameIfNeeded(request, 'bookinfo');
  });

  test('Workload list shows waypoint proxy row', waypointOnly, async ({ page, workloadsPage }) => {
    await workloadsPage.openListWithNamespace('bookinfo');
    await expect(page.locator('tbody').getByRole('row').filter({ hasText: 'waypoint' })).toBeVisible();
    await expectHealthIconInRow(page, 'waypoint');

    const labels = getColWithRowText(page, 'waypoint', 'Labels');
    await expect(labels).toContainText('gateway.istio.io/managed=istio.io-mesh-controller');
    await expect(labels).toContainText('gateway.networking.k8s.io/gateway-name=waypoint');
    await expect(getColWithRowText(page, 'waypoint', 'Type')).toContainText('Deployment');

    const details = getColWithRowText(page, 'waypoint', 'Details');
    await expect(details).toContainText('Waypoint Proxy');
    await expect(
      details.locator(linkSelector('bookinfo/istio/gateway.networking.k8s.io/v1/Gateway/waypoint', 'endsWith'))
    ).toBeVisible();
  });

  test('Ratings workload is enrolled in waypoint', waypointOnly, async ({ page, request, workloadDetailsPage }) => {
    test.setTimeout(240_000);
    await workloadDetailsPage.open('bookinfo', 'ratings-v1');
    await workloadDetailsPage.expectAmbientBadge();
    await workloadDetailsPage.expectMissingSidecarBadge(false, 'bookinfo', 'ratings-v1');
    await workloadDetailsPage.expectModeInPopover('L4', 'L7');
    await workloadDetailsPage.expectProtocolInPodPopover('HBONE');

    const traces = await waitForTracesViaApi(request, 'workload', 'bookinfo', 'ratings-v1');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTrace(page, traces[0]?.traceID);
    await expectTraceDetails(page);

    await openDetailsTab(page, 'Overview');
    await workloadDetailsPage.expectL7WaypointLink('waypoint');
    await workloadDetailsPage.clickL7WaypointLink('waypoint');
    await expect(page).toHaveURL(/\/workloads\/waypoint/);
  });

  test('Waypoint workload details are valid', waypointOnly, async ({ workloadDetailsPage }) => {
    test.setTimeout(180_000);
    await workloadDetailsPage.open('bookinfo', 'waypoint');
    await workloadDetailsPage.expectWaypointAttribute();
    await workloadDetailsPage.expectMissingSidecarBadge(false, 'bookinfo', 'waypoint');
    await workloadDetailsPage.expectProxyStatusWithDetail('info', 'RDS: IGNORED');
    await workloadDetailsPage.expectIstioConfigEntry('K8sGateway-bookinfo-waypoint', 'pfbadge-G');
    await workloadDetailsPage.openBootstrapTab();
    await workloadDetailsPage.expectBootstrapEditor();
    await workloadDetailsPage.open('bookinfo', 'waypoint');
    await workloadDetailsPage.openWaypointTab();
    await workloadDetailsPage.openWaypointSubtab('Services');
    await workloadDetailsPage.expectWaypointServicesData();
    await workloadDetailsPage.openWaypointSubtab('Info');
    await workloadDetailsPage.expectWaypointInfoFor('service');
  });

  test('Ztunnel workload details are valid', waypointOnly, async ({ request, workloadDetailsPage }) => {
    test.setTimeout(180_000);
    const ztunnel = await waitForZtunnelWorkloadReady(request);
    await workloadDetailsPage.open(ztunnel.namespace, ztunnel.name);
    await workloadDetailsPage.expectMissingSidecarBadge(false, ztunnel.namespace, ztunnel.name);
    await workloadDetailsPage.expectProxyStatusIcon('healthy');
    await workloadDetailsPage.expectZtunnelServicesTable();
    await workloadDetailsPage.expectZtunnelTabForNamespace('bookinfo');
  });

  test('Waypoint workload log level can be updated', waypointOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.openLogsTab('bookinfo', 'waypoint');
    await workloadDetailsPage.setLogLevel('Debug');
  });

  test('Ratings logs tab shows waypoint container logs', waypointOnly, async ({ workloadDetailsPage }) => {
    test.setTimeout(180_000);
    await workloadDetailsPage.openLogsTab('bookinfo', 'ratings-v1');
    await workloadDetailsPage.expectContainerListed('waypoint');
    await workloadDetailsPage.expectContainerListed('ratings');
    // Wait for waypoint access logs (sparse) before filtering — app lines match "ratings" alone.
    await workloadDetailsPage.selectContainer('waypoint-ratings', {
      bodyMustInclude: 'ratings.bookinfo.svc.cluster.local'
    });
    await workloadDetailsPage.expectContainerChecked('waypoint-ratings');
    await workloadDetailsPage.expectContainerChecked('container-ratings');
    await workloadDetailsPage.expectPodSelected('ratings-v1');
    await workloadDetailsPage.setLogShow('ratings');
    await workloadDetailsPage.expectSomeLogLinesContain('ratings.bookinfo.svc.cluster.local');
  });

  test('Graph shows ztunnel traffic', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambientZtunnel', true);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeastIncludingPrometheus(5);
  });

  test('Graph shows no Ambient traffic', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(2);
  });

  test('Graph shows all Ambient traffic', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('ambientTotal', true);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeastIncludingPrometheus(14);
  });

  test('Graph hides waypoint proxy by default', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.expectWorkloadNodeExists('waypoint', false);
  });

  test('Graph shows waypoint proxy when display enabled', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('waypoint proxies', true);
    await graphPage.closeDisplayMenu();
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('ambientTotal', true);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(16);
    await graphPage.expectWorkloadNodeExists('waypoint', true);
  });

  test('Graph shows waypoint traffic', waypointOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('ambient', true);
    await graphPage.setTrafficOption('ambientWaypoint', true);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(10);
    await graphPage.expectAppOrServiceNodeCount(11);
  });

  test('K8sGateway waypoint Istio Config is valid', waypointOnly, async ({ page, istioConfigPage }) => {
    await istioConfigPage.openWithNamespace('bookinfo');
    await istioConfigPage.ensureConfigurationValidationEnabled();
    await expect(
      page.getByTestId('VirtualItem_Nsbookinfo_K8sGateway_waypoint').getByTestId('icon-correct-validation')
    ).toBeVisible();
  });

  test('Bookinfo has no Ambient L7 validation warnings', waypointOnly, async ({ istioConfigPage }) => {
    await istioConfigPage.expectNoAmbientL7WarningsInNamespace('bookinfo');
    await istioConfigPage.expectNoAmbientL7WarningsForWorkload('bookinfo', 'reviews-v1');
  });

  test('Namespaces list shows use-waypoint label', waypointOnly, async ({ page, namespacesPage }) => {
    await namespacesPage.openList();
    await namespacesPage.filterBy('Namespace', 'bookinfo');
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await expectColumnTextOnRow(page, 'bookinfo', 'Labels', 'istio.io/use-waypoint=waypoint');
  });
});
