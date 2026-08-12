import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { gotoConsolePage } from '../utils/navigation';
import { selectNamespace } from '../utils/namespace';
import { waitForLoadingComplete } from '../utils/transition';

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
    await gotoConsolePage(this.page, 'istio');
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
    await this.filterSelection().getByRole('button', { name: /^\+/ }).click();
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
}
