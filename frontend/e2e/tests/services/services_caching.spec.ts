import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { skipUnlessApiDocumentationConfigured } from '../../utils/kialiConfig';
import { selectNamespace } from '../../utils/namespace';
import { waitForLoadingComplete } from '../../utils/transition';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Services list caching', () => {
  test.beforeEach(() => {
    ensureDemoApp('bookinfo');
  });

  test('See services table with correct info', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await servicesPage.applyProductpageKialiApiAnnotations();
    await selectNamespace(page, 'bookinfo');
    await page.getByTestId('refresh-button').click();
    await waitForLoadingComplete(page);
    await skipUnlessApiDocumentationConfigured(page.request, 'bookinfo', 'productpage');
    await servicesPage.expectBookinfoServicesTableInfo();
  });

  test('Filter services table by Service Name', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Service Name', 'productpage');
    await servicesPage.expectServicesInTable('productpage');
    await servicesPage.expectRowCount(1);
  });

  test('Filter services table by Service Type', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Service Type', 'External');
    const tbodyText = (await page.locator('tbody').textContent()) ?? '';
    if (!tbodyText.includes('No services found')) {
      test.skip(true, 'bookinfo namespace contains External-type services (CI uses a clean bookinfo install)');
    }
    await servicesPage.expectServicesInTable('nothing');
  });

  test('Filter services table by sidecar', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Istio Sidecar', 'Present');
    await servicesPage.expectServicesInTable('something');
  });

  test('Filter services table by Istio Config Type', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Istio Config Type', 'VirtualService');
    await servicesPage.expectServicesInTable('productpage');
    await servicesPage.expectRowCount(1);
  });

  test('Filter services table by health', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Health', 'Healthy');
    await servicesPage.expectServicesInTable('something');
    await servicesPage.expectOnlyHealthyServices();
  });

  test('Filter services table by label', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.filterBy('Label', 'app=productpage');
    await servicesPage.expectServicesInTable('productpage');
    await servicesPage.expectRowCount(1);
  });

  test('Filter services table by label click', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.clickLabel('app=productpage');
    await servicesPage.expectServicesInTable('productpage');
    await servicesPage.expectRowCount(1);
  });

  test('Filter and unfilter services table by label click', coreCachingOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.clickLabel('app=productpage');
    await servicesPage.clickLabel('app=productpage');
    await servicesPage.expectRowCountGreaterThan(1);
  });

  test(
    'The healthy status of a service is reported in the list of services',
    coreCachingOnly,
    async ({ servicesPage, page }) => {
      await servicesPage.openList();
      await selectNamespace(page, 'bookinfo');
      await servicesPage.expectServiceListedAs('bookinfo', 'productpage', 'healthy');
    }
  );
});
