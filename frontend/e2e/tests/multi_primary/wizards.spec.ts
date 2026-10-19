import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  WEST,
  deleteGatewayOnClusters,
  deleteRequestRoutingOnClusters,
  duplicateRequestRoutingToCluster,
  ensureTrafficRoutingOnCluster
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiPrimaryOnly } from '../../utils/suite-tags';

// One serial block: Playwright runs sibling describes in parallel on CI (2 workers),
// and every west wizard here hits the same remote istio config cache. Everything that
// mutates bookinfo/ratings traffic routing belongs here — including the graph context
// menu and side panel flows — so a sibling file cannot delete the routing mid-test.
test.describe.serial('Multi-primary istio wizards', () => {
  test.describe.configure({ timeout: 240_000 });

  test(
    'Create Gateway in both clusters',
    multiPrimaryOnly,
    async ({ istioConfigPage, istioConfigWizardPage, page, request }) => {
      await deleteGatewayOnClusters(request, 'bookinfo-gateway-mc');
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.selectClusters('east,west');
      await istioConfigWizardPage.typesInInput('name', 'bookinfo-gateway-mc');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.expectPreviewButtonDisabled();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.previewConfiguration();
      await istioConfigWizardPage.createIstioConfig();
      await istioConfigPage.expectObjectListedOnCluster('Gateway', 'bookinfo-gateway-mc', 'bookinfo', EAST);
      await istioConfigPage.expectObjectListedOnCluster('Gateway', 'bookinfo-gateway-mc', 'bookinfo', WEST);
      await deleteGatewayOnClusters(request, 'bookinfo-gateway-mc');
    }
  );

  test(
    'Create request routing for west ratings',
    multiPrimaryOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, istioConfigPage, page, request }) => {
      await deleteRequestRoutingOnClusters(request, 'ratings');
      await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
      await serviceDetailsPage.clickServiceAction('request_routing');
      await k8sRoutingWizardPage.expectWizard('Create request routing');
      await k8sRoutingWizardPage.clickTab('Request Matching');
      await k8sRoutingWizardPage.addRoute();
      await k8sRoutingWizardPage.previewConfiguration();
      await k8sRoutingWizardPage.createConfiguration();
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectObjectListedOnCluster('VirtualService', 'ratings', 'bookinfo', WEST);
      await istioConfigPage.expectObjectNotListedOnCluster('VirtualService', 'ratings', 'bookinfo', EAST);
    }
  );

  test(
    'Update request routing with gateway on west ratings',
    multiPrimaryOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, istioConfigPage, page, request }) => {
      await deleteGatewayOnClusters(request, 'ratings-gateway');
      await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
      await serviceDetailsPage.clickServiceAction('request_routing');
      await k8sRoutingWizardPage.expectWizard('Update request routing');
      await k8sRoutingWizardPage.clickAdvancedOptions();
      await k8sRoutingWizardPage.clickTab('Gateways');
      await k8sRoutingWizardPage.clickAddGateway();
      await k8sRoutingWizardPage.selectCreateIstioGateway();
      await k8sRoutingWizardPage.previewConfiguration();
      await k8sRoutingWizardPage.updateConfiguration();
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectObjectListedOnCluster('VirtualService', 'ratings', 'bookinfo', WEST);
      await istioConfigPage.expectObjectListedOnCluster('Gateway', 'ratings-gateway', 'bookinfo', WEST);
    }
  );

  test(
    'Delete request routing on west ratings',
    multiPrimaryOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, request }) => {
      await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
      await serviceDetailsPage.clickServiceAction('delete_traffic_routing');
      await k8sRoutingWizardPage.confirmDeleteConfiguration();
      await serviceDetailsPage.expectIstioConfigTableEmpty();
      await deleteRequestRoutingOnClusters(request, 'ratings');
      await deleteGatewayOnClusters(request, 'ratings-gateway');
    }
  );

  test(
    'Create request routing on west ratings from the graph context menu',
    multiPrimaryOnly,
    async ({ graphPage, k8sRoutingWizardPage, istioConfigPage, page, request }) => {
      await deleteRequestRoutingOnClusters(request, 'ratings');
      await graphPage.graphNamespaces('bookinfo');
      await graphPage.expectGraphLoaded();
      await graphPage.openContextMenuForService('ratings', WEST);
      await graphPage.clickContextMenuItem('request_routing');
      await graphPage.expectWizardVisible('request_routing');
      await k8sRoutingWizardPage.clickTab('Request Matching');
      await k8sRoutingWizardPage.addRoute();
      await k8sRoutingWizardPage.previewConfiguration();
      await k8sRoutingWizardPage.createConfiguration();
      // The wizards only write to one cluster; multi-primary needs the config on both
      // sides or cross-cluster ratings traffic starts failing on the graph.
      await duplicateRequestRoutingToCluster(request, 'ratings', 'bookinfo', EAST);
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectTrafficRoutingForServiceOnCluster('ratings', 'bookinfo', WEST);
      await deleteRequestRoutingOnClusters(request, 'ratings');
    }
  );

  test(
    'Delete traffic routing for west ratings from the graph side panel kebab',
    multiPrimaryOnly,
    async ({ graphPage, istioConfigPage, page, request }) => {
      await ensureTrafficRoutingOnCluster(request, 'ratings', 'bookinfo', WEST);
      await graphPage.graphNamespaces('bookinfo');
      await graphPage.expectGraphLoaded();
      await graphPage.clickGraphNode('ratings', 'service', WEST);
      await graphPage.expectSidePanelLinksContain('clusterName=west');
      await graphPage.expectSidePanelClusterBadgeVisible(WEST);
      await graphPage.openSidePanelKebab();
      await graphPage.clickSidePanelKebabItem('delete_traffic_routing');
      await graphPage.expectDeleteTrafficRoutingModal();
      await graphPage.confirmDeleteTrafficRouting();
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectNoTrafficRoutingForServiceOnCluster('ratings', 'bookinfo', WEST);
      await deleteRequestRoutingOnClusters(request, 'ratings');
    }
  );
});
