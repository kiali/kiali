import { expect, type Locator, type Response } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage, gotoListPage } from '../utils/navigation';
import { selectNamespace, selectOnlyNamespaces } from '../utils/namespace';
import { waitForLoadingComplete } from '../utils/transition';
import { linkSelector } from '../utils/linkSelector';
import {
  colExists,
  expectListSortedByColumn,
  expectOnlyRow,
  expectRowCount,
  getColWithRowText,
  sortListByColumn
} from '../utils/table';
import { collectAmbientL7Warnings } from '../utils/ambientValidation';
import { editIstioConfigYaml } from '../utils/monacoEditor';
import {
  istioConfigDetailsApiPath,
  istioConfigDetailsConsolePath,
  waitForIstioObjectDetails as waitForIstioObjectDetailsApi
} from '../utils/istioConfigApi';
import { kialiUrl } from '../utils/kialiUrl';

const TYPE_FILTERS = [
  'AuthorizationPolicy',
  'DestinationRule',
  'EnvoyFilter',
  'Gateway',
  'PeerAuthentication',
  'RequestAuthentication',
  'ServiceEntry',
  'Sidecar',
  'Telemetry',
  'TrafficExtension',
  'VirtualService',
  'WasmPlugin',
  'WorkloadEntry',
  'WorkloadGroup'
] as const;

const VALIDATION_FILTERS = ['Valid', 'Not Valid', 'Not Validated', 'Warning'] as const;

const GATEWAY_GVK = 'networking.istio.io/v1, Kind=Gateway';

const VALIDATION_ICON: Record<string, string> = {
  danger: 'icon-error-validation',
  error: 'icon-error-validation',
  success: 'icon-correct-validation',
  warning: 'icon-warning-validation'
};

export class IstioConfigPage extends BasePage {
  private filterOption(name: string) {
    // Exact match avoids Gateway⊂K8sGateway and Valid⊂Not Valid / Not Validated.
    return this.page.getByTestId('filter-value-select').getByRole('option', { name, exact: true });
  }

  private filterSelection(): Locator {
    return this.page.getByTestId('filter-toolbar');
  }

  private activeFilterCloseButtons(): Locator {
    return this.filterSelection().locator('button[aria-label^="Close "]');
  }

  async open(): Promise<void> {
    await gotoListPage(this.page, 'istio');
  }

  async openWithNamespace(namespace: string): Promise<void> {
    await this.open();
    await selectNamespace(this.page, namespace);
  }

  async selectFilterCategory(category: 'Type' | 'Config'): Promise<void> {
    await this.page.getByTestId('filter-type-toggle').click();
    await this.page.getByTestId('filter-type-select').getByRole('option', { name: category, exact: true }).click();
  }

  async expectNoActiveFilters(): Promise<void> {
    await expect(this.activeFilterCloseButtons()).toHaveCount(0);
  }

  private filterTypeInputEl(): Locator {
    return this.page.getByTestId('filter-type-input').locator('input');
  }

  async typeIntoTypeFilter(input: string): Promise<void> {
    await this.filterTypeInputEl().fill(input);
  }

  async expectTypeFilterPhrase(phrase: string): Promise<void> {
    await expect(this.page.getByTestId('filter-value-select').getByText(phrase, { exact: true })).toBeVisible();
  }

  async expandTypeFilterDropdown(): Promise<void> {
    await this.filterTypeInputEl().click();
  }

  async expectAllTypeFilterOptions(): Promise<void> {
    for (const name of TYPE_FILTERS) {
      await expect(this.filterOption(name)).toBeVisible();
    }
  }

  async applyTypeFilter(typeName: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/istio/config') && response.request().method() === 'GET'
    );
    const input = this.filterTypeInputEl();
    await input.click();
    await input.fill(typeName);
    await this.filterOption(typeName).click();
    await responsePromise;
    await waitForLoadingComplete(this.page);
  }

  async applyMultipleTypeFilters(typeNames: string[]): Promise<void> {
    for (const typeName of typeNames) {
      await this.applyTypeFilter(typeName);
    }
  }

  async removeActiveFilter(label: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/istio/config') && response.request().method() === 'GET'
    );
    await this.filterSelection().locator(`button[aria-label="Close ${label}"]`).click();
    await responsePromise;
    await waitForLoadingComplete(this.page);
  }

  async clearAllFilters(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/istio/config') && response.request().method() === 'GET'
    );
    await this.filterSelection().getByRole('button', { name: 'Clear all filters' }).click();
    await responsePromise;
    await waitForLoadingComplete(this.page);
  }

  async chooseNTypeFilters(count: number): Promise<void> {
    await this.selectFilterCategory('Type');
    for (const typeName of TYPE_FILTERS.slice(0, count)) {
      await this.applyTypeFilter(typeName);
    }
  }

  async expectActiveFilterCount(count: number): Promise<void> {
    await expect(this.activeFilterCloseButtons()).toHaveCount(count);
  }

  async showMoreFilters(): Promise<void> {
    // PF LabelGroup overflow renders as a button with text "${n} more" — stable public API.
    await this.filterSelection()
      .getByRole('button', { name: /\d+ more/ })
      .click();
  }

  async clickShowLess(): Promise<void> {
    await this.filterSelection().getByText('Show Less').click();
    await waitForLoadingComplete(this.page);
  }

  async expectValidationDropdownVisible(): Promise<void> {
    await expect(this.page.getByTestId('filter-value-toggle')).toBeVisible();
  }

  async expectAllValidationFilterOptions(): Promise<void> {
    await this.page.getByTestId('filter-value-toggle').click();
    for (const name of VALIDATION_FILTERS) {
      await expect(this.filterOption(name)).toBeVisible();
    }
    await this.page.getByTestId('filter-value-toggle').click();
  }

  async applyValidationFilter(category: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/istio/config') && response.request().method() === 'GET'
    );
    await this.page.getByTestId('filter-value-toggle').click();
    await this.filterOption(category).click();
    await responsePromise;
    await waitForLoadingComplete(this.page);
    await expect(this.filterSelection().getByText(category, { exact: true })).toBeVisible();
  }

  async chooseNValidationFilters(count: number): Promise<void> {
    await this.selectFilterCategory('Config');
    await expect(this.page.getByTestId('filter-value-toggle')).toBeVisible();

    for (const name of VALIDATION_FILTERS.slice(0, count)) {
      await this.page.getByTestId('filter-value-toggle').click();
      await this.filterOption(name).click();
      await waitForLoadingComplete(this.page);
    }
  }

  async expectBookinfoConfigRows(): Promise<void> {
    await expect(this.getBySel('VirtualItem_Nsbookinfo_VirtualService_bookinfo')).toBeVisible();
    await expect(this.getBySel('VirtualItem_Nsbookinfo_Gateway_bookinfo-gateway')).toBeVisible();
  }

  async expectColumn(colName: string, visible: boolean): Promise<void> {
    await colExists(this.page, colName, visible);
  }

  async sortByColumn(column: string, order: 'ascending' | 'descending'): Promise<void> {
    await sortListByColumn(this.page, column, order);
  }

  async expectSortedByColumn(column: string, order: 'ascending' | 'descending'): Promise<void> {
    await expectListSortedByColumn(this.page, column, order);
  }

  async openConfigByCluster(cluster: string, namespace: string, type: string, name: string): Promise<void> {
    const row = this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_${type}_${name}`);
    const detailsApiPath = istioConfigDetailsApiPath(namespace, type, name);
    const consolePath = istioConfigDetailsConsolePath(namespace, type, name);
    const editor = this.page.locator('[data-test="istio-config-editor"] .monaco-editor');

    // Match on method and URL only. Folding `response.ok()` into the predicate would make an
    // error response (404 after a concurrent delete) hang for the full 45s instead of letting
    // the outer toPass retry, and would report a bare timeout instead of the status.
    const waitForDetailsResponse = (): Promise<Response> =>
      this.page.waitForResponse(
        response =>
          response.request().method() === 'GET' &&
          response.url().includes(detailsApiPath) &&
          response.url().includes(`clusterName=${encodeURIComponent(cluster)}`),
        { timeout: 45_000 }
      );

    const openFromList = async (): Promise<Response> => {
      await this.open();
      await selectNamespace(this.page, namespace);
      await this.refreshList(cluster);
      await expect(row).toBeVisible({ timeout: 15_000 });
      const detailsResponse = waitForDetailsResponse();
      await row.locator(linkSelector()).first().click();
      const response = await detailsResponse;
      await waitForLoadingComplete(this.page);
      return response;
    };

    const openFromUrl = async (): Promise<Response> => {
      const detailsResponse = waitForDetailsResponse();
      await gotoConsolePage(this.page, consolePath, { clusterName: cluster });
      await this.page.reload();
      const response = await detailsResponse;
      await waitForLoadingComplete(this.page);
      return response;
    };

    await expect(async () => {
      await waitForIstioObjectDetailsApi(this.page, namespace, type, name, cluster);

      let response = await openFromList();
      if (!response.ok() || (await this.istioConfigDetailsNotFoundVisible(name))) {
        response = await openFromUrl();
      }

      if (!response.ok()) {
        throw new Error(`Istio config "${name}" details on cluster "${cluster}" returned HTTP ${response.status()}`);
      }
      if (await this.istioConfigDetailsNotFoundVisible(name)) {
        throw new Error(`Istio config "${name}" not loaded on cluster "${cluster}" (empty details panel)`);
      }
      await expect(editor).toBeVisible({ timeout: 15_000 });
    }).toPass({ intervals: [2_000, 3_000, 5_000], timeout: 120_000 });
  }

  private async istioConfigDetailsNotFoundVisible(objectName: string): Promise<boolean> {
    const notFound = this.page.getByText(`${objectName} is not found in the mesh`);
    return notFound.isVisible();
  }

  async expectObjectListedOnCluster(type: string, name: string, namespace: string, cluster: string): Promise<void> {
    await waitForIstioObjectDetailsApi(this.page, namespace, type, name, cluster);
    const row = this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_${type}_${name}`);
    await expect(async () => {
      await this.refreshList(cluster);
      await expect(row).toBeVisible();
    }).toPass({ intervals: [5_000], timeout: 120_000 });
  }

  async expectObjectNotListedOnCluster(type: string, name: string, namespace: string, cluster: string): Promise<void> {
    await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_${type}_${name}`)).toHaveCount(0);
  }

  async expectTrafficRoutingForServiceOnCluster(service: string, namespace: string, cluster: string): Promise<void> {
    await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_VirtualService_${service}`)).toBeVisible();
    await expect(
      this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_DestinationRule_${service}`)
    ).toBeVisible();
  }

  async expectNoTrafficRoutingForServiceOnCluster(service: string, namespace: string, cluster: string): Promise<void> {
    // Anchor on a row that must be present first. A bare `not.toContainText` resolves on the
    // first passing poll, so an empty or still-loading table would satisfy the absence checks.
    await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_Gateway_bookinfo-gateway`)).toBeVisible();
    await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_VirtualService_${service}`)).toHaveCount(
      0
    );
    await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_DestinationRule_${service}`)).toHaveCount(
      0
    );
  }

  /** Row columns scoped to one cluster — a name-only row filter matches east and west alike. */
  async expectGatewayRowColumns(name: string, namespace: string, cluster: string): Promise<void> {
    const row = this.getBySel(`VirtualItem_Cluster${cluster}_Ns${namespace}_Gateway_${name}`);
    await expect(row.locator('td[data-label="Cluster"]')).toContainText(cluster);
    await expect(row.locator('td[data-label="Namespace"]')).toContainText(namespace);
    await expect(row.locator('td[data-label="Type"]')).toContainText('Gateway');
    await expect(
      row
        .locator('td[data-label="Name"]')
        .locator(linkSelector(`/namespaces/${namespace}/istio/networking.istio.io/v1/Gateway/${name}`))
    ).toBeVisible();
  }

  async expectBookinfoVirtualServiceOnClusterVisible(cluster: string, externalCluster: string): Promise<void> {
    const row = this.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_VirtualService_bookinfo`);
    await expect(row.locator('td[data-label="Cluster"]')).toContainText(cluster);
    await expect(this.getBySel(`VirtualItem_Cluster${externalCluster}_Nsbookinfo_VirtualService_bookinfo`)).toHaveCount(
      0
    );
  }

  async expectForbiddenIstioConfigEmptyState(): Promise<void> {
    await expect(this.page.locator('#empty-page-error')).toBeVisible({ timeout: 60_000 });
    await expect(this.page.locator('#empty-page-error')).toContainText('No Istio object is selected');
  }

  async expectMulticlusterBookinfoGatewayAndVirtualService(): Promise<void> {
    for (const cluster of ['east', 'west']) {
      await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_Gateway_bookinfo-gateway`)).toBeVisible();
      await expect(this.getBySel(`VirtualItem_Cluster${cluster}_Nsbookinfo_VirtualService_bookinfo`)).toBeVisible();
    }
  }

  async saveYamlAndWaitForPatch(name: string): Promise<void> {
    const patchPath = `/AuthorizationPolicy/${name}`;
    await expect(async () => {
      // Status is asserted after the wait, not inside the predicate, so a rejected PATCH
      // retries in seconds and reports its status instead of timing out opaquely.
      const patchPromise = this.page.waitForResponse(
        response => response.request().method() === 'PATCH' && response.url().includes(patchPath),
        { timeout: 45_000 }
      );
      const saveButton = this.page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      const patchResponse = await patchPromise;
      expect(patchResponse.status(), `PATCH ${patchPath}`).toBeLessThan(400);
    }).toPass({ intervals: [2_000, 3_000], timeout: 90_000 });
  }

  async deleteObjectFromEditor(): Promise<void> {
    await this.page.getByRole('button', { name: 'Actions' }).click();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(this.page.getByText('Confirm Delete')).toBeVisible();
    await this.page.getByRole('button', { name: 'Delete' }).click();
    await waitForLoadingComplete(this.page);
  }

  async expectIstioObjectColumnInformation(object: string): Promise<void> {
    await this.expectIstioObjectNameNamespaceType(object);
    const configCell = getColWithRowText(this.page, object, 'Configuration');
    await expect(
      configCell.locator(linkSelector(`/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/${object}`))
    ).toBeVisible();
  }

  async expectIstioObjectNameNamespaceType(object: string): Promise<void> {
    const nameCell = getColWithRowText(this.page, object, 'Name');
    await expect(
      nameCell.locator(linkSelector(`/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/${object}`))
    ).toBeVisible();
    await expect(getColWithRowText(this.page, object, 'Namespace')).toContainText('bookinfo');
    await expect(getColWithRowText(this.page, object, 'Type')).toContainText('Gateway');
  }

  async expectAllConfigurationTogglesChecked(): Promise<void> {
    await expect(this.getBySel('toggle-configuration')).toBeChecked();
    await colExists(this.page, 'Configuration', true);
  }

  async setConfigurationToggle(checked: boolean): Promise<void> {
    const locator = this.getBySel('toggle-configuration');
    if (checked) {
      await locator.check();
    } else {
      await locator.uncheck();
    }
  }

  async filterBy(filter: string, filterValue: string): Promise<void> {
    await this.page.locator('button#filter_select_type-toggle').click();
    await this.page
      .locator('div#filter_select_type button')
      .filter({ hasText: new RegExp(`^${filter}$`) })
      .click();

    if (filter === 'Istio Name') {
      await this.page.locator('input#filter_input_value').fill(filterValue);
      await this.page.locator('input#filter_input_value').press('Enter');
    } else if (filter === 'Type') {
      const input = this.page.locator('input[placeholder="Filter by Type"]');
      await input.fill(filterValue);
      await input.press('Enter');
      await this.page.locator(`li[label="${filterValue}"] button`).click();
    } else if (filter === 'Config') {
      await this.page.locator('button#filter_select_value-toggle').click();
      await this.filterOption(filterValue).click();
    }

    await waitForLoadingComplete(this.page);
  }

  async expectOnlyRow(name: string): Promise<void> {
    await expectOnlyRow(this.page, name);
  }

  async expectRowsVisible(...names: string[]): Promise<void> {
    const rowTestIds: Record<string, string> = {
      bookinfo: 'VirtualItem_Nsbookinfo_VirtualService_bookinfo',
      'bookinfo-gateway': 'VirtualItem_Nsbookinfo_Gateway_bookinfo-gateway'
    };
    for (const name of names) {
      const testId = rowTestIds[name];
      if (testId) {
        await expect(this.getBySel(testId)).toBeVisible();
      } else {
        await expect(this.page.getByRole('row').filter({ hasText: name })).toBeVisible();
      }
    }
  }

  async expectOnlyTypeObjectsInNamespace(typeName: string, namespace: string): Promise<void> {
    const gvkKey =
      typeName === 'Gateway'
        ? GATEWAY_GVK
        : typeName === 'VirtualService'
          ? 'networking.istio.io/v1, Kind=VirtualService'
          : typeName;
    const response = await this.page.request.get(
      kialiUrl(`/api/namespaces/${namespace}/istio?objects=${encodeURIComponent(gvkKey)}&validate=true`)
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const count = (body.resources?.[gvkKey] as unknown[] | undefined)?.length ?? 0;
    await expectRowCount(this.page, count);
    await expect(this.page.locator('tbody').getByRole('row').filter({ hasText: typeName })).toBeVisible();
  }

  async expectNoAmbientL7WarningsInNamespace(namespace: string): Promise<void> {
    const response = await this.page.request.get(kialiUrl(`/api/namespaces/${namespace}/istio?validate=true`));
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const found = collectAmbientL7Warnings(body.validations as Record<string, unknown>);
    expect(found).toEqual([]);
  }

  async expectNoAmbientL7WarningsForWorkload(namespace: string, workload: string): Promise<void> {
    const response = await this.page.request.get(
      kialiUrl(`/api/namespaces/${namespace}/workloads/${workload}?validate=true&rateInterval=60s&health=true`)
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const found = collectAmbientL7Warnings(body.validations as Record<string, unknown>);
    expect(found).toEqual([]);
  }

  async expectCanCreateIstioObject(group: string, version: string, kind: string): Promise<void> {
    await this.getBySel('istio-actions-toggle').click();
    await this.getBySel('istio-actions-dropdown').getByText(kind, { exact: true }).click();
    await expect(this.page).toHaveURL(new RegExp(`/istio/new/${group}/${version}/${kind}`));
  }

  async expectCanCreateK8sIstioObject(group: string, version: string, kind: string): Promise<void> {
    const configResponse = await this.page.request.get(kialiUrl('/api/config'));
    expect(configResponse.ok()).toBeTruthy();
    const config = await configResponse.json();
    await this.getBySel('istio-actions-toggle').click();
    const dropdown = this.getBySel('istio-actions-dropdown');
    if (config.gatewayAPIEnabled) {
      await dropdown.getByText(`K8s${kind}`, { exact: true }).click();
      await expect(this.page).toHaveURL(new RegExp(`/istio/new/${group}/${version}/${kind}`));
    } else {
      await expect(dropdown.getByText(`K8s${kind}`, { exact: true })).toHaveCount(0);
    }
  }

  async refreshList(cluster?: string): Promise<void> {
    await this.bustIstioConfigCache(cluster);
    await this.getBySel('refresh-button').click();
    await waitForLoadingComplete(this.page);
  }

  /** Forces Kiali to drop cached istio config before list refresh. */
  private async bustIstioConfigCache(cluster?: string): Promise<void> {
    const query = new URLSearchParams({ _: String(Date.now()) });
    if (cluster) {
      query.set('clusterName', cluster);
    }
    const response = await this.page.request.get(kialiUrl(`/api/istio/config?${query.toString()}`));
    expect(response.ok()).toBeTruthy();
  }

  async waitForIstioObjectDetails(namespace: string, typeName: string, name: string, cluster?: string): Promise<void> {
    await waitForIstioObjectDetailsApi(this.page, namespace, typeName, name, cluster);
  }

  async ensureConfigurationValidationEnabled(): Promise<void> {
    const toggle = this.getBySel('toggle-configuration');
    if (!(await toggle.isChecked())) {
      await toggle.check();
      await waitForLoadingComplete(this.page);
    }
  }

  async expectValidationStatus(
    namespace: string,
    typeName: string,
    instanceName: string,
    healthStatus: string
  ): Promise<void> {
    await this.ensureConfigurationValidationEnabled();
    await this.open();
    await selectOnlyNamespaces(this.page, [namespace]);

    const row = this.getBySel(`VirtualItem_Ns${namespace}_${typeName}_${instanceName}`);
    const expectedIcon = VALIDATION_ICON[healthStatus];

    await expect(async () => {
      await this.refreshList();
      await expect(row).toBeVisible({ timeout: 5_000 });
      await expect(row.locator(`[data-test="${expectedIcon}"]`)).toBeVisible({ timeout: 5_000 });
    }).toPass({ intervals: [10_000], timeout: 90_000 });
  }

  async openConfigByName(name: string): Promise<void> {
    await waitForLoadingComplete(this.page);
    await getColWithRowText(this.page, name, 'Name').locator(linkSelector()).first().click();
  }

  async expectObjectConfigurationStatus(
    namespace: string,
    typeName: string,
    instanceName: string,
    statusText: string
  ): Promise<void> {
    const row = this.page.locator(`[data-test="VirtualItem_Ns${namespace}_${typeName}_${instanceName}"]`);

    await expect(async () => {
      await this.refreshList();
      await expect(row).toContainText(statusText);
    }).toPass({ intervals: [10_000], timeout: 60_000 });
  }

  async expectEditorVisible(): Promise<void> {
    const editor = this.page.locator('[data-test="istio-config-editor"] .monaco-editor');
    await expect(async () => {
      if (await this.page.getByText('is not found in the mesh').isVisible()) {
        throw new Error('Istio config details show "not found in the mesh" instead of the editor');
      }
      await expect(editor).toBeVisible({ timeout: 15_000 });
    }).toPass({ intervals: [2_000, 3_000, 5_000], timeout: 120_000 });
  }

  async editYaml(): Promise<void> {
    await editIstioConfigYaml(this.page);
  }

  async clickReload(): Promise<void> {
    await this.getBySel('reload-istio-config').click();
  }

  async clickCancel(): Promise<void> {
    await this.getBySel('cancel-istio-config').click();
  }

  async expectUnsavedModal(action: string): Promise<void> {
    await expect(this.getBySel('unsaved-changes-modal')).toBeVisible();
    await expect(this.getBySel('confirm-unsaved')).toContainText(action);
  }

  async cancelUnsavedModal(): Promise<void> {
    await this.getBySel('cancel-unsaved').click();
  }

  async expectNoUnsavedModal(): Promise<void> {
    await expect(this.getBySel('unsaved-changes-modal')).toHaveCount(0);
  }

  async expectNoClusterBadge(): Promise<void> {
    await expect(this.page.locator('#pfbadge-C')).toHaveCount(0);
  }

  async clickCreateIstioConfigAction(type: string): Promise<void> {
    await this.getBySel('istio-actions-toggle').click();
    await waitForLoadingComplete(this.page);
    await this.page.locator(`li[data-test="create_${type}"]`).locator('button').click();
    await waitForLoadingComplete(this.page);
  }

  async expectConfigWizard(title: string): Promise<void> {
    await expect(this.page.locator('h1')).toContainText(title);
  }

  async typesInInput(id: string, value: string): Promise<void> {
    await this.page.locator(`input[id="${id}"]`).fill(value);
  }

  async chooseModeFromSelect(option: string, id: string): Promise<void> {
    const select = this.page.locator(`select[id="${id}"]`);
    if ((await select.count()) > 0) {
      await select.selectOption(option);
      return;
    }
    await this.page.locator(`button[id="${id}-toggle"]`).click();
    const optionLocator = this.page.getByRole('option', { name: new RegExp(option, 'i') });
    if ((await optionLocator.count()) > 0) {
      await optionLocator.first().click();
      return;
    }
    await this.page
      .locator('.pf-v6-c-menu__list-item')
      .filter({ hasText: new RegExp(option, 'i') })
      .first()
      .click();
  }

  async expectObjectListed(type: string, name: string, namespace: string): Promise<void> {
    const row = this.getBySel(`VirtualItem_Ns${namespace}_${type}_${name}`);
    await expect(async () => {
      await this.refreshList();
      await expect(row.locator('svg')).toBeVisible();
    }).toPass({ intervals: [5_000], timeout: 60_000 });
  }

  async expectObjectNotListed(type: string, name: string, namespace: string): Promise<void> {
    await expect(this.getBySel(`VirtualItem_Ns${namespace}_${type}_${name}`)).toHaveCount(0);
  }

  async expectK8sGatewayReferenced(namespace: string, gateway: string, referenced: boolean): Promise<void> {
    await waitForLoadingComplete(this.page);
    const ref = this.getBySel(`K8sGateway-${namespace}-${gateway}`);
    if (referenced) {
      await expect(this.page.getByRole('heading', { name: 'Validation References' })).toBeVisible();
      await expect(ref).toBeVisible();
      return;
    }
    await expect(ref).toHaveCount(0);
  }

  async deleteCurrentConfig(): Promise<void> {
    await this.page.locator('#actions-toggle').click();
    await this.page.locator('#actions').getByText('Delete', { exact: true }).click();
    await this.page.locator('#pf-modal-part-1').getByRole('button', { name: 'Delete' }).click();
    await waitForLoadingComplete(this.page);
  }

  async openConfigByRow(namespace: string, typeName: string, name: string): Promise<void> {
    await waitForLoadingComplete(this.page);
    await this.getBySel(`VirtualItem_Ns${namespace}_${typeName}_${name}`).locator(linkSelector()).first().click();
    await waitForLoadingComplete(this.page);
  }

  private configurationAnalysisSection(): Locator {
    return this.page.getByRole('heading', { name: 'Configuration Analysis' }).locator('../..');
  }

  /**
   * List rows for some types (notably PeerAuthentication) show N/A until the details API runs with
   * validate=true. Open details and wait for that response so downstream validations are computed.
   */
  async primeValidationFromDetails(namespace: string, typeName: string, instanceName: string): Promise<void> {
    await this.ensureConfigurationValidationEnabled();
    await this.openConfigDetailsAndWaitForValidation(namespace, typeName, instanceName);
    await this.open();
    await waitForLoadingComplete(this.page);
  }

  /** Assert a validation code on the config details page (list icon may stay N/A on OSSMC). */
  async expectValidationOnDetailsPage(
    namespace: string,
    typeName: string,
    instanceName: string,
    validationCode: string,
    severity: 'danger' | 'warning' = 'danger'
  ): Promise<void> {
    await this.ensureConfigurationValidationEnabled();
    await this.open();
    await selectOnlyNamespaces(this.page, [namespace]);
    await this.refreshList();
    await waitForLoadingComplete(this.page);
    await this.openConfigDetailsAndWaitForValidation(namespace, typeName, instanceName);
    await this.expectGroupedValidationMessage(validationCode, 1, severity);
  }

  private async openConfigDetailsAndWaitForValidation(
    namespace: string,
    typeName: string,
    instanceName: string
  ): Promise<void> {
    const validateResponse = this.page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        response.url().includes('/istio/') &&
        response.url().includes(`/${instanceName}`) &&
        response.url().includes('validate=true') &&
        response.ok(),
      { timeout: 60_000 }
    );

    await gotoConsolePage(this.page, istioConfigDetailsConsolePath(namespace, typeName, instanceName));
    await validateResponse;
    await waitForLoadingComplete(this.page);
  }

  async expectGroupedValidationMessage(
    code: string,
    count: number,
    severity: 'danger' | 'warning' = 'warning'
  ): Promise<void> {
    const messagePattern = count > 1 ? new RegExp(`${code}.*\\(${count}\\)`) : new RegExp(code);
    const iconTestId = severity === 'danger' ? 'icon-error-validation' : 'icon-warning-validation';
    const analysisSection = this.configurationAnalysisSection();

    await expect(async () => {
      await waitForLoadingComplete(this.page);
      const validationRow = analysisSection.locator('div').filter({ hasText: messagePattern });
      await expect(validationRow.first()).toBeVisible({ timeout: 5_000 });
      await expect(validationRow.first().getByTestId(iconTestId)).toBeVisible({ timeout: 5_000 });
    }).toPass({ intervals: [3_000], timeout: 90_000 });
  }
}

export { isGatewayApiEnabled, isGatewayApiEnabled as expectGatewayApiEnabled } from '../utils/kialiConfig';
