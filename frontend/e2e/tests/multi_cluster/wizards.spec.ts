import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  applyAuthorizationPolicyOnCluster,
  cluster1Context,
  deleteGatewayOnClusters,
  deleteIstioOnClusters,
  deleteRequestRoutingOnClusters
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiClusterOnly } from '../../utils/suite-tags';

test.describe('Istio wizards multi-cluster', () => {
  test.describe.configure({ timeout: 180_000 });

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

  test('Edit AuthorizationPolicy on east', multiClusterOnly, async ({ istioConfigPage, page, request }) => {
    applyAuthorizationPolicyOnCluster('east-auth-pol', 'bookinfo', cluster1Context());
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.openConfigByCluster(EAST, 'bookinfo', 'AuthorizationPolicy', 'east-auth-pol');
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.editYaml();
    await istioConfigPage.saveYamlAndWaitForPatch('east-auth-pol');
    await deleteIstioOnClusters(
      request,
      '/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/east-auth-pol',
      [EAST]
    );
  });

  test('Delete AuthorizationPolicy on east', multiClusterOnly, async ({ istioConfigPage, page }) => {
    applyAuthorizationPolicyOnCluster('east-auth-pol', 'bookinfo', cluster1Context());
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.openConfigByCluster(EAST, 'bookinfo', 'AuthorizationPolicy', 'east-auth-pol');
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.deleteObjectFromEditor();
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectObjectNotListedOnCluster('AuthorizationPolicy', 'east-auth-pol', 'bookinfo', EAST);
  });
});

test.describe.serial('Request routing multi-cluster (east local)', () => {
  test.describe.configure({ timeout: 180_000 });

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
});
