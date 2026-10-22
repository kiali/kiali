import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  deleteGatewayOnClusters,
  deleteRequestRoutingOnClusters,
  ensureTrafficRoutingOnCluster
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiClusterOnly } from '../../utils/suite-tags';
import { useBookinfoRoutingLockPerTest } from '../../utils/bookinfoRoutingLock';

test.describe.serial('Multi-cluster istio wizards', () => {
  test.describe.configure({ timeout: 240_000 });
  // Creates/updates/deletes the shared bookinfo 'details' VS + gateway on EAST;
  // serialize across parallel workers (graph.spec.ts / traffic_policies.spec.ts too).
  useBookinfoRoutingLockPerTest();

  test(
    'Gateway preview disabled without cluster selection',
    multiClusterOnly,
    async ({ istioConfigPage, istioConfigWizardPage, page, request }) => {
      await deleteGatewayOnClusters(request, 'bookinfo-gateway-mc');
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.clickCreateIstioConfigAction('Gateway');
      await istioConfigWizardPage.expectConfigWizard('Create Gateway');
      await istioConfigWizardPage.typesInInput('name', 'bookinfo-gateway-mc');
      await istioConfigWizardPage.addServerToServerList();
      await istioConfigWizardPage.expectPreviewButtonDisabled();
      await istioConfigWizardPage.typesInInput('hosts_0', 'website.com');
      await istioConfigWizardPage.typesInInput('addPortNumber_0', '8080');
      await istioConfigWizardPage.typesInInput('addPortName_0', 'foobar');
      await istioConfigWizardPage.expectPreviewButtonDisabled();
    }
  );

  test(
    'Create request routing for east details',
    multiClusterOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, istioConfigPage, page, request }) => {
      await deleteRequestRoutingOnClusters(request, 'details');
      await serviceDetailsPage.open('bookinfo', 'details', { clusterName: EAST });
      await serviceDetailsPage.clickServiceAction('request_routing');
      await k8sRoutingWizardPage.expectWizard('Create request routing');
      await k8sRoutingWizardPage.clickTab('Request Matching');
      await k8sRoutingWizardPage.addRoute();
      await k8sRoutingWizardPage.previewConfiguration();
      await k8sRoutingWizardPage.createConfiguration();
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectObjectListedOnCluster('VirtualService', 'details', 'bookinfo', EAST);
    }
  );

  test(
    'Update request routing with gateway on east details',
    multiClusterOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, istioConfigPage, page, request }) => {
      await deleteGatewayOnClusters(request, 'details-gateway');
      await serviceDetailsPage.open('bookinfo', 'details', { clusterName: EAST });
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
      await istioConfigPage.expectObjectListedOnCluster('VirtualService', 'details', 'bookinfo', EAST);
      await istioConfigPage.expectObjectListedOnCluster('Gateway', 'details-gateway', 'bookinfo', EAST);
    }
  );

  test(
    'Delete request routing on east details',
    multiClusterOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, request }) => {
      await serviceDetailsPage.open('bookinfo', 'details', { clusterName: EAST });
      await serviceDetailsPage.clickServiceAction('delete_traffic_routing');
      await k8sRoutingWizardPage.confirmDeleteConfiguration();
      await serviceDetailsPage.expectIstioConfigTableEmpty();
      await deleteRequestRoutingOnClusters(request, 'details');
      await deleteGatewayOnClusters(request, 'details-gateway');
    }
  );

  test(
    // Lives here, not in graph.spec.ts: it creates and deletes the same `details`
    // routing as the wizard chain above, and a different file can run in parallel
    // on the second CI worker. Must target `details`: the confirm modal deletes
    // every VirtualService routing to the target service, and productpage and
    // reviews are routed by setup objects (the `bookinfo` ingress VirtualService,
    // the `reviews` traffic-shifting VirtualService) whose collateral deletion
    // blackholes mesh traffic for the rest of the run.
    'Delete traffic routing from context menu on east details',
    multiClusterOnly,
    async ({ graphPage, istioConfigPage, page, request }) => {
      await ensureTrafficRoutingOnCluster(request, 'details', 'bookinfo', EAST);
      await graphPage.graphNamespaces('bookinfo');
      await graphPage.expectGraphLoaded();
      await graphPage.openContextMenuForService('details', EAST);
      await graphPage.clickContextMenuItem('delete_traffic_routing');
      await graphPage.expectDeleteTrafficRoutingModal();
      await graphPage.confirmDeleteTrafficRouting();
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectObjectNotListedOnCluster('VirtualService', 'details', 'bookinfo', EAST);
      await deleteRequestRoutingOnClusters(request, 'details');
    }
  );
});
