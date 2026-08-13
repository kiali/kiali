import { test } from '../../fixtures/kialiFixtures';
import { selectNamespace } from '../../utils/namespace';
import { expectGatewayApiEnabled } from '../../pages/IstioConfigPage';
import {
  applyMinimalK8sInferencePool,
  deleteK8sInferencePool,
  ensureInferenceApiCrds,
  isInferenceApiCrdInstalled
} from '../../utils/inferenceApi';
import { core1 } from '../../utils/suite-tags';

test.describe('Istio Config list', () => {
  test.beforeEach(async ({ istioConfigPage, page }) => {
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
  });

  test('See all Istio Config objects in the bookinfo namespace', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectBookinfoConfigRows();
    await istioConfigPage.expectColumn('Cluster', false);
    await istioConfigPage.expectIstioObjectColumnInformation('bookinfo-gateway');
  });

  test('Sidecar bookinfo has no Ambient L7 validation warnings', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectNoAmbientL7WarningsInNamespace('bookinfo');
    await istioConfigPage.expectNoAmbientL7WarningsForWorkload('bookinfo', 'reviews-v1');
  });

  test('See all Istio Config toggles', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectAllConfigurationTogglesChecked();
  });

  test('Toggle Istio Config configuration toggle', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.setConfigurationToggle(false);
    await istioConfigPage.expectColumn('Configuration', false);
    await istioConfigPage.setConfigurationToggle(true);
    await istioConfigPage.expectColumn('Configuration', true);
  });

  test('Filter Istio Config objects by Istio Name', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.filterBy('Istio Name', 'bookinfo-gateway');
    await istioConfigPage.expectOnlyRow('bookinfo-gateway');
  });

  test('Filter Istio Config objects by Type', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.filterBy('Type', 'Gateway');
    await istioConfigPage.expectOnlyTypeObjectsInNamespace('Gateway', 'bookinfo');
  });

  test('Filter Istio Config objects by Valid configuration', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.filterBy('Config', 'Valid');
    await istioConfigPage.expectRowsVisible('bookinfo-gateway', 'bookinfo');
  });

  test('Ability to create an AuthorizationPolicy object', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectCanCreateIstioObject('security.istio.io', 'v1', 'AuthorizationPolicy');
  });

  test('Ability to create a Gateway object', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectCanCreateIstioObject('networking.istio.io', 'v1', 'Gateway');
  });

  test('Ability to create a K8sGateway object', core1, async ({ page, istioConfigPage }) => {
    const enabled = await expectGatewayApiEnabled(page.request);
    test.skip(!enabled, 'gateway API not enabled on cluster');
    await istioConfigPage.expectCanCreateK8sIstioObject('gateway.networking.k8s.io', 'v1', 'Gateway');
  });

  test('K8s Inference Pool list', core1, async ({ istioConfigPage }) => {
    const crdInstalledBeforeEnsure = isInferenceApiCrdInstalled();
    if (!crdInstalledBeforeEnsure) {
      ensureInferenceApiCrds();
      test.skip(!isInferenceApiCrdInstalled(), 'Inference API CRDs not available on cluster');
      test.skip(true, 'Inference API CRDs were installed during this run; restart Kiali and re-run');
    }

    deleteK8sInferencePool('foo', 'bookinfo');
    applyMinimalK8sInferencePool('foo', 'bookinfo', 'details-v1');
    await istioConfigPage.refreshList();
    await istioConfigPage.filterBy('Type', 'K8sInferencePool');
    await istioConfigPage.expectObjectConfigurationStatus('bookinfo', 'K8sInferencePool', 'foo', 'N/A');

    deleteK8sInferencePool('foo', 'bookinfo');
  });

  test('Ability to create a PeerAuthentication object', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectCanCreateIstioObject('security.istio.io', 'v1', 'PeerAuthentication');
  });

  test('Ability to create a RequestAuthentication object', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectCanCreateIstioObject('security.istio.io', 'v1', 'RequestAuthentication');
  });

  test('Ability to create a ServiceEntry object', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectCanCreateIstioObject('networking.istio.io', 'v1', 'ServiceEntry');
  });

  test('Ability to create a Sidecar object', core1, async ({ istioConfigPage }) => {
    await istioConfigPage.expectCanCreateIstioObject('networking.istio.io', 'v1', 'Sidecar');
  });
});
