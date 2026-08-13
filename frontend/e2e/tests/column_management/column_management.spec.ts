import { test } from '../../fixtures/kialiFixtures';
import { selectNamespace } from '../../utils/namespace';

const core1 = { tag: '@core-1' as const };

test.describe('Column management', () => {
  test.describe('Apps list', () => {
    test.beforeEach(async ({ appsPage, page }) => {
      await appsPage.openList();
      await selectNamespace(page, 'bookinfo');
    });

    test('Open column management modal', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.expectColumnManagementModal();
      await appsPage.expectModalTitle('Manage columns');
    });

    test('Name column is not hideable in modal', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.expectColumnCheckboxDisabled('Name');
      await appsPage.expectColumnCheckboxChecked('Name');
    });

    test('Hide and show columns via modal', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.setColumnChecked('Labels', false);
      await appsPage.setColumnChecked('Details', false);
      await appsPage.applyColumnChanges();
      await appsPage.expectColumnHiddenInTable('Labels');
      await appsPage.expectColumnHiddenInTable('Details');
      await appsPage.expectColumnVisibleInTable('Name');

      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.setColumnChecked('Labels', true);
      await appsPage.applyColumnChanges();
      await appsPage.expectColumnVisibleInTable('Labels');
    });

    test('Reorder columns via modal', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.reorderColumnsViaUrl();
      await appsPage.expectFirstDataColumn('Health');
    });

    test('Reset columns to default', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.setColumnChecked('Health', false);
      await appsPage.applyColumnChanges();
      await appsPage.expectColumnHiddenInTable('Health');

      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.resetColumnsToDefault();
      await appsPage.expectDefaultAppsColumns();
      await appsPage.expectColumnVisibleInTable('Health');
    });

    test('Name column cannot be hidden via URL', core1, async ({ appsPage, page }) => {
      await appsPage.openList({ apphide: 'name,health,labels' });
      await selectNamespace(page, 'bookinfo');
      await appsPage.expectColumnVisibleInTable('Name');
      await appsPage.expectColumnHiddenInTable('Health');
      await appsPage.expectColumnHiddenInTable('Labels');
    });

    test('Column state persists in URL', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.setColumnChecked('Namespace', false);
      await appsPage.applyColumnChanges();
      await appsPage.expectUrlContains('apphide');
      await appsPage.expectUrlContains('namespace');
      await appsPage.refreshPage();
      await appsPage.expectColumnHiddenInTable('Namespace');
    });

    test('Column order persists in URL', core1, async ({ appsPage }) => {
      await appsPage.openColumnManagement('apps-manage-columns');
      await appsPage.reorderColumnsViaUrl();
      await appsPage.expectUrlContains('apporder');
      await appsPage.refreshPage();
      await appsPage.expectFirstDataColumn('Health');
    });
  });

  test.describe('Services list', () => {
    test('Name column is not hideable', core1, async ({ servicesPage, page }) => {
      await servicesPage.openList();
      await selectNamespace(page, 'bookinfo');
      await servicesPage.openColumnManagement('services-manage-columns');
      await servicesPage.expectColumnCheckboxDisabled('Name');
      await servicesPage.closeColumnManagementModal();
      await servicesPage.visitWithUrlParams('svchide=name,health');
      await servicesPage.expectColumnVisibleInTable('Name');
      await servicesPage.expectColumnHiddenInTable('Health');
    });
  });

  test.describe('Workloads list', () => {
    test('Name column is not hideable', core1, async ({ workloadsPage, page }) => {
      await workloadsPage.openList();
      await selectNamespace(page, 'bookinfo');
      await workloadsPage.openColumnManagement('workloads-manage-columns');
      await workloadsPage.expectColumnCheckboxDisabled('Name');
      await workloadsPage.closeColumnManagementModal();
      await workloadsPage.visitWithUrlParams('wlhide=name,health');
      await workloadsPage.expectColumnVisibleInTable('Name');
      await workloadsPage.expectColumnHiddenInTable('Health');
    });
  });
});
