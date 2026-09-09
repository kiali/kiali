import { test } from '../../fixtures/kialiFixtures';
import { crdResourceName } from '../../utils/crdValidationTest';
import { ensureDemoApp } from '../../utils/demoApps';
import { ensureGatewayApiCrds, isGatewayApiCrdInstalled } from '../../utils/gatewayApi';
import { isGatewayApiEnabled } from '../../utils/kialiConfig';
import {
  applyAuthorizationPolicy,
  applyDestinationRule,
  applyIstioGateway,
  applyK8sGateway,
  applyK8sReferenceGrant,
  applyPeerAuthentication,
  applySidecar,
  applyVirtualService,
  applyVirtualServiceWithSubset,
  cleanIstioSystemTestResources,
  cleanSleepMtlsTestResources,
  deleteIstioConfig,
  deleteIstioGateway,
  patchAuthorizationPolicyFromSourceNamespace,
  patchAuthorizationPolicyFromSourcePrincipal,
  patchAuthorizationPolicyToOperationHost,
  patchAuthorizationPolicyToOperationMethod,
  patchDestinationRuleDisableMtls,
  patchDestinationRuleEnableMtls,
  patchDestinationRuleSubset,
  patchK8sGatewayAddress,
  patchPeerAuthenticationMtlsMode,
  patchSidecarWorkloadSelector,
  patchVirtualServiceAdditionalDestination,
  patchVirtualServiceGateways,
  patchVirtualServiceHosts,
  patchVirtualServiceRouteWeight,
  restoreBookinfoNetworking
} from '../../utils/istioCrdValidation';
import { deleteK8sGateway, deleteK8sReferenceGrant } from '../../utils/istioConfigResources';
import { selectNamespace, selectNamespaces } from '../../utils/namespace';
import { crdValidationOnly } from '../../utils/suite-tags';

test.describe('Istio Config CRD validation', () => {
  test.describe.configure({ timeout: 180_000 });

  test.describe('parallel', () => {
    test.describe.configure({ mode: 'parallel' });

    test('KIA0101 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      applyAuthorizationPolicy(name, 'bookinfo');
      patchAuthorizationPolicyFromSourceNamespace(name, 'bookinfo', 'bar');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'AuthorizationPolicy', name, 'warning');
      deleteIstioConfig('AuthorizationPolicy', name, 'bookinfo');
    });

    test('KIA0102 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const apName = crdResourceName(testInfo, 'foo');
      const drName = crdResourceName(testInfo, 'enable-mtls');
      ensureDemoApp('bookinfo');
      applyDestinationRule(drName, 'bookinfo', '*.bookinfo.svc.cluster.local');
      applyAuthorizationPolicy(apName, 'bookinfo');
      patchAuthorizationPolicyToOperationMethod(apName, 'bookinfo', 'non-fully-qualified-grpc');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'AuthorizationPolicy', apName, 'warning');
      deleteIstioConfig('AuthorizationPolicy', apName, 'bookinfo');
      deleteIstioConfig('DestinationRule', drName, 'bookinfo');
    });

    test('KIA0106 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      applyAuthorizationPolicy(name, 'bookinfo');
      patchAuthorizationPolicyFromSourcePrincipal(name, 'bookinfo', 'cluster.local/ns/bookinfo/sa/sleep');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'AuthorizationPolicy', name, 'danger');
      deleteIstioConfig('AuthorizationPolicy', name, 'bookinfo');
    });

    test('KIA0201 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const foo = crdResourceName(testInfo, 'foo');
      const bar = crdResourceName(testInfo, 'bar');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyDestinationRule(foo, 'sleep', 'sleep');
      patchDestinationRuleSubset(foo, 'sleep', 'mysubset', 'version=v1');
      applyDestinationRule(bar, 'sleep', 'sleep');
      patchDestinationRuleSubset(bar, 'sleep', 'mysubset', 'version=v1');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', foo, 'warning');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', bar, 'warning');
      deleteIstioConfig('DestinationRule', foo, 'sleep');
      deleteIstioConfig('DestinationRule', bar, 'sleep');
    });

    test('KIA0202 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyDestinationRule(name, 'sleep', 'nonexistent');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', name, 'warning');
      deleteIstioConfig('DestinationRule', name, 'sleep');
    });

    test('KIA0203 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const drName = crdResourceName(testInfo, 'foo');
      const vsName = crdResourceName(testInfo, 'foo-route');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyDestinationRule(drName, 'sleep', 'sleep');
      patchDestinationRuleSubset(drName, 'sleep', 'v1', 'version=v1');
      applyVirtualServiceWithSubset(vsName, 'sleep', 'foo-route', 'sleep', 'v1');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', drName, 'danger');
      deleteIstioConfig('DestinationRule', drName, 'sleep');
      deleteIstioConfig('VirtualService', vsName, 'sleep');
    });

    test('KIA0209 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyDestinationRule(name, 'sleep', '*.sleep.svc.cluster.local');
      patchDestinationRuleSubset(name, 'sleep', 'v1', '');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', name, 'warning');
      deleteIstioConfig('DestinationRule', name, 'sleep');
    });

    test('KIA0301 wildcard validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyIstioGateway(name, 'bookinfo', 'productpage.local', 80, 'app=productpage');
      applyIstioGateway(name, 'sleep', '*', 80, 'app=productpage');

      await istioConfigPage.open();
      await selectNamespaces(page, ['bookinfo', 'sleep']);
      await istioConfigPage.expectValidationStatus('bookinfo', 'Gateway', name, 'warning');
      await istioConfigPage.expectValidationStatus('sleep', 'Gateway', name, 'warning');
      deleteIstioGateway(name, 'sleep');
      deleteIstioGateway(name, 'bookinfo');
    });

    test('KIA0301 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyIstioGateway(name, 'bookinfo', 'productpage.local', 80, 'app=productpage');
      applyIstioGateway(name, 'sleep', 'productpage.local', 80, 'app=productpage');

      await istioConfigPage.open();
      await selectNamespaces(page, ['bookinfo', 'sleep']);
      await istioConfigPage.expectValidationStatus('bookinfo', 'Gateway', name, 'warning');
      await istioConfigPage.expectValidationStatus('sleep', 'Gateway', name, 'warning');
      deleteIstioGateway(name, 'sleep');
      deleteIstioGateway(name, 'bookinfo');
    });

    test('KIA0302 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyIstioGateway(name, 'sleep', 'foo.local', 80, 'app=foo');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'Gateway', name, 'warning');
      deleteIstioGateway(name, 'sleep');
    });

    test('KIA1004 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applySidecar(name, 'sleep', 'sleep/foo.sleep.svc.cluster.local');
      patchSidecarWorkloadSelector(name, 'sleep', 'app=sleep');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'Sidecar', name, 'warning');
      deleteIstioConfig('Sidecar', name, 'sleep');
    });

    test('KIA1101 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyVirtualService(name, 'sleep', 'foo-route', 'foo');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', name, 'warning');
      deleteIstioConfig('VirtualService', name, 'sleep');
    });

    test('KIA1102 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      deleteIstioGateway(name, 'sleep');
      deleteIstioConfig('DestinationRule', name, 'sleep');
      applyVirtualService(name, 'sleep', 'foo-route', 'sleep');
      patchVirtualServiceHosts(name, 'sleep', 'sleep');
      patchVirtualServiceGateways(name, 'sleep', 'foo');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', name, 'danger');
      deleteIstioConfig('VirtualService', name, 'sleep');
    });

    test('VirtualService references to Gateway', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const gwName = crdResourceName(testInfo, 'foo');
      const vsName = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyIstioGateway(gwName, 'bookinfo', 'productpage.local', 80, 'app=productpage');
      applyVirtualService(vsName, 'sleep', 'foo-route', 'sleep');
      patchVirtualServiceHosts(vsName, 'sleep', 'sleep');
      patchVirtualServiceGateways(vsName, 'sleep', `bookinfo/${gwName}`);

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', vsName, 'success');
      deleteIstioConfig('VirtualService', vsName, 'sleep');
      deleteIstioGateway(gwName, 'bookinfo');
    });

    test('KIA1104 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyVirtualService(name, 'sleep', 'foo-route', 'sleep');
      patchVirtualServiceRouteWeight(name, 'sleep', 10);

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', name, 'warning');
      deleteIstioConfig('VirtualService', name, 'sleep');
    });

    test('KIA1105 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const vsName = crdResourceName(testInfo, 'foo');
      const drName = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyVirtualServiceWithSubset(vsName, 'sleep', 'foo-route', 'sleep', 'v1');
      patchVirtualServiceRouteWeight(vsName, 'sleep', 50);
      patchVirtualServiceAdditionalDestination(vsName, 'sleep', 'sleep', 'v1', 50);
      applyDestinationRule(drName, 'sleep', 'sleep');
      patchDestinationRuleSubset(drName, 'sleep', 'v1', 'version=v1');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', vsName, 'warning');
      deleteIstioConfig('DestinationRule', drName, 'sleep');
      deleteIstioConfig('VirtualService', vsName, 'sleep');
    });

    test(
      'Duplicate validation codes are grouped on the detail page',
      crdValidationOnly,
      async ({ istioConfigPage, page }, testInfo) => {
        const vsName = crdResourceName(testInfo, 'bar');
        const drName = crdResourceName(testInfo, 'bar');
        ensureDemoApp('bookinfo');
        ensureDemoApp('sleep');
        applyVirtualServiceWithSubset(vsName, 'sleep', 'bar-route', 'sleep', 'v1');
        patchVirtualServiceRouteWeight(vsName, 'sleep', 50);
        patchVirtualServiceAdditionalDestination(vsName, 'sleep', 'sleep', 'v1', 50);
        applyDestinationRule(drName, 'sleep', 'sleep');
        patchDestinationRuleSubset(drName, 'sleep', 'v1', 'version=v1');

        await istioConfigPage.open();
        await istioConfigPage.refreshList();
        await selectNamespace(page, 'sleep');
        await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', vsName, 'warning');
        await istioConfigPage.openConfigByRow('sleep', 'VirtualService', vsName);
        await istioConfigPage.expectGroupedValidationMessage('KIA1105', 2);
        deleteIstioConfig('DestinationRule', drName, 'sleep');
        deleteIstioConfig('VirtualService', vsName, 'sleep');
      }
    );

    test('KIA1106 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const foo = crdResourceName(testInfo, 'foo');
      const bar = crdResourceName(testInfo, 'bar');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyVirtualService(foo, 'sleep', 'foo-route', 'sleep');
      patchVirtualServiceHosts(foo, 'sleep', 'sleep');
      applyVirtualService(bar, 'sleep', 'bar-route', 'sleep');
      patchVirtualServiceHosts(bar, 'sleep', 'sleep');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', foo, 'warning');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', bar, 'warning');
      deleteIstioConfig('VirtualService', foo, 'sleep');
      deleteIstioConfig('VirtualService', bar, 'sleep');
    });

    test('KIA1107 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      // Unique host avoids false "success" when parallel tests create a DR with subset v1 for "sleep".
      const routeHost = crdResourceName(testInfo, 'missing-host');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyVirtualServiceWithSubset(name, 'sleep', 'foo-route', routeHost, 'v1');
      deleteIstioConfig('DestinationRule', name, 'sleep');
      deleteIstioGateway(name, 'sleep');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'VirtualService', name, 'warning');
      deleteIstioConfig('VirtualService', name, 'sleep');
    });

    test('KIA1502 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const gatewayApiEnabled = await isGatewayApiEnabled(page.request);
      test.skip(!gatewayApiEnabled, 'gateway API not enabled on cluster');

      const crdInstalledBeforeEnsure = isGatewayApiCrdInstalled();
      if (!crdInstalledBeforeEnsure) {
        ensureGatewayApiCrds();
        test.skip(!isGatewayApiCrdInstalled(), 'Gateway API CRDs not available on cluster');
        test.skip(true, 'Gateway API CRDs were installed during this run; restart Kiali and re-run');
      }

      const foo = crdResourceName(testInfo, 'foo');
      const bar = crdResourceName(testInfo, 'bar');
      ensureDemoApp('bookinfo');
      deleteK8sGateway(foo, 'bookinfo');
      deleteK8sGateway(bar, 'bookinfo');
      applyK8sGateway(foo, 'bookinfo', 'google.com', 'HTTP', '80', 'istio');
      applyK8sGateway(bar, 'bookinfo', 'secondary.com', 'HTTP', '9080', 'istio');
      patchK8sGatewayAddress(foo, 'bookinfo', 'Hostname', 'example.com');
      patchK8sGatewayAddress(bar, 'bookinfo', 'Hostname', 'example.com');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'K8sGateway', foo, 'warning');
      await istioConfigPage.expectValidationStatus('bookinfo', 'K8sGateway', bar, 'warning');
      deleteK8sGateway(foo, 'bookinfo');
      deleteK8sGateway(bar, 'bookinfo');
    });

    test('KIA1504 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const gatewayApiEnabled = await isGatewayApiEnabled(page.request);
      test.skip(!gatewayApiEnabled, 'gateway API not enabled on cluster');

      const crdInstalledBeforeEnsure = isGatewayApiCrdInstalled();
      if (!crdInstalledBeforeEnsure) {
        ensureGatewayApiCrds();
        test.skip(!isGatewayApiCrdInstalled(), 'Gateway API CRDs not available on cluster');
        test.skip(true, 'Gateway API CRDs were installed during this run; restart Kiali and re-run');
      }

      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      deleteK8sGateway(name, 'bookinfo');
      applyK8sGateway(name, 'bookinfo', 'google.com', 'HTTP', '80', 'nonexistentname');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'K8sGateway', name, 'danger');
      deleteK8sGateway(name, 'bookinfo');
    });

    test('KIA1601 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const gatewayApiEnabled = await isGatewayApiEnabled(page.request);
      test.skip(!gatewayApiEnabled, 'gateway API not enabled on cluster');

      const crdInstalledBeforeEnsure = isGatewayApiCrdInstalled();
      if (!crdInstalledBeforeEnsure) {
        ensureGatewayApiCrds();
        test.skip(!isGatewayApiCrdInstalled(), 'Gateway API CRDs not available on cluster');
        test.skip(true, 'Gateway API CRDs were installed during this run; restart Kiali and re-run');
      }

      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      deleteK8sReferenceGrant(name, 'bookinfo');
      applyK8sReferenceGrant(name, 'bookinfo', 'nonexistent');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'K8sReferenceGrant', name, 'danger');
      deleteK8sReferenceGrant(name, 'bookinfo');
    });
  });

  // Contend for sleep default PeerAuthentication — run one at a time.
  test.describe('sleep mTLS', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(() => {
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
    });

    test.beforeEach(() => {
      cleanSleepMtlsTestResources();
    });

    test('KIA0207 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const drName = crdResourceName(testInfo, 'disable-mtls');
      applyDestinationRule(drName, 'sleep', '*.sleep.svc.cluster.local');
      patchDestinationRuleDisableMtls(drName, 'sleep');
      applyPeerAuthentication('default', 'sleep');
      patchPeerAuthenticationMtlsMode('default', 'sleep', 'STRICT');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', drName, 'danger');
    });

    test('KIA0505 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const drName = crdResourceName(testInfo, 'enable-mtls');
      applyDestinationRule(drName, 'sleep', '*.sleep.svc.cluster.local');
      patchDestinationRuleEnableMtls(drName, 'sleep');
      applyPeerAuthentication('default', 'sleep');
      patchPeerAuthenticationMtlsMode('default', 'sleep', 'DISABLE');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationOnDetailsPage('sleep', 'PeerAuthentication', 'default', 'KIA0505');
    });
  });

  // Deletes the bookinfo demo VirtualService — must not run concurrently with other bookinfo tests.
  test.describe('bookinfo networking', () => {
    test.describe.configure({ mode: 'serial' });

    test('KIA0104 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const name = crdResourceName(testInfo, 'foo');
      ensureDemoApp('bookinfo');
      deleteIstioConfig('VirtualService', 'bookinfo', 'bookinfo');
      applyAuthorizationPolicy(name, 'bookinfo');
      patchAuthorizationPolicyToOperationHost(name, 'bookinfo', 'missing.hostname');

      await istioConfigPage.open();
      await istioConfigPage.refreshList();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectValidationStatus('bookinfo', 'AuthorizationPolicy', name, 'warning');
      deleteIstioConfig('AuthorizationPolicy', name, 'bookinfo');
      restoreBookinfoNetworking();
    });
  });

  // Contend for istio-system default PeerAuthentication / Sidecar — run one at a time.
  test.describe('istio-system', () => {
    test.describe.configure({ mode: 'serial' });

    test('KIA0208 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const drName = crdResourceName(testInfo, 'disable-mtls');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyDestinationRule(drName, 'sleep', '*.sleep.svc.cluster.local');
      patchDestinationRuleDisableMtls(drName, 'sleep');
      applyPeerAuthentication('default', 'istio-system');
      patchPeerAuthenticationMtlsMode('default', 'istio-system', 'STRICT');

      await istioConfigPage.open();
      await selectNamespace(page, 'sleep');
      await istioConfigPage.expectValidationStatus('sleep', 'DestinationRule', drName, 'danger');
      deleteIstioConfig('DestinationRule', drName, 'sleep');
      cleanIstioSystemTestResources();
    });

    test('KIA0506 validation', crdValidationOnly, async ({ istioConfigPage, page }, testInfo) => {
      const drName = crdResourceName(testInfo, 'enable-mtls');
      ensureDemoApp('bookinfo');
      ensureDemoApp('sleep');
      applyDestinationRule(drName, 'sleep', '*.local');
      patchDestinationRuleEnableMtls(drName, 'sleep');
      applyPeerAuthentication('default', 'istio-system');
      patchPeerAuthenticationMtlsMode('default', 'istio-system', 'DISABLE');

      await istioConfigPage.open();
      await selectNamespace(page, 'istio-system');
      await istioConfigPage.expectValidationOnDetailsPage('istio-system', 'PeerAuthentication', 'default', 'KIA0506');
      deleteIstioConfig('DestinationRule', drName, 'sleep');
      cleanIstioSystemTestResources();
    });

    test('KIA1006 validation', crdValidationOnly, async ({ istioConfigPage, page }) => {
      ensureDemoApp('bookinfo');
      applySidecar('default', 'istio-system', 'default/sleep.sleep.svc.cluster.local');
      patchSidecarWorkloadSelector('default', 'istio-system', 'app=grafana');

      await istioConfigPage.open();
      await selectNamespace(page, 'istio-system');
      await istioConfigPage.expectValidationStatus('istio-system', 'Sidecar', 'default', 'warning');
      deleteIstioConfig('Sidecar', 'default', 'istio-system');
      cleanIstioSystemTestResources();
    });
  });
});
