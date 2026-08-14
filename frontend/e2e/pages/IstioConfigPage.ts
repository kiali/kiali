import { expect, type APIRequestContext, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoListPage } from '../utils/navigation';
import { selectNamespace } from '../utils/namespace';
import { waitForLoadingComplete } from '../utils/transition';
import { linkSelector } from '../utils/linkSelector';
import { colExists, expectOnlyRow, expectRowCount, getColWithRowText } from '../utils/table';
import { collectAmbientL7Warnings } from '../utils/ambientValidation';

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

export class IstioConfigPage extends BasePage {
  private filterOption(name: string) {
    // Exact match avoids Gateway⊂K8sGateway and Valid⊂Not Valid / Not Validated.
    return this.page.locator('#filter_select_value').getByRole('option', { name, exact: true });
  }

  private filterSelection(): Locator {
    return this.page.locator('#filter-selection');
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
    await this.page.locator('button#filter_select_type-toggle').click();
    await this.page
      .locator('div#filter_select_type button')
      .filter({ hasText: new RegExp(`^${category}$`) })
      .click();
  }

  async expectNoActiveFilters(): Promise<void> {
    await expect(this.activeFilterCloseButtons()).toHaveCount(0);
  }

  async typeIntoTypeFilter(input: string): Promise<void> {
    await this.page.locator('input[placeholder="Filter by Type"]').fill(input);
  }

  async expectTypeFilterPhrase(phrase: string): Promise<void> {
    await expect(this.page.locator('#filter_select_value').getByText(phrase, { exact: true })).toBeVisible();
  }

  async expandTypeFilterDropdown(): Promise<void> {
    await this.page.locator('input[placeholder="Filter by Type"]').click();
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
    const input = this.page.locator('input[placeholder="Filter by Type"]');
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
    await this.page.locator(`#filter-selection button[aria-label="Close ${label}"]`).click();
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
    // PF LabelGroup overflow control (e.g. "+1"); Cypress uses the same class selector in label_check.ts.
    await this.filterSelection().locator('button.pf-v6-c-label.pf-m-overflow').click();
  }

  async clickShowLess(): Promise<void> {
    await this.filterSelection().getByText('Show Less').click();
    await waitForLoadingComplete(this.page);
  }

  async expectValidationDropdownVisible(): Promise<void> {
    await expect(this.page.locator('button#filter_select_value-toggle')).toBeVisible();
  }

  async expectAllValidationFilterOptions(): Promise<void> {
    await this.page.locator('button#filter_select_value-toggle').click();
    for (const name of VALIDATION_FILTERS) {
      await expect(this.filterOption(name)).toBeVisible();
    }
    await this.page.locator('button#filter_select_value-toggle').click();
  }

  async applyValidationFilter(category: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      response => response.url().includes('/api/istio/config') && response.request().method() === 'GET'
    );
    await this.page.locator('button#filter_select_value-toggle').click();
    await this.filterOption(category).click();
    await responsePromise;
    await waitForLoadingComplete(this.page);
    await expect(this.filterSelection().getByText(category, { exact: true })).toBeVisible();
  }

  async chooseNValidationFilters(count: number): Promise<void> {
    await this.selectFilterCategory('Config');
    await expect(this.page.locator('button#filter_select_value-toggle')).toBeVisible();

    for (const name of VALIDATION_FILTERS.slice(0, count)) {
      await this.page.locator('button#filter_select_value-toggle').click();
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

  async expectIstioObjectColumnInformation(object: string): Promise<void> {
    const nameCell = getColWithRowText(this.page, object, 'Name');
    await expect(
      nameCell.locator(linkSelector(`/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/${object}`))
    ).toBeVisible();
    await expect(getColWithRowText(this.page, object, 'Namespace')).toContainText('bookinfo');
    await expect(getColWithRowText(this.page, object, 'Type')).toContainText('Gateway');
    const configCell = getColWithRowText(this.page, object, 'Configuration');
    await expect(
      configCell.locator(linkSelector(`/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/${object}`))
    ).toBeVisible();
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
    for (const name of names) {
      await expect(
        this.page
          .locator('tbody')
          .getByRole('row')
          .filter({
            has: this.page.getByRole('cell', { name, exact: true })
          })
      ).toBeVisible();
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
      `/api/namespaces/${namespace}/istio?objects=${encodeURIComponent(gvkKey)}&validate=true`
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const count = (body.resources?.[gvkKey] as unknown[] | undefined)?.length ?? 0;
    await expectRowCount(this.page, count);
    await expect(this.page.locator('tbody').getByRole('row').filter({ hasText: typeName })).toBeVisible();
  }

  async expectNoAmbientL7WarningsInNamespace(namespace: string): Promise<void> {
    const response = await this.page.request.get(`/api/namespaces/${namespace}/istio?validate=true`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const found = collectAmbientL7Warnings(body.validations as Record<string, unknown>);
    expect(found).toEqual([]);
  }

  async expectNoAmbientL7WarningsForWorkload(namespace: string, workload: string): Promise<void> {
    const response = await this.page.request.get(
      `/api/namespaces/${namespace}/workloads/${workload}?validate=true&rateInterval=60s&health=true`
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
    const configResponse = await this.page.request.get('/api/config');
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

  async refreshList(): Promise<void> {
    await this.getBySel('refresh-button').click();
    await waitForLoadingComplete(this.page);
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
}

export async function expectGatewayApiEnabled(request: APIRequestContext): Promise<boolean> {
  const response = await request.get('/api/config');
  if (!response.ok()) {
    return false;
  }
  const body = await response.json();
  return Boolean(body.gatewayAPIEnabled);
}
