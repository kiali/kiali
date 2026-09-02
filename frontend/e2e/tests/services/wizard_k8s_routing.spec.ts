import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { useBookinfoRoutingLockPerTest } from '../../utils/bookinfoRoutingLock';
import {
  deleteBookinfoReviewsGateway,
  deleteBookinfoReviewsTrafficRouting,
  waitForK8sGateway
} from '../../utils/istioConfigResources';
import { isGatewayApiEnabled } from '../../utils/kialiConfig';
import { expectEditorMatchesRegex } from '../../utils/monacoEditor';
import { core2 } from '../../utils/suite-tags';

const namespace = 'bookinfo';
const service = 'reviews';

/**
 * HTTP and GRPC routing wizards share bookinfo/reviews and must not run in parallel.
 * Keep them in this single serial file; lock is per-test via useBookinfoRoutingLockPerTest().
 */
test.describe.serial('Service Details Wizard: K8s Routing', () => {
  test.describe.configure({ timeout: 180_000 });

  useBookinfoRoutingLockPerTest();

  test.beforeAll(() => {
    deleteBookinfoReviewsTrafficRouting();
    ensureDemoApp('bookinfo');
  });

  test.beforeEach(async ({ request }) => {
    test.skip(!(await isGatewayApiEnabled(request)), 'Gateway API is not enabled');
  });

  test('Create a K8s HTTP Routing scenario', core2, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    deleteBookinfoReviewsTrafficRouting();
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('k8s_request_routing');
    await k8sRoutingWizardPage.expectWizard('Create K8s HTTP routing');
    await k8sRoutingWizardPage.clickTab('Request Matching');
    await k8sRoutingWizardPage.clickRequestMatchingDropdown('headers');
    await k8sRoutingWizardPage.typeMatchingHeader('end-user');
    await k8sRoutingWizardPage.clickMatchValueDropdown('Exact');
    await k8sRoutingWizardPage.typeMatchValue('jason');
    await k8sRoutingWizardPage.addMatch();
    await k8sRoutingWizardPage.clickTab('Route To');
    await k8sRoutingWizardPage.typeTrafficWeight('100', 'reviews');
    await k8sRoutingWizardPage.clickTab('Route Filtering');
    await k8sRoutingWizardPage.clickRequestFilteringDropdown('requestMirror');
    await k8sRoutingWizardPage.addFilter();
    await k8sRoutingWizardPage.addRoute();
    await k8sRoutingWizardPage.previewConfiguration();
    await k8sRoutingWizardPage.createConfiguration();
    await serviceDetailsPage.expectIstioConfigTableRowCount(1);
  });

  test('See a HTTPRoute generated', core2, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickIstioConfigBadgeLink('HTTP');
    await expectEditorMatchesRegex(page, 'kind: HTTPRoute');
    await serviceDetailsPage.expectServiceReference(namespace, service);
  });

  test('Update a K8s HTTP Routing scenario', core2, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    deleteBookinfoReviewsGateway();
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('k8s_request_routing');
    await k8sRoutingWizardPage.expectWizard('Update K8s HTTP routing');
    await k8sRoutingWizardPage.clickAdvancedOptions();
    await k8sRoutingWizardPage.clickTab('K8s Gateways');
    await k8sRoutingWizardPage.clickAddGateway();
    await k8sRoutingWizardPage.selectCreateGateway();
    await k8sRoutingWizardPage.previewConfiguration();
    await k8sRoutingWizardPage.updateConfiguration();
    waitForK8sGateway('reviews-gateway', namespace);
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.expectIstioConfigTableRowCount(2);
  });

  test('See a K8s Gateway generated with warning (HTTP)', core2, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickIstioConfigBadgeLink('G', 'reviews-gateway');
    await expectEditorMatchesRegex(page, 'kind: Gateway');
  });

  test('Delete the K8s HTTP Routing scenario', core2, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('delete_traffic_routing');
    await k8sRoutingWizardPage.confirmDeleteConfiguration();
    await serviceDetailsPage.expectIstioConfigTableEmpty();
    deleteBookinfoReviewsTrafficRouting();
  });

  test('Create a K8s GRPC Routing scenario', core2, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    deleteBookinfoReviewsTrafficRouting();
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('k8s_grpc_request_routing');
    await k8sRoutingWizardPage.expectWizard('Create K8s GRPC routing');
    await k8sRoutingWizardPage.clickTab('Request Matching');
    await k8sRoutingWizardPage.clickRequestMatchingDropdown('headers');
    await k8sRoutingWizardPage.typeMatchingHeader('end-user');
    await k8sRoutingWizardPage.clickMatchValueDropdown('Exact');
    await k8sRoutingWizardPage.typeMatchValue('jason');
    await k8sRoutingWizardPage.addMatch();
    await k8sRoutingWizardPage.clickTab('Route To');
    await k8sRoutingWizardPage.typeTrafficWeight('100', 'reviews');
    await k8sRoutingWizardPage.clickTab('Route Filtering');
    await k8sRoutingWizardPage.clickRequestFilteringDropdown('requestMirror');
    await k8sRoutingWizardPage.addFilter();
    await k8sRoutingWizardPage.addRoute();
    await k8sRoutingWizardPage.previewConfiguration();
    await k8sRoutingWizardPage.createConfiguration();
    await serviceDetailsPage.expectIstioConfigTableRowCount(1);
  });

  test('See a GRPCRoute generated', core2, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickIstioConfigBadgeLink('gRPC');
    await expectEditorMatchesRegex(page, 'kind: GRPCRoute');
    await serviceDetailsPage.expectServiceReference(namespace, service);
  });

  test('Update a K8s GRPC Routing scenario', core2, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    deleteBookinfoReviewsGateway();
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('k8s_grpc_request_routing');
    await k8sRoutingWizardPage.expectWizard('Update K8s GRPC routing');
    await k8sRoutingWizardPage.clickAdvancedOptions();
    await k8sRoutingWizardPage.clickTab('K8s Gateways');
    await k8sRoutingWizardPage.clickAddGateway();
    await k8sRoutingWizardPage.selectCreateGateway();
    await k8sRoutingWizardPage.previewConfiguration();
    await k8sRoutingWizardPage.updateConfiguration();
    waitForK8sGateway('reviews-gateway', namespace);
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.expectIstioConfigTableRowCount(2);
  });

  test('See a K8s Gateway generated with warning (GRPC)', core2, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickIstioConfigBadgeLink('G', 'reviews-gateway');
    await expectEditorMatchesRegex(page, 'kind: Gateway');
  });

  test('Delete the K8s GRPC Routing scenario', core2, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('delete_traffic_routing');
    await k8sRoutingWizardPage.confirmDeleteConfiguration();
    await serviceDetailsPage.expectIstioConfigTableEmpty();
    deleteBookinfoReviewsTrafficRouting();
  });
});
