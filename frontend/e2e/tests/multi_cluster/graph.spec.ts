import { expect, test } from '../../fixtures/kialiFixtures';
import { EAST, WEST, deleteRequestRoutingOnClusters, ensureTrafficRoutingOnCluster } from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiClusterOnly } from '../../utils/suite-tags';

const WIZARD_ACTIONS = [
  'traffic_shifting',
  'tcp_traffic_shifting',
  'request_routing',
  'fault_injection',
  'request_timeouts'
] as const;

test.describe('Graph multi-cluster', () => {
  test.describe.configure({ timeout: 180_000 });

  test('Graph bookinfo across east and west', multiClusterOnly, async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.expectBookinfoAcrossEastWest();
  });

  test('East productpage-v1 summary links include cluster', multiClusterOnly, async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.clickGraphNode('productpage-v1', 'workload', EAST);
    await graphPage.expectSummaryWorkloadDetailsLink(EAST);
  });

  test('West reviews-v2 summary links include cluster', multiClusterOnly, async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.clickGraphNode('reviews-v2', 'workload', WEST);
    await graphPage.expectSummaryWorkloadDetailsLink(WEST);
  });

  test('Show Traces tab includes east clusterName', multiClusterOnly, async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.clickGraphNode('productpage', 'service', EAST);
    await graphPage.expectTracesTabClusterParam(EAST);
  });

  test('Context menu Details link includes east cluster', multiClusterOnly, async ({ graphPage, page }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.openContextMenuForService('details', EAST);
    await graphPage.clickContextMenuLink('Details');
    await expect(page).toHaveURL(new RegExp(`clusterName=${EAST}`));
  });

  test('Context menu Traffic link includes east cluster', multiClusterOnly, async ({ graphPage, page }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.openContextMenuForService('details', EAST);
    await graphPage.clickContextMenuLink('Traffic');
    await expect(page).toHaveURL(new RegExp(`clusterName=${EAST}`));
  });

  test('Context menu Inbound Metrics link includes east cluster', multiClusterOnly, async ({ graphPage, page }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await graphPage.openContextMenuForService('details', EAST);
    await graphPage.clickContextMenuLink('Inbound Metrics');
    await expect(page).toHaveURL(new RegExp(`clusterName=${EAST}`));
  });

  test(
    // Targets productpage, not details: the details VirtualService belongs to the
    // serial routing tests in wizards.spec.ts, and a different file can run in
    // parallel on the second CI worker.
    'Delete traffic routing from context menu on east productpage',
    multiClusterOnly,
    async ({ graphPage, istioConfigPage, page, request }) => {
      await ensureTrafficRoutingOnCluster(request, 'productpage', 'bookinfo', EAST);
      await graphPage.graphNamespaces('bookinfo');
      await graphPage.expectGraphLoaded();
      await graphPage.openContextMenuForService('productpage', EAST);
      await graphPage.clickContextMenuItem('delete_traffic_routing');
      await graphPage.expectDeleteTrafficRoutingModal();
      await graphPage.confirmDeleteTrafficRouting();
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectObjectNotListedOnCluster('VirtualService', 'productpage', 'bookinfo', EAST);
      await deleteRequestRoutingOnClusters(request, 'productpage');
    }
  );

  for (const action of WIZARD_ACTIONS) {
    test(`Launch ${action} wizard from west ratings context menu`, multiClusterOnly, async ({ graphPage }) => {
      await graphPage.graphNamespaces('bookinfo');
      await graphPage.expectGraphLoaded();
      await graphPage.openContextMenuForService('ratings', WEST);
      await graphPage.clickContextMenuItem(action);
      await graphPage.expectWizardVisible(action);
    });
  }
});
