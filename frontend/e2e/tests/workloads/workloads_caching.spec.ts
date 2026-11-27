import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { selectNamespace } from '../../utils/namespace';
import { isOfflineProject } from '../../utils/projects';
import { coreCachingAndOffline } from '../../utils/suite-tags';

test.describe('Workloads list caching', () => {
  test.beforeEach(async ({ workloadsPage }) => {
    // Offline runs serve bookinfo from the must-gather; there may be no cluster to install into.
    if (!isOfflineProject(test.info())) {
      ensureDemoApp('bookinfo');
    }
    await workloadsPage.openList();
  });

  test('See workloads table with correct info', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.expectBookinfoWorkloadsTableInfo();
  });

  test('See all Workloads toggles', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.expectAllWorkloadsTogglesChecked();
  });

  test('Toggle Workloads health toggle', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.setToggle('health', false);
    await workloadsPage.expectColumn('Health', false);
    await workloadsPage.setToggle('health', true);
    await workloadsPage.expectColumn('Health', true);
  });

  test('Filter workloads table by Workloads Name', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Workload Name', 'details-v1');
    await workloadsPage.expectWorkloadsInTable('details-v1');
    await workloadsPage.expectRowCount(1);
  });

  test('Filter workloads table by Workloads Type', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Workload Type', 'StatefulSet');
    await workloadsPage.expectWorkloadsInTable('no workloads');
  });

  test('Filter workloads table by sidecar', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Istio Sidecar', 'Present');
    await workloadsPage.expectWorkloadsInTable('workloads');
  });

  test('Filter workloads table by Istio Config Type', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Istio Config Type', 'VirtualService');
    await workloadsPage.expectWorkloadsInTable('no workloads');
  });

  test('Filter workloads table by health', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Health', 'Healthy');
    await workloadsPage.expectWorkloadsInTable('workloads');
    await workloadsPage.expectOnlyHealthyWorkloads();
  });

  test('Filter workloads table by App Label', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('App Label', 'Present');
    await workloadsPage.expectWorkloadsInTable('workloads');
    await workloadsPage.expectOnlyWorkloadsWithAppLabel();
  });

  test('Filter workloads table by Version Label', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Version Label', 'Present');
    await workloadsPage.expectWorkloadsInTable('workloads');
    await workloadsPage.expectOnlyWorkloadsWithVersionLabel();
  });

  test('Filter workloads table by label', coreCachingAndOffline, async ({ workloadsPage, page }) => {
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.filterBy('Label', 'app=details');
    await workloadsPage.expectWorkloadsInTable('details-v1');
    await workloadsPage.expectRowCount(1);
  });

  test(
    'The healthy status of a workload is reported in the list of workloads',
    coreCachingAndOffline,
    async ({ workloadsPage, page }) => {
      await selectNamespace(page, 'bookinfo');
      await workloadsPage.expectWorkloadListedAs('bookinfo', 'productpage-v1', 'healthy');
    }
  );
});
