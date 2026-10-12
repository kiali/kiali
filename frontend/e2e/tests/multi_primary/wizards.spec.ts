import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  WEST,
  applyAuthorizationPolicyOnCluster,
  deleteGatewayOnClusters,
  deleteIstioOnClusters,
  deleteRequestRoutingOnClusters
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiPrimaryOnly } from '../../utils/suite-tags';

test.describe('Istio wizards multi-primary', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

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

  test('Edit AuthorizationPolicy on west', multiPrimaryOnly, async ({ istioConfigPage, page, request }) => {
    const policy = 'west-auth-pol-edit';
    await applyAuthorizationPolicyOnCluster(request, policy, 'bookinfo', WEST);
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.openConfigByCluster(WEST, 'bookinfo', 'AuthorizationPolicy', policy);
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.editYaml();
    await istioConfigPage.saveYamlAndWaitForPatch(policy);
    await deleteIstioOnClusters(
      request,
      `/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${policy}`,
      [WEST]
    );
  });

  test('Delete AuthorizationPolicy on west', multiPrimaryOnly, async ({ istioConfigPage, page, request }) => {
    const policy = 'west-auth-pol-delete';
    await applyAuthorizationPolicyOnCluster(request, policy, 'bookinfo', WEST);
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.openConfigByCluster(WEST, 'bookinfo', 'AuthorizationPolicy', policy);
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.deleteObjectFromEditor();
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectObjectNotListedOnCluster('AuthorizationPolicy', policy, 'bookinfo', WEST);
  });
});

test.describe.serial('Request routing multi-primary (west remote)', () => {
  test.describe.configure({ timeout: 180_000 });

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
});
