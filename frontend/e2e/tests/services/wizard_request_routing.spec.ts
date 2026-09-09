import { test } from '../../fixtures/kialiFixtures';
import { useBookinfoRoutingLockPerTest } from '../../utils/bookinfoRoutingLock';
import { ensureDemoApp } from '../../utils/demoApps';
import { deleteBookinfoReviewsIstioRouting } from '../../utils/istioConfigResources';
import { expectEditorMatchesRegex } from '../../utils/monacoEditor';
import { coreCachingOnly } from '../../utils/suite-tags';

const namespace = 'bookinfo';
const service = 'reviews';

test.describe.serial('Service Details Wizard: Request Routing', () => {
  test.describe.configure({ timeout: 180_000 });

  useBookinfoRoutingLockPerTest();

  test.beforeAll(() => {
    deleteBookinfoReviewsIstioRouting();
    ensureDemoApp('bookinfo');
  });

  test('Create a Request Routing scenario', coreCachingOnly, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    deleteBookinfoReviewsIstioRouting();
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('request_routing');
    await k8sRoutingWizardPage.expectWizard('Create request routing');
    await k8sRoutingWizardPage.clickTab('Request Matching');
    await k8sRoutingWizardPage.clickRequestMatchingDropdown('headers');
    await k8sRoutingWizardPage.typeMatchingHeader('end-user');
    await k8sRoutingWizardPage.clickMatchValueDropdown('exact');
    await k8sRoutingWizardPage.typeMatchValue('jason');
    await k8sRoutingWizardPage.addMatch();
    await k8sRoutingWizardPage.clickTab('Route To');
    await k8sRoutingWizardPage.typeTrafficWeight('100', 'reviews-v2');
    await k8sRoutingWizardPage.addRoute();
    await k8sRoutingWizardPage.clickTab('Request Matching');
    await k8sRoutingWizardPage.clickMatchingSelected('headers [end-user] exact jason');
    await k8sRoutingWizardPage.clickTab('Route To');
    await k8sRoutingWizardPage.typeTrafficWeight('100', 'reviews-v3');
    await k8sRoutingWizardPage.addRoute();
    await k8sRoutingWizardPage.previewConfiguration();
    await k8sRoutingWizardPage.createConfiguration();
    await serviceDetailsPage.expectIstioConfigTableRowCount(2);
  });

  test(
    'See a DestinationRule generated',
    coreCachingOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, page }) => {
      await serviceDetailsPage.open(namespace, service);
      await serviceDetailsPage.clickIstioConfigBadgeLink('DR');
      await expectEditorMatchesRegex(page, 'kind: DestinationRule');
      await k8sRoutingWizardPage.expectReference(namespace, service, 'service');
      await k8sRoutingWizardPage.expectReference(namespace, 'reviews-v1', 'workload');
      await k8sRoutingWizardPage.expectReference(namespace, 'reviews-v2', 'workload');
      await k8sRoutingWizardPage.expectReference(namespace, 'reviews-v3', 'workload');
      await k8sRoutingWizardPage.expectReference(namespace, service, 'VirtualService');
    }
  );

  test(
    'See a VirtualService generated',
    coreCachingOnly,
    async ({ serviceDetailsPage, k8sRoutingWizardPage, page }) => {
      await serviceDetailsPage.open(namespace, service);
      await k8sRoutingWizardPage.clickReference(namespace, service, 'VirtualService');
      await expectEditorMatchesRegex(page, 'kind: VirtualService');
      await k8sRoutingWizardPage.expectReference(namespace, service, 'service');
      await k8sRoutingWizardPage.expectReference(namespace, service, 'DestinationRule');
      await expectEditorMatchesRegex(page, 'end-user:[\\n ]*exact: jason');
    }
  );

  test('Update a Request Routing scenario', coreCachingOnly, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('request_routing');
    await k8sRoutingWizardPage.expectWizard('Update request routing');
    await k8sRoutingWizardPage.clickAdvancedOptions();
    await k8sRoutingWizardPage.clickTab('Gateways');
    await k8sRoutingWizardPage.clickAddGateway();
    await k8sRoutingWizardPage.selectCreateIstioGateway();
    await k8sRoutingWizardPage.previewConfiguration();
    await k8sRoutingWizardPage.updateConfiguration();
    await serviceDetailsPage.expectIstioConfigTableRowCount(3);
  });

  test('See a Gateway generated', coreCachingOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickIstioConfigBadgeLink('G', 'reviews-gateway');
    await expectEditorMatchesRegex(page, 'kind: Gateway');
  });

  test('Delete the Request Routing scenario', coreCachingOnly, async ({ serviceDetailsPage, k8sRoutingWizardPage }) => {
    await serviceDetailsPage.open(namespace, service);
    await serviceDetailsPage.clickServiceAction('delete_traffic_routing');
    await k8sRoutingWizardPage.confirmDeleteConfiguration();
    await serviceDetailsPage.expectIstioConfigTableEmpty();
    deleteBookinfoReviewsIstioRouting();
  });
});
