import { test } from '../../fixtures/kialiFixtures';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Namespaces list', () => {
  test.beforeEach(async ({ namespacesPage }) => {
    await namespacesPage.openList();
  });

  test('Namespace name links to namespace detail page', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await namespacesPage.clickNamespaceDetailLink('bookinfo');
    await namespacesPage.expectOnNamespaceDetailPage('bookinfo');
  });

  test('Cluster column is hidden on single-cluster namespaces list', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await namespacesPage.expectColumn('Cluster', false);
    await namespacesPage.expectTableHeadings(['Namespace', 'Type', 'Health', 'mTLS', 'Istio config', 'Labels']);
    await namespacesPage.expectBookinfoNamespaceTableInfo();
  });

  test('See namespaces table with correct info', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.expectBookinfoNamespaceTableInfo();
  });

  test('Filter namespaces by name', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.filterBy('Namespace', 'bookinfo');
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await namespacesPage.expectRowCount(1);
  });

  test('Filter namespaces by type', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.filterBy('Type', 'Control plane');
    await namespacesPage.expectNamespaceVisible('istio-system');
    await namespacesPage.expectRowCount(1);
  });

  test('Sort namespaces by name', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.sortByColumn('Namespace', 'ascending');
    await namespacesPage.expectSortedByColumn('Namespace', 'ascending');
    await namespacesPage.sortByColumn('Namespace', 'descending');
    await namespacesPage.expectSortedByColumn('Namespace', 'descending');
  });

  test('Hide Mode column on namespaces page', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await namespacesPage.openColumnManagement();
    await namespacesPage.setColumnChecked('Mode', false);
    await namespacesPage.applyColumnChanges();
    await namespacesPage.expectColumn('Mode', false);
    await namespacesPage.resetColumnsToDefault();
  });

  test('Column order is applied from URL on namespaces page', coreCachingOnly, async ({ namespacesPage }) => {
    await namespacesPage.expectNamespaceVisible('bookinfo');
    await namespacesPage.setColumnOrderViaUrl([
      'Labels',
      'Namespace',
      'Type',
      'Mode',
      'Health',
      'mTLS',
      'Istio config'
    ]);
    await namespacesPage.expectColumnOrder(['Labels', 'Namespace', 'Type', 'Mode', 'Health', 'mTLS', 'Istio config']);
  });
});
