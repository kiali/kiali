import { test } from '../../fixtures/kialiFixtures';
import { EAST, WEST, expectNoDuplicateNamespaceValues } from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiClusterOnly } from '../../utils/suite-tags';
import { expectClusterEntriesInTable, expectHealthyConfigOnBothClusters } from '../../utils/table';

test.describe('Multi-cluster lists', () => {
  test('Apps list shows Cluster column for east and west', multiClusterOnly, async ({ appsPage, page }) => {
    await appsPage.openList();
    await selectNamespace(page, 'bookinfo');
    await appsPage.expectColumn('Cluster', true);
    await expectClusterEntriesInTable(page, EAST, WEST);
  });

  test('Apps namespace dropdown has no duplicates', multiClusterOnly, async ({ appsPage, page }) => {
    await appsPage.openList();
    await expectNoDuplicateNamespaceValues(page);
  });

  test('Apps list sorts by Cluster column', multiClusterOnly, async ({ appsPage, page }) => {
    await appsPage.openList();
    await selectNamespace(page, 'bookinfo');
    await appsPage.sortByColumn('Cluster', 'ascending');
    await appsPage.expectSortedByColumn('Cluster', 'ascending');
    await appsPage.sortByColumn('Cluster', 'descending');
    await appsPage.expectSortedByColumn('Cluster', 'descending');
  });

  test('Services list shows Cluster column for east and west', multiClusterOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.expectColumn('Cluster', true);
    await expectClusterEntriesInTable(page, EAST, WEST);
  });

  test('Services from both clusters have healthy configuration', multiClusterOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await expectHealthyConfigOnBothClusters(page, 'bookinfo');
  });

  test('Services list sorts by Cluster column', multiClusterOnly, async ({ servicesPage, page }) => {
    await servicesPage.openList();
    await selectNamespace(page, 'bookinfo');
    await servicesPage.sortByColumn('Cluster', 'ascending');
    await servicesPage.expectSortedByColumn('Cluster', 'ascending');
    await servicesPage.sortByColumn('Cluster', 'descending');
    await servicesPage.expectSortedByColumn('Cluster', 'descending');
  });

  test('Workloads list shows Cluster column for east and west', multiClusterOnly, async ({ workloadsPage, page }) => {
    await workloadsPage.openList();
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.expectColumn('Cluster', true);
    await expectClusterEntriesInTable(page, EAST, WEST);
  });

  test('Workloads list sorts by Cluster column', multiClusterOnly, async ({ workloadsPage, page }) => {
    await workloadsPage.openList();
    await selectNamespace(page, 'bookinfo');
    await workloadsPage.sortByColumn('Cluster', 'ascending');
    await workloadsPage.expectSortedByColumn('Cluster', 'ascending');
    await workloadsPage.sortByColumn('Cluster', 'descending');
    await workloadsPage.expectSortedByColumn('Cluster', 'descending');
  });

  test('Namespaces list shows Cluster column for east and west', multiClusterOnly, async ({ namespacesPage, page }) => {
    await namespacesPage.openList();
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await namespacesPage.expectColumn('Cluster', true);
    await expectClusterEntriesInTable(page, EAST, WEST);
  });

  test('Namespaces list sorts by Cluster column', multiClusterOnly, async ({ namespacesPage }) => {
    await namespacesPage.openList();
    await namespacesPage.sortByColumn('Cluster', 'descending');
    await namespacesPage.expectSortedByColumn('Cluster', 'descending');
  });

  test('Istio Config list sorts by Cluster column', multiClusterOnly, async ({ istioConfigPage, page }) => {
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectColumn('Cluster', true);
    await istioConfigPage.sortByColumn('Cluster', 'ascending');
    await istioConfigPage.expectSortedByColumn('Cluster', 'ascending');
    await istioConfigPage.sortByColumn('Cluster', 'descending');
    await istioConfigPage.expectSortedByColumn('Cluster', 'descending');
  });
});
